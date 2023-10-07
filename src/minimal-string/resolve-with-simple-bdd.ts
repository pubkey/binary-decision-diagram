import {
    SimpleBdd,
    ResolverFunctions,
    SimpleBddLeafNode
} from '../types.js';
import { booleanToBooleanString } from '../util.js';

export function resolveWithSimpleBdd(
    simpleBdd: SimpleBdd,
    fns: ResolverFunctions,
    input: any
): number {
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
    }
}
