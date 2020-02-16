import { booleanToBooleanString } from '../util';
export function resolveWithMinimalBdd(simpleBdd, fns, input) {
    let currentNode = simpleBdd;
    let currentLevel = 0;
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
//# sourceMappingURL=resolve-with-minimal-bdd.js.map