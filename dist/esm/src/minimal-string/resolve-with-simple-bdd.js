import { booleanToBooleanString } from '../util.js';
export function resolveWithSimpleBdd(simpleBdd, fns, input) {
    let currentNode = simpleBdd;
    let currentLevel = simpleBdd.l;
    while (true) {
        const booleanResult = fns[currentLevel](input);
        const branchKey = booleanToBooleanString(booleanResult);
        currentNode = currentNode[branchKey];
        if (typeof currentNode === 'number' || typeof currentNode === 'string') {
            return currentNode;
        }
        else {
            currentLevel = currentNode.l;
        }
    }
}
//# sourceMappingURL=resolve-with-simple-bdd.js.map