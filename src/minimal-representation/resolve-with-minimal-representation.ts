import type {
    ResolverFunctions,
    MinimalRepresentation
} from '../types';

export function resolveWithMinimalRepresentation(
    minimalRepresentation: MinimalRepresentation,
    fns: ResolverFunctions,
    input: any
): number {

    console.dir(minimalRepresentation);

    const length = minimalRepresentation.length;
    const maxValue: number = minimalRepresentation[length - 2];
    const maxLevel: number = minimalRepresentation[length - 3];
    const indexAdd = maxLevel + maxValue;
    const entrypoint: number = minimalRepresentation[length - 1] - indexAdd;


    minimalRepresentation.forEach((nr, i) => {
        console.log(i + ': ' + nr);
    });

    console.dir(fns);
    console.log('entrypoint: ' + entrypoint);
    console.log('maxValue: ' + maxValue);
    console.log('maxLevel: ' + maxLevel);

    console.log('indexAdd: ' + indexAdd);

    let currentIndex = entrypoint;
    while (true) {

        console.log('-----------------------------------');

        console.log('currentIndex: ' + currentIndex);

        const currentLevel = minimalRepresentation[currentIndex];

        console.log('currentLevel: ' + currentLevel);

        const booleanResult = fns[currentLevel](input);
        console.log('booleanResult: ' + booleanResult);
        const nextIndex = (booleanResult ? currentIndex + 2 : currentIndex + 1);
        console.log('nextIndex: ' + nextIndex);
        currentIndex = minimalRepresentation[nextIndex] - indexAdd;
        console.log('new currentIndex: ' + currentIndex);

        if (currentIndex <= indexAdd) {
            const ret = currentIndex - maxLevel;
            console.log('ret: ' + ret);
            return ret;
        } else {
        }
    }

    /*
    let currentNode: SimpleBdd | SimpleBddLeafNode = simpleBdd;
    let currentLevel: number = simpleBdd.l;
    while (true) {
        const booleanResult = fns[currentLevel](input);
        const branchKey = booleanToBooleanString(booleanResult);
        currentNode = currentNode[branchKey];
        if (typeof currentNode === 'number' || typeof currentNode === 'string') {
            return currentNode as any;
        } else {
            currentLevel = currentNode.l;
        }
    }*/
}
