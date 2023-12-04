import { createBddFromTruthTable } from './create-bdd-from-truth-table.js';
import { firstKeyOfMap, shuffleArray, lastOfArray } from './util.js';
/**
 * returns the bdd with less nodes
 */
export const defaultCompareResults = function (a, b) {
    if (a.countNodes() <= b.countNodes()) {
        return a;
    }
    else {
        return b;
    }
};
/**
 * optimises the ordering of the boolean functions
 * by randomly sorting the array
 * and checking the resulting bdd
 */
export async function optimizeBruteForce({ truthTable, iterations = Infinity, onBetterBdd = () => null, compareResults = defaultCompareResults, afterBddCreation = () => null, initialBdd, log = false }) {
    initialBdd = initialBdd ? initialBdd : await createBddFromTruthTable(truthTable);
    afterBddCreation(initialBdd);
    initialBdd.minimize();
    let currentBestResult = {
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
        const newNodesByLevel = new Map();
        const lastLevel = lastOfArray(nextBdd.getLevels());
        const newSortedLevels = [];
        nextBdd.getLevels()
            .filter(level => level !== lastLevel)
            .forEach(level => {
            const newLevel = shuffledOrdering.mappingBeforeToAfter[level];
            newSortedLevels.push(newLevel);
            const levelSet = new Set();
            newNodesByLevel.set(newLevel, levelSet);
            nextBdd.getNodesOfLevel(level).forEach(node => {
                node.level = newLevel;
                levelSet.add(node);
            });
        });
        const lastLevelSet = new Set();
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
        const betterBdd = await compareResults(currentBestResult.bdd, nextBdd);
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
export function shuffleBooleanOrdering(truthTable) {
    const firstKey = firstKeyOfMap(truthTable);
    const arrayWithIndexes = getArrayWithIndexes(firstKey.length);
    const shuffled = shuffleArray(arrayWithIndexes);
    const mapping = {};
    const mappingBeforeToAfter = {};
    shuffled.forEach((indexBefore, indexAfter) => {
        mapping[indexAfter] = indexBefore;
        mappingBeforeToAfter[indexBefore] = indexAfter;
    });
    const newTable = new Map();
    for (const [key, value] of truthTable.entries()) {
        const newKey = changeKeyOrder(key, mapping);
        newTable.set(newKey, value);
    }
    return {
        newTable,
        mapping,
        mappingBeforeToAfter
    };
}
export function changeKeyOrder(oldKey, mappingBeforeToAfter) {
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
export function getArrayWithIndexes(size) {
    const ret = [];
    let last = 0;
    while (last < size) {
        ret.push(last);
        last++;
    }
    return ret;
}
//# sourceMappingURL=optimize-brute-force.js.map