import { createBddFromTruthTable } from './create-bdd-from-truth-table';
import { firstKeyOfMap, shuffleArray } from './util';
/**
 * returns the bdd with less nodes
 */
export function defaultCompareResults(a, b) {
    if (a.countNodes() <= b.countNodes()) {
        return a;
    }
    else {
        return b;
    }
}
/**
 * optimises the ordering of the boolean functions
 * by randomly sorting the array
 * and checking the resulting bdd
 */
export function optimizeBruteForce({ truthTable, itterations = Infinity, onBetterBdd = () => null, compareResults = defaultCompareResults, afterBddCreation = () => null }) {
    const initialBdd = createBddFromTruthTable(truthTable);
    afterBddCreation(initialBdd);
    initialBdd.minimize();
    let currentBestResult = {
        truthTable,
        bdd: initialBdd
    };
    initialBdd.log();
    console.log('initial nodes amount: ' + initialBdd.countNodes());
    let t = 0;
    while (t < itterations) {
        t++;
        console.log('-'.repeat(50));
        console.log('optimizeBruteForce() itterate once');
        const shuffledOrdering = shuffleBooleanOrdering(truthTable);
        const nextBdd = createBddFromTruthTable(shuffledOrdering.newTable);
        afterBddCreation(nextBdd);
        nextBdd.minimize();
        console.log('got new bdd with nodes amount of ' + nextBdd.countNodes());
        //        nextBdd.log();
        const betterBdd = compareResults(currentBestResult.bdd, nextBdd);
        if (betterBdd === nextBdd) {
            console.log('#'.repeat(50));
            console.log('found better bdd ' + nextBdd.countNodes());
            currentBestResult = {
                bdd: nextBdd,
                truthTable: shuffledOrdering.newTable,
                mapping: shuffledOrdering.mapping
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
        const newKey = changeKeyOrder(key, mappingBeforeToAfter);
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