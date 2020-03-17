var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
import { createBddFromTruthTable } from './create-bdd-from-truth-table';
import { firstKeyOfMap, shuffleArray, lastOfArray } from './util';
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
export function optimizeBruteForce(_a) {
    var truthTable = _a.truthTable, _b = _a.iterations, iterations = _b === void 0 ? Infinity : _b, _c = _a.onBetterBdd, onBetterBdd = _c === void 0 ? function () { return null; } : _c, _d = _a.compareResults, compareResults = _d === void 0 ? defaultCompareResults : _d, _e = _a.afterBddCreation, afterBddCreation = _e === void 0 ? function () { return null; } : _e, _f = _a.log, log = _f === void 0 ? false : _f;
    var initialBdd = createBddFromTruthTable(truthTable);
    afterBddCreation(initialBdd);
    initialBdd.minimize();
    var currentBestResult = {
        truthTable: truthTable,
        bdd: initialBdd
    };
    if (log) {
        initialBdd.log();
        console.log('initial nodes amount: ' + initialBdd.countNodes());
    }
    var t = 0;
    var _loop_1 = function () {
        t++;
        if (log) {
            console.log('-'.repeat(50));
            console.log('optimizeBruteForce() itterate once');
        }
        var shuffledOrdering = shuffleBooleanOrdering(truthTable);
        var nextBdd = createBddFromTruthTable(shuffledOrdering.newTable);
        // change the levels of each node
        var newNodesByLevel = new Map();
        var lastLevel = lastOfArray(nextBdd.getLevels());
        var newSortedLevels = [];
        nextBdd.getLevels()
            .filter(function (level) { return level !== lastLevel; })
            .forEach(function (level) {
            var newLevel = shuffledOrdering.mappingBeforeToAfter[level];
            newSortedLevels.push(newLevel);
            var levelSet = new Set();
            newNodesByLevel.set(newLevel, levelSet);
            nextBdd.getNodesOfLevel(level).forEach(function (node) {
                node.level = newLevel;
                levelSet.add(node);
            });
        });
        var lastLevelSet = new Set();
        nextBdd.getNodesOfLevel(lastLevel).forEach(function (node) { return lastLevelSet.add(node); });
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
        var betterBdd = compareResults(currentBestResult.bdd, nextBdd);
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
    };
    while (t < iterations) {
        _loop_1();
    }
    return currentBestResult;
}
export function shuffleBooleanOrdering(truthTable) {
    var e_1, _a;
    var firstKey = firstKeyOfMap(truthTable);
    var arrayWithIndexes = getArrayWithIndexes(firstKey.length);
    var shuffled = shuffleArray(arrayWithIndexes);
    var mapping = {};
    var mappingBeforeToAfter = {};
    shuffled.forEach(function (indexBefore, indexAfter) {
        mapping[indexAfter] = indexBefore;
        mappingBeforeToAfter[indexBefore] = indexAfter;
    });
    var newTable = new Map();
    try {
        for (var _b = __values(truthTable.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), key = _d[0], value = _d[1];
            var newKey = changeKeyOrder(key, mapping);
            newTable.set(newKey, value);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return {
        newTable: newTable,
        mapping: mapping,
        mappingBeforeToAfter: mappingBeforeToAfter
    };
}
export function changeKeyOrder(oldKey, mappingBeforeToAfter) {
    var chars = oldKey
        .split('')
        .map(function (char, indexBefore) {
        return {
            char: char,
            indexBefore: indexBefore,
            indexAfter: mappingBeforeToAfter[indexBefore]
        };
    })
        .sort(function (a, b) { return a.indexAfter - b.indexAfter; })
        .map(function (charObj) { return charObj.char; })
        .join('');
    return chars;
}
export function getArrayWithIndexes(size) {
    var ret = [];
    var last = 0;
    while (last < size) {
        ret.push(last);
        last++;
    }
    return ret;
}
//# sourceMappingURL=optimize-brute-force.js.map