import {
    SimpleBdd,
    ResolverFunctions,
    SimpleBddLeafNode
} from '../types.js';

export function resolveWithSimpleBdd(
    simpleBdd: SimpleBdd,
    fns: ResolverFunctions,
    input: any
): number {
    let currentNode: SimpleBdd | SimpleBddLeafNode = simpleBdd;
    let currentLevel: number = simpleBdd.l;
    while (true) {
        const booleanResult: boolean = fns[currentLevel](input);
        currentNode = currentNode[booleanResult ? '1' : '0'];
        if (typeof currentNode === 'number' || typeof currentNode === 'string') {
            return currentNode as any;
        } else {
            currentLevel = currentNode.l;
        }
    }
}
