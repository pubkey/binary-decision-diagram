"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillTruthTable = void 0;
var util_1 = require("./util");
/**
 * fills each missing row of a table
 * with the given value
 */
function fillTruthTable(truthTable, inputLength, value) {
    var endInput = (0, util_1.maxBinaryWithLength)(inputLength);
    var currentInput = (0, util_1.minBinaryWithLength)(inputLength);
    var done = false;
    while (!done) {
        if (!truthTable.has(currentInput)) {
            truthTable.set(currentInput, value);
        }
        if (currentInput === endInput) {
            done = true;
        }
        else {
            currentInput = (0, util_1.getNextStateSet)(currentInput);
        }
    }
}
exports.fillTruthTable = fillTruthTable;
//# sourceMappingURL=fill-truth-table.js.map