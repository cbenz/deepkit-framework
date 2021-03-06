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

import {DatabaseSession, Entity, GenericQuery} from '@deepkit/orm';
import {MongoQueryModel} from './query.model';
import {MongoQueryResolver} from './query.resolver';
import {ClassSchema} from '@deepkit/type';

export class MongoDatabaseQuery<T extends Entity,
    MODEL extends MongoQueryModel<T> = MongoQueryModel<T>> extends GenericQuery<T, MongoQueryResolver<T>> {
    protected resolver = new MongoQueryResolver(this.classSchema, this.databaseSession);

    constructor(classSchema: ClassSchema<T>, protected databaseSession: DatabaseSession<any>) {
        super(classSchema, databaseSession);
        if (!databaseSession.withIdentityMap) this.disableIdentityMap();
    }

}
