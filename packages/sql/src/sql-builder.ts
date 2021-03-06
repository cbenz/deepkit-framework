/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {SQLQueryModel} from './sql-adapter';
import {DefaultPlatform} from './platform/default-platform';
import {ClassSchema, getClassSchema, PropertySchema, resolveClassTypeOrForward} from '@deepkit/type';
import {DatabaseJoinModel, getPrimaryKeyHashGenerator} from '@deepkit/orm';

type ConvertDataToDict = (row: any) => { [name: string]: any };

export class SqlBuilder {
    protected sqlSelect: string[] = [];
    protected joins: { join: DatabaseJoinModel<any, any>, forJoinIndex: number, startIndex: number, converter: ConvertDataToDict }[] = [];

    public rootConverter?: ConvertDataToDict;

    constructor(protected platform: DefaultPlatform) {
    }

    protected getWhereSQL(schema: ClassSchema, filter: any, tableName?: string) {
        tableName = tableName || this.platform.getTableIdentifier(schema);
        return this.platform.createSqlFilterBuilder(schema, tableName).convert(filter);
    }

    protected selectColumns(schema: ClassSchema, model: SQLQueryModel<any>) {
        const properties = model.select.size ? [...model.select.values()].map(name => schema.getProperty(name)) : schema.getClassProperties().values();

        for (const property of properties) {
            if (property.backReference) continue;

            this.sqlSelect.push(this.platform.quoteIdentifier(property.name));
        }
    }

    protected selectColumnsWithJoins(schema: ClassSchema, model: SQLQueryModel<any>, refName: string = '') {
        const result: { startIndex: number, fields: PropertySchema[] } = {startIndex: this.sqlSelect.length, fields: []};

        const properties = model.select.size ? [...model.select.values()].map(name => schema.getProperty(name)) : schema.getClassProperties().values();
        const tableName = this.platform.getTableIdentifier(schema);

        for (const property of properties) {
            if (property.backReference) continue;

            result.fields.push(property);
            const as = this.platform.quoteIdentifier(this.sqlSelect.length + '');

            if (refName) {
                this.sqlSelect.push(this.platform.quoteIdentifier(refName) + '.' + this.platform.quoteIdentifier(property.name) + ' AS ' + as);
            } else {
                this.sqlSelect.push(tableName + '.' + this.platform.quoteIdentifier(property.name) + ' AS ' + as);
            }
        }

        for (const join of model.joins) {
            if (join.populate) {
                join.as = refName + '__' + join.propertySchema.name;
                const forJoinIndex = this.joins.length - 1;
                const joinMap = {
                    join,
                    forJoinIndex: forJoinIndex,
                    converter: (() => {
                        return {};
                    }) as ConvertDataToDict,
                    startIndex: 0,
                };
                this.joins.push(joinMap);

                const map = this.selectColumnsWithJoins(join.query.classSchema, join.query.model, refName + '__' + join.propertySchema.name);
                joinMap.converter = this.buildConverter(map.startIndex, map.fields);
                joinMap.startIndex = map.startIndex;
            }
        }

        return result;
    }

    public convertRows(schema: ClassSchema, model: SQLQueryModel<any>, rows: any[]): any[] {
        if (!this.rootConverter) throw new Error('No root converter set');
        if (!this.joins.length) return rows.map(v => this.rootConverter!(v));

        const result: any[] = [];

        const itemsStack: ({ hash: string, item: any } | undefined)[] = [];
        const hashConverter: ((value: any) => string)[] = [];
        itemsStack.push(undefined); //root
        for (const join of this.joins) {
            itemsStack.push(undefined);
            hashConverter.push(getPrimaryKeyHashGenerator(join.join.query.classSchema, this.platform.serializer));
        }

        const rootPkHasher = getPrimaryKeyHashGenerator(schema, this.platform.serializer);

        for (const row of rows) {
            const converted = this.rootConverter(row);
            const pkHash = rootPkHasher(converted);
            if (!itemsStack[0] || itemsStack[0].hash !== pkHash) {
                if (itemsStack[0]) result.push(itemsStack[0].item);
                itemsStack[0] = {hash: pkHash, item: converted};
            }

            for (let joinId = 0; joinId < this.joins.length; joinId++) {
                const join = this.joins[joinId];
                if (!join.join.as) continue;

                const converted = join.converter(row);
                if (!converted) continue;
                const pkHash = hashConverter[joinId](converted);
                const forItem = itemsStack[join.forJoinIndex + 1]!.item;

                if (!itemsStack[joinId + 1] || itemsStack[joinId + 1]!.hash !== pkHash) {
                    itemsStack[joinId + 1] = {hash: pkHash, item: converted};
                }

                if (join.join.propertySchema.isArray) {
                    if (!forItem[join.join.as]) forItem[join.join.as] = [];
                    if (converted) {
                        //todo: set lastHash stack, so second level joins work as well
                        // we need to refactor lashHash to a stack first.
                        // const pkHasher = getPrimaryKeyHashGenerator(join.join.query.classSchema, this.platform.serializer);
                        // const pkHash = pkHasher(item);
                        forItem[join.join.as].push(converted);
                    }
                } else {
                    forItem[join.join.as] = converted;
                }
            }
        }

        if (itemsStack[0]) result.push(itemsStack[0].item);

        return result;
    }

    protected buildConverter(startIndex: number, fields: PropertySchema[]): ConvertDataToDict {
        const lines: string[] = [];
        let primaryKeyIndex = startIndex;

        for (const field of fields) {
            if (field.isId) primaryKeyIndex = startIndex;
            lines.push(`'${field.name}': row[${startIndex++}]`);
        }

        const code = `
            return function(row) {
                if (null === row[${primaryKeyIndex}]) return;
            
                return {
                    ${lines.join(',\n')}
                };
            }
        `;

        return new Function(code)() as ConvertDataToDict;
    }

    protected getJoinSQL<T>(model: SQLQueryModel<T>, parentName: string, prefix: string = ''): string {
        if (!model.joins.length) return '';

        const joins: string[] = [];

        for (const join of model.joins) {
            const tableName = this.platform.getTableIdentifier(join.query.classSchema);
            const joinName = this.platform.quoteIdentifier(prefix + '__' + join.propertySchema.name);

            const foreignSchema = join.query.classSchema;

            //many-to-many
            if (join.propertySchema.backReference && join.propertySchema.backReference.via) {
                const viaSchema = getClassSchema(resolveClassTypeOrForward(join.propertySchema.backReference.via));
                const pivotTableName = this.platform.getTableIdentifier(viaSchema);

                // JOIN pivotTableName as pivot ON (parent.id = pivot.left_foreign_id)
                // JOIN target ON (target.id = pivot.target_foreign_id)
                // viaSchema.name
                const pivotToLeft = viaSchema.findReverseReference(
                    join.classSchema.classType,
                    join.propertySchema,
                );

                const pivotToRight = viaSchema.findReverseReference(
                    join.query.classSchema.classType,
                    join.propertySchema
                );

                const pivotName = this.platform.quoteIdentifier(prefix + '__p_' + join.propertySchema.name);

                const pivotClause: string[] = [];
                pivotClause.push(`${pivotName}.${this.platform.quoteIdentifier(pivotToLeft.name)} = ${parentName}.${this.platform.quoteIdentifier(join.classSchema.getPrimaryField().name)}`);

                const whereClause = this.getWhereSQL(join.query.classSchema, join.query.model.filter, joinName);
                if (whereClause) pivotClause.push(whereClause);

                joins.push(`${join.type.toUpperCase()} JOIN ${pivotTableName} AS ${pivotName} ON (${pivotClause.join(' AND ')})`);

                const onClause: string[] = [];
                onClause.push(`${pivotName}.${this.platform.quoteIdentifier(pivotToRight.name)} = ${joinName}.${this.platform.quoteIdentifier(join.query.classSchema.getPrimaryField().name)}`);
                joins.push(`${join.type.toUpperCase()} JOIN ${tableName} AS ${joinName} ON (${onClause.join(' AND ')})`);

                const moreJoins = this.getJoinSQL(join.query.model, joinName, prefix + '__' + join.propertySchema.name);
                if (moreJoins) joins.push(moreJoins);

                continue;
            }

            const onClause: string[] = [];
            if (join.propertySchema.backReference && !join.propertySchema.backReference.via) {
                const backReference = foreignSchema.findReverseReference(
                    join.classSchema.classType,
                    join.propertySchema,
                );
                onClause.push(`${parentName}.${this.platform.quoteIdentifier(join.classSchema.getPrimaryField().name)} = ${joinName}.${this.platform.quoteIdentifier(backReference.name)}`);
            } else {
                onClause.push(`${parentName}.${this.platform.quoteIdentifier(join.propertySchema.name)} = ${joinName}.${this.platform.quoteIdentifier(join.foreignPrimaryKey.name)}`);
            }

            const whereClause = this.getWhereSQL(join.query.classSchema, join.query.model.filter, joinName);
            if (whereClause) onClause.push(whereClause);

            joins.push(`${join.type.toUpperCase()} JOIN ${tableName} AS ${joinName} ON (${onClause.join(' AND ')})`);

            const moreJoins = this.getJoinSQL(join.query.model, joinName, prefix + '__' + join.propertySchema.name);
            if (moreJoins) joins.push(moreJoins);
        }

        return joins.join('\n');
    }

    public build<T>(schema: ClassSchema, model: SQLQueryModel<T>, head: string): string {
        const tableName = this.platform.getTableIdentifier(schema);
        const whereClause = this.getWhereSQL(schema, model.filter) || 'true';
        const joins = this.getJoinSQL(model, tableName);
        let sql = `${head} FROM ${tableName} ${joins} WHERE ${whereClause}`;

        if (model.limit !== undefined) sql += ' LIMIT ' + this.platform.quoteValue(model.limit);
        if (model.skip !== undefined) sql += ' SKIP ' + this.platform.quoteValue(model.skip);

        return sql;
    }

    public update<T>(schema: ClassSchema, model: SQLQueryModel<T>, set: string[]): string {
        const tableName = this.platform.getTableIdentifier(schema);
        const primaryKey = schema.getPrimaryField();
        const select = this.select(schema, model, {select: [primaryKey.name]});

        return `UPDATE ${tableName} SET ${set.join(', ')} WHERE ${this.platform.quoteIdentifier(primaryKey.name)} IN (SELECT * FROM (${select}) as __)`;
    }

    public select(
        schema: ClassSchema,
        model: SQLQueryModel<any>,
        options: { select?: string[] } = {}
    ): string {
        const manualSelect = options.select && options.select.length ? options.select : undefined;

        if (!manualSelect) {
            if (model.hasJoins()) {
                const map = this.selectColumnsWithJoins(schema, model);
                this.rootConverter = this.buildConverter(map.startIndex, map.fields);
            } else {
                this.selectColumns(schema, model);
            }
        }

        const order: string[] = [];
        if (model.sort) {
            for (const [name, sort] of Object.entries(model.sort)) {
                order.push(`${this.platform.quoteIdentifier(name)} ${sort}`);
            }
        }

        let sql = this.build(schema, model, 'SELECT ' + (manualSelect || this.sqlSelect).join(', '));

        if (order.length) {
            sql += ' ORDER BY ' + (order.join(', '));
        }

        return sql;
    }

}
