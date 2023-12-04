import type { TruthTable } from './types.js';
import { RootNode } from './root-node.js';
import { createBddFromTruthTable } from './create-bdd-from-truth-table.js';
import { firstKeyOfMap, shuffleArray, lastOfArray } from './util.js';
import { AbstractNode } from './abstract-node.js';

/**
 * a function that is called each time
 * a 'better' bdd was found
 */
export type OptmisiationCallback = (bdd: OptimisationResult) => void;

export interface OptimisationResult {
    bdd: RootNode;
    truthTable: TruthTable;
}

export type CompareResultsFunction = (a: RootNode, b: RootNode) => RootNode | Promise<RootNode>;

/**
 * returns the bdd with less nodes
 */
export const defaultCompareResults: CompareResultsFunction = function (
    a: RootNode,
    b: RootNode
): RootNode {
    if (a.countNodes() <= b.countNodes()) {
        return a;
    } else {
        return b;
    }
};

export interface OptimizeBruteForceInput {
    truthTable: TruthTable;
    iterations?: number;
    onBetterBdd?: OptmisiationCallback;
    // a function that returns the 'better' bdd
    compareResults?: CompareResultsFunction;
    afterBddCreation?: (bdd: RootNode) => void;
    initialBdd?: RootNode;
    log?: boolean;
}

/**
 * optimises the ordering of the boolean functions
 * by randomly sorting the array
 * and checking the resulting bdd
 */
export async function optimizeBruteForce({
    truthTable,
    iterations = Infinity,
    onBetterBdd = () => null,
    compareResults = defaultCompareResults,
    afterBddCreation = () => null,
    initialBdd,
    log = false
}: OptimizeBruteForceInput): Promise<OptimisationResult> {
    initialBdd = initialBdd ? initialBdd : await createBddFromTruthTable(truthTable);
    afterBddCreation(initialBdd);
    initialBdd.minimize();
    let currentBestResult: OptimisationResult = {
        truthTable,
        bdd: initialBdd
    };
    onBetterBdd(currentBestResult);

    if (log) {
        initialBdd.log();
        console.log('initial nodes amount: ' + initialBdd.countNodes());
    }

    let t = 0;
    while (t < iterations) {
        t++;

        if (log) {
            console.log('-'.repeat(50));
            console.log('optimizeBruteForce() itterate once');
        }
        const shuffledOrdering = shuffleBooleanOrdering(truthTable);
        const nextBdd = createBddFromTruthTable(shuffledOrdering.newTable);

        // change the levels of each node
        const newNodesByLevel: Map<number, Set<AbstractNode>> = new Map();
        const lastLevel = lastOfArray(nextBdd.getLevels());
        const newSortedLevels: number[] = [];
        nextBdd.getLevels()
            .filter(level => level !== lastLevel)
            .forEach(level => {
                const newLevel = shuffledOrdering.mappingBeforeToAfter[level];
                newSortedLevels.push(newLevel);
                const levelSet: Set<AbstractNode> = new Set();
                newNodesByLevel.set(newLevel, levelSet);
                nextBdd.getNodesOfLevel(level).forEach(node => {
                    node.level = newLevel;
                    levelSet.add(node);
                });
            });
        const lastLevelSet: Set<AbstractNode> = new Set();
        nextBdd.getNodesOfLevel(lastLevel).forEach(node => lastLevelSet.add(node));
        newNodesByLevel.set(lastLevel, lastLevelSet);
        newSortedLevels.push(lastLevel);
        nextBdd.nodesByLevel = newNodesByLevel;
        nextBdd.levels = newSortedLevels;

        afterBddCreation(nextBdd);
        nextBdd.minimize();

        if (log) {
            console.log('got new bdd with nodes amount of ' + nextBdd.countNodes());
            //            nextBdd.log();
            console.dir(shuffledOrdering.mappingBeforeToAfter);
        }

        const betterBdd = await compareResults(
            currentBestResult.bdd,
            nextBdd
        );
        if (betterBdd.type !== 'RootNode') {
            throw new Error('compareResults did not return a bdd');
        }

        if (betterBdd === nextBdd) {
            if (log) {
                console.log('#'.repeat(50));
                console.log('found better bdd ' + nextBdd.countNodes());
            }

            currentBestResult = {
                bdd: nextBdd,
                truthTable: shuffledOrdering.newTable
            };
            onBetterBdd(currentBestResult);
        }
    }


    return currentBestResult;
}


export type BooleanFunctionReorderMapping = {
    [indexAfter: number]: number; // to indexBefore
};

export type BooleanFunctionReorderMappingReverse = {
    [indexBefore: number]: number; // to indexAfter
};

export function shuffleBooleanOrdering(
    truthTable: TruthTable
): {
    newTable: TruthTable,
    mapping: BooleanFunctionReorderMapping,
    mappingBeforeToAfter: BooleanFunctionReorderMappingReverse
} {
    const firstKey = firstKeyOfMap(truthTable);
    const arrayWithIndexes = getArrayWithIndexes(firstKey.length);
    const shuffled = shuffleArray(arrayWithIndexes);

    const mapping: BooleanFunctionReorderMapping = {};
    const mappingBeforeToAfter: BooleanFunctionReorderMappingReverse = {};
    shuffled.forEach((indexBefore, indexAfter) => {
        mapping[indexAfter] = indexBefore;
        mappingBeforeToAfter[indexBefore] = indexAfter;
    });

    const newTable: TruthTable = new Map();
    for (const [key, value] of truthTable.entries()) {
        const newKey = changeKeyOrder(
            key,
            mapping
        );
        newTable.set(
            newKey,
            value
        );
    }

    return {
        newTable,
        mapping,
        mappingBeforeToAfter
    };
}

export function changeKeyOrder(
    oldKey: string,
    mappingBeforeToAfter: BooleanFunctionReorderMapping
): string {
    const chars = oldKey
        .split('')
        .map((char, indexBefore) => {
            return {
                char,
                indexBefore,
                indexAfter: mappingBeforeToAfter[indexBefore]
            };
        })
        .sort((a, b) => a.indexAfter - b.indexAfter)
        .map(charObj => charObj.char)
        .join('');
    return chars;
}

export function getArrayWithIndexes(size: number): number[] {
    const ret: number[] = [];
    let last = 0;
    while (last < size) {
        ret.push(last);
        last++;
    }
    return ret;
}
