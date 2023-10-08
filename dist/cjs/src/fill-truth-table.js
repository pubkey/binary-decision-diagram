"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillTruthTable = void 0;
const util_js_1 = require("./util.js");
/**
 * fills each missing row of a table
 * with the given value
 */
function fillTruthTable(truthTable, inputLength, value) {
    const endInput = (0, util_js_1.maxBinaryWithLength)(inputLength);
    let currentInput = (0, util_js_1.minBinaryWithLength)(inputLength);
    let done = false;
    while (!done) {
        if (!truthTable.has(currentInput)) {
            truthTable.set(currentInput, value);
        }
        if (currentInput === endInput) {
            done = true;
        }
        else {
            currentInput = (0, util_js_1.getNextStateSet)(currentInput);
        }
    }
}
exports.fillTruthTable = fillTruthTable;
//# sourceMappingURL=fill-truth-table.js.map