import * as fs from 'fs';
import * as path from 'path';

import { TruthTable, ResolverFunctions } from '../../src/types';
import { fillTruthTable } from '../../src/fill-truth-table';
import {
    maxBinaryWithLength,
    binaryToDecimal,
    decimalToPaddedBinary,
    booleanStringToBoolean
} from '../../src/util';
import { randomBoolean } from 'async-test-util';

export function readJsonFile(filePath: string): any {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

export function objectToMap<K, V>(object: {
    [k: string]: V
}): Map<K, V> {
    const ret = new Map();
    Object.entries(object).forEach(([k, v]) => {
        ret.set(k, v);
    });
    return ret;
}

export const UNKNOWN = 42;

export function exampleTruthTable(
    stateLength: number = 3
): TruthTable {
    let lastId = 0;
    const ret: TruthTable = new Map();
    const maxBin = maxBinaryWithLength(stateLength);
    const maxDecimal = binaryToDecimal(maxBin);

    const end = maxDecimal;
    let start = 0;
    while (start <= end) {
        ret.set(
            decimalToPaddedBinary(start, stateLength),
            lastId++
        );
        start++;
    }
    return ret;
}

export function allEqualTable(
    stateLength: number = 3
): TruthTable {
    const table = exampleTruthTable(stateLength);
    const keys = Array.from(table.keys());
    keys.forEach(k => table.set(k, 1));
    return table;
}

export function randomTable(
    stateLength: number = 3
): TruthTable {
    const table = exampleTruthTable(stateLength);
    const keys = Array.from(table.keys());
    keys.forEach(k => {
        // '2' is more often then '1'
        const val = (randomBoolean() && randomBoolean()) ? 1 : 2;
        table.set(k, val);
    });
    return table;
}

export function randomUnknownTable(
    stateLength: number = 3
): TruthTable {
    const table = exampleTruthTable(stateLength);
    for (const [key, value] of table.entries()) {
        if (randomBoolean()) {
            table.set(key, UNKNOWN);
        }
    }
    return table;
}

export function getBigTruthTable(): TruthTable {
    const json = readJsonFile(
        path.join(__dirname, 'big-truth-table.json')
    );
    const table = objectToMap(json) as TruthTable;
    const firstKey = table.keys().next().value;
    const keyLength = firstKey.length;

    fillTruthTable(table, keyLength, UNKNOWN);
    return table;
}

export function getResolverFunctions(size: number, log: boolean = false): ResolverFunctions {
    const resolvers: ResolverFunctions = {};
    new Array(size).fill(0).forEach((_x, index) => {
        const fn = (state: string) => {
            const ret = booleanStringToBoolean((state as any)[index]);
            if (log) {
                console.log('called resolver function with index ' + index + ' returned ' + ret);
            }
            return ret;
        };
        resolvers[index] = fn;
    });
    return resolvers;
}
