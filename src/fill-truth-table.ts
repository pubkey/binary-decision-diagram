import {
    minBinaryWithLength,
    maxBinaryWithLength,
    getNextStateSet
} from './util.js';
import type { TruthTable } from './types.js';

/**
 * fills each missing row of a table
 * with the given value
 */
export function fillTruthTable(
    truthTable: TruthTable,
    inputLength: number,
    value: number
) {
    const endInput = maxBinaryWithLength(inputLength);
    let currentInput = minBinaryWithLength(inputLength);
    let done = false;
    while (!done) {
        if (!truthTable.has(currentInput)) {
            truthTable.set(
                currentInput,
                value
            );
        }
        if (currentInput === endInput) {
            done = true;
        } else {
            currentInput = getNextStateSet(
                currentInput
            );
        }
    }
}
