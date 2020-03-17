import { minBinaryWithLength, maxBinaryWithLength, getNextStateSet } from './util';
/**
 * fills each missing row of a table
 * with the given value
 */
export function fillTruthTable(truthTable, inputLength, value) {
    var endInput = maxBinaryWithLength(inputLength);
    var currentInput = minBinaryWithLength(inputLength);
    var done = false;
    while (!done) {
        if (!truthTable.has(currentInput)) {
            truthTable.set(currentInput, value);
        }
        if (currentInput === endInput) {
            done = true;
        }
        else {
            currentInput = getNextStateSet(currentInput);
        }
    }
}
//# sourceMappingURL=fill-truth-table.js.map