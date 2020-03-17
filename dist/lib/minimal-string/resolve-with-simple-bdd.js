"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var util_1 = require("../util");
function resolveWithSimpleBdd(simpleBdd, fns, input) {
    var currentNode = simpleBdd;
    var currentLevel = simpleBdd.l;
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
exports.resolveWithSimpleBdd = resolveWithSimpleBdd;
//# sourceMappingURL=resolve-with-simple-bdd.js.map