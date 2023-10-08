"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWithSimpleBdd = void 0;
const util_js_1 = require("../util.js");
function resolveWithSimpleBdd(simpleBdd, fns, input) {
    let currentNode = simpleBdd;
    let currentLevel = simpleBdd.l;
    while (true) {
        const booleanResult = fns[currentLevel](input);
        const branchKey = (0, util_js_1.booleanToBooleanString)(booleanResult);
        currentNode = currentNode[branchKey];
        if (typeof currentNode === 'number' || typeof currentNode === 'string') {
            return currentNode;
        }
        else {
            currentLevel = currentNode.l;
        }
    }
}
exports.resolveWithSimpleBdd = resolveWithSimpleBdd;
//# sourceMappingURL=resolve-with-simple-bdd.js.map