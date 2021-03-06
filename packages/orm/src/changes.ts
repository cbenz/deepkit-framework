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

import {empty} from '@deepkit/core';

export type NumberFields<T> = { [K in keyof T]: T[K] extends number | bigint ? K : never }[keyof T]
export type Expression<T> = { [P in keyof T & string]?: string; }
export type Partial<T> = { [P in keyof T & string]?: T[P] }
export type Unset<T> = { [P in keyof T & string]?: 1 | 0 }

export interface ChangesInterface<T> {
    $set?: Partial<T> | T;
    $unset?: Unset<T>;
    $inc?: Partial<Pick<T, NumberFields<T>>>;
}

export class Changes<T> {
    $set?: Partial<T> | T;
    $unset?: Unset<T>;
    $inc?: Partial<Pick<T, NumberFields<T>>>;
    empty = true;

    constructor(
        {$set, $unset, $inc}: ChangesInterface<T> = {}
    ) {
        this.$set = empty($set) ? undefined : $set;
        this.$unset = empty($unset) ? undefined : $unset;
        this.$inc = empty($inc) ? undefined : $inc;
        this.detectEmpty();
    }

    getReturning(): string[] {
        const names: string[] = [];

        if (this.$inc) {
            for (const i in this.$inc) if (this.$inc.hasOwnProperty(i)) names.push(i);
        }

        return names;
    }

    protected detectEmpty() {
        this.empty = this.$set === undefined && this.$unset === undefined && this.$inc === undefined;
    }

    replaceSet($set: Partial<T> | T) {
        this.$set = empty($set) ? undefined : $set;
        this.detectEmpty();
    }

    increase(property: NumberFields<T>, increase: number = 1) {
        if (!this.$inc) this.$inc = {};
        (this.$inc as any)[property] = increase;
        this.empty = false;
    }

    set(property: keyof T & string, value: any) {
        if (!this.$set) this.$set = {};
        (this.$set as any)[property] = value;
        this.empty = false;
    }

    unset(property: keyof T & string, unset = true) {
        if (!this.$unset) this.$unset = {};
        (this.$unset as any)[property] = unset;
        this.empty = false;
    }

    has(name: keyof T & string): boolean {
        return Boolean((this.$set && name in this.$set) || (this.$unset && name in this.$unset) || (this.$inc && name in this.$inc));
    }
}

export class ItemChanges<T> extends Changes<T> {
    constructor(
        changes: ChangesInterface<T> = {},
        protected item: T
    ) {
        super(changes);
    }

    increase(property: NumberFields<T>, increase: number = 1) {
        super.increase(property, increase);
        (this.item as any)[property] += increase;
    }

    set(property: keyof T & string, value: any) {
        super.set(property, value);
        (this.item as any)[property] = value;
    }

    unset(property: keyof T & string, unset: boolean = true) {
        super.unset(property, unset);
        (this.item as any)[property] = undefined;
    }
}


export const changeSetSymbol = Symbol('changeSet');

export class AtomicChangeInstance<T> {
    public readonly changeSet: Changes<T> = new Changes<T>();

    constructor(protected object: any) {
        this.changeSet.$inc = {};
        (object as any)[changeSetSymbol] = this.changeSet;
    }

    increase(property: NumberFields<T>, increase: number = 1) {
        this.object[property] += increase;
        (this.changeSet.$inc as any)[property] = increase as any;
    }
}

export function atomicChange<T>(object: T) {
    return new AtomicChangeInstance<T>(object);
}
