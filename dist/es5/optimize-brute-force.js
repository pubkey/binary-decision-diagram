"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var create_bdd_from_truth_table_1 = require("./create-bdd-from-truth-table");
var util_1 = require("./util");
/**
 * returns the bdd with less nodes
 */
function defaultCompareResults(a, b) {
    if (a.countNodes() <= b.countNodes()) {
        return a;
    }
    else {
        return b;
    }
}
exports.defaultCompareResults = defaultCompareResults;
/**
 * optimises the ordering of the boolean functions
 * by randomly sorting the array
 * and checking the resulting bdd
 */
function optimizeBruteForce(_a) {
    var truthTable = _a.truthTable, _b = _a.itterations, itterations = _b === void 0 ? Infinity : _b, _c = _a.onBetterBdd, onBetterBdd = _c === void 0 ? function () { return null; } : _c, _d = _a.compareResults, compareResults = _d === void 0 ? defaultCompareResults : _d, _e = _a.afterBddCreation, afterBddCreation = _e === void 0 ? function () { return null; } : _e;
    var initialBdd = create_bdd_from_truth_table_1.createBddFromTruthTable(truthTable);
    afterBddCreation(initialBdd);
    initialBdd.minimize();
    var currentBestResult = {
        truthTable: truthTable,
        bdd: initialBdd
    };
    initialBdd.log();
    console.log('initial nodes amount: ' + initialBdd.countNodes());
    var t = 0;
    while (t < itterations) {
        t++;
        console.log('-'.repeat(50));
        console.log('optimizeBruteForce() itterate once');
        var shuffledOrdering = shuffleBooleanOrdering(truthTable);
        var nextBdd = create_bdd_from_truth_table_1.createBddFromTruthTable(shuffledOrdering.newTable);
        afterBddCreation(nextBdd);
        nextBdd.minimize();
        console.log('got new bdd with nodes amount of ' + nextBdd.countNodes());
        //        nextBdd.log();
        var betterBdd = compareResults(currentBestResult.bdd, nextBdd);
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
exports.optimizeBruteForce = optimizeBruteForce;
function shuffleBooleanOrdering(truthTable) {
    var e_1, _a;
    var firstKey = util_1.firstKeyOfMap(truthTable);
    var arrayWithIndexes = getArrayWithIndexes(firstKey.length);
    var shuffled = util_1.shuffleArray(arrayWithIndexes);
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
            var newKey = changeKeyOrder(key, mappingBeforeToAfter);
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
        mapping: mapping
    };
}
exports.shuffleBooleanOrdering = shuffleBooleanOrdering;
function changeKeyOrder(oldKey, mappingBeforeToAfter) {
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
exports.changeKeyOrder = changeKeyOrder;
function getArrayWithIndexes(size) {
    var ret = [];
    var last = 0;
    while (last < size) {
        ret.push(last);
        last++;
    }
    return ret;
}
exports.getArrayWithIndexes = getArrayWithIndexes;
//# sourceMappingURL=optimize-brute-force.js.map