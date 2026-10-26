import type { TruthTable } from '../types.js';

/**
 * A truth table stored as a flat array of terminal ids.
 *
 * Row index: parseInt(key, 2). The first character of a key
 * (= boolean function 0) is the most significant bit of the row index,
 * so variable v corresponds to bit (variableCount - 1 - v).
 *
 * Values are mapped to small consecutive "terminal ids" so that the
 * hot loops only ever compare 32-bit integers.
 */
export interface DenseTruthTable {
    /** amount of boolean functions, equals the key length of the truth table */
    variableCount: number;
    /** 2^variableCount */
    rowCount: number;
    /** terminal id of each row */
    terminalIds: Int32Array;
    /** terminal id -> value of the truth table */
    terminalValues: number[];
    /** terminal id of the don't-care value, -1 when there is none */
    dontCareTerminal: number;
    /** amount of leaf nodes the final BDD will have */
    leafCount: number;
}

/**
 * The hard limit of variables. Row indexes are handled with 32 bit integer
 * operations and a table with 2^30 rows would need gigabytes of memory anyway.
 */
export const MAX_VARIABLE_COUNT = 30;

export function parseTruthTable(
    truthTable: TruthTable,
    dontCareValue?: number
): DenseTruthTable {
    if (truthTable.size === 0) {
        throw new Error('truth table is empty');
    }
    const firstKey: string = truthTable.keys().next().value as string;
    const variableCount = firstKey.length;
    if (variableCount < 1 || variableCount > MAX_VARIABLE_COUNT) {
        throw new Error('truth table keys must have between 1 and ' + MAX_VARIABLE_COUNT + ' characters');
    }
    const rowCount = Math.pow(2, variableCount);
    if (truthTable.size !== rowCount) {
        throw new Error('truth table has missing entries');
    }

    const terminalIds = new Int32Array(rowCount).fill(-1);
    const terminalValues: number[] = [];
    const idByValue: Map<number, number> = new Map();
    truthTable.forEach((value, key) => {
        if (key.length !== variableCount || !/^[01]+$/.test(key)) {
            throw new Error('invalid truth table key ' + key);
        }
        const row = parseInt(key, 2);
        if (terminalIds[row] !== -1) {
            throw new Error('duplicate truth table key ' + key);
        }
        let id = idByValue.get(value);
        if (id === undefined) {
            id = terminalValues.length;
            terminalValues.push(value);
            idByValue.set(value, id);
        }
        terminalIds[row] = id;
    });

    let dontCareTerminal = -1;
    if (dontCareValue !== undefined) {
        const dcId = idByValue.get(dontCareValue);
        if (dcId !== undefined) {
            dontCareTerminal = dcId;
        }
    }
    const leafCount = terminalValues.length - (dontCareTerminal >= 0 ? 1 : 0);
    if (leafCount === 0) {
        throw new Error('truth table only consists of don\'t-care rows');
    }

    return {
        variableCount,
        rowCount,
        terminalIds,
        terminalValues,
        dontCareTerminal,
        leafCount
    };
}

/**
 * Creates a dense table with the same terminal values
 * but other row contents, for example after don't-care rows have been resolved.
 */
export function withTerminalIds(
    table: DenseTruthTable,
    terminalIds: Int32Array,
    dontCareTerminal: number
): DenseTruthTable {
    let leafCount = 0;
    const seen = new Uint8Array(table.terminalValues.length);
    for (let i = 0; i < terminalIds.length; i++) {
        const id = terminalIds[i];
        if (seen[id] === 0) {
            seen[id] = 1;
            if (id !== dontCareTerminal) {
                leafCount++;
            }
        }
    }
    if (leafCount === 0) {
        leafCount = 1;
    }
    return {
        variableCount: table.variableCount,
        rowCount: table.rowCount,
        terminalIds,
        terminalValues: table.terminalValues,
        dontCareTerminal,
        leafCount
    };
}

/**
 * Converts the dense table back into a Map with keys in the original order.
 */
export function denseTruthTableToMap(table: DenseTruthTable): TruthTable {
    const ret: TruthTable = new Map();
    const n = table.variableCount;
    for (let row = 0; row < table.rowCount; row++) {
        ret.set(
            row.toString(2).padStart(n, '0'),
            table.terminalValues[table.terminalIds[row]]
        );
    }
    return ret;
}

export function naturalOrdering(variableCount: number): number[] {
    const ret: number[] = [];
    for (let i = 0; i < variableCount; i++) {
        ret.push(i);
    }
    return ret;
}

export function ensureValidOrdering(ordering: ArrayLike<number>, variableCount: number) {
    if (ordering.length !== variableCount) {
        throw new Error('ordering must contain each of the ' + variableCount + ' boolean functions exactly once');
    }
    const seen = new Uint8Array(variableCount);
    for (let i = 0; i < ordering.length; i++) {
        const v = ordering[i];
        if (!Number.isInteger(v) || v < 0 || v >= variableCount || seen[v] === 1) {
            throw new Error('ordering must contain each of the ' + variableCount + ' boolean functions exactly once');
        }
        seen[v] = 1;
    }
}
