"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var util_1 = require("../util");
function resolveWithMinimalBdd(simpleBdd, fns, input) {
    var currentNode = simpleBdd;
    var currentLevel = 0;
    while (true) {
        var booleanResult = fns[currentLevel](input);
        var branchKey = util_1.booleanToBooleanString(booleanResult);
        currentNode = currentNode[branchKey];
        if (typeof currentNode === 'number' || typeof currentNode === 'string') {
            return currentNode;
        }
        else {
            currentLevel = currentNode.l;
        }
    }
}
exports.resolveWithMinimalBdd = resolveWithMinimalBdd;
//# sourceMappingURL=resolve-with-minimal-bdd.js.map