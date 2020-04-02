"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
exports.defaultCompareResults = function (a, b) {
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
function optimizeBruteForce(_a) {
    var truthTable = _a.truthTable, _b = _a.iterations, iterations = _b === void 0 ? Infinity : _b, _c = _a.onBetterBdd, onBetterBdd = _c === void 0 ? function () { return null; } : _c, _d = _a.compareResults, compareResults = _d === void 0 ? exports.defaultCompareResults : _d, _e = _a.afterBddCreation, afterBddCreation = _e === void 0 ? function () { return null; } : _e, _f = _a.log, log = _f === void 0 ? false : _f;
    return __awaiter(this, void 0, void 0, function () {
        var initialBdd, currentBestResult, t, _loop_1;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    initialBdd = create_bdd_from_truth_table_1.createBddFromTruthTable(truthTable);
                    afterBddCreation(initialBdd);
                    initialBdd.minimize();
                    currentBestResult = {
                        truthTable: truthTable,
                        bdd: initialBdd
                    };
                    if (log) {
                        initialBdd.log();
                        console.log('initial nodes amount: ' + initialBdd.countNodes());
                    }
                    t = 0;
                    _loop_1 = function () {
                        var shuffledOrdering, nextBdd, newNodesByLevel, lastLevel, newSortedLevels, lastLevelSet, betterBdd;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    t++;
                                    if (log) {
                                        console.log('-'.repeat(50));
                                        console.log('optimizeBruteForce() itterate once');
                                    }
                                    shuffledOrdering = shuffleBooleanOrdering(truthTable);
                                    nextBdd = create_bdd_from_truth_table_1.createBddFromTruthTable(shuffledOrdering.newTable);
                                    newNodesByLevel = new Map();
                                    lastLevel = util_1.lastOfArray(nextBdd.getLevels());
                                    newSortedLevels = [];
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
                                    lastLevelSet = new Set();
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
                                    return [4 /*yield*/, compareResults(currentBestResult.bdd, nextBdd)];
                                case 1:
                                    betterBdd = _a.sent();
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
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _g.label = 1;
                case 1:
                    if (!(t < iterations)) return [3 /*break*/, 3];
                    return [5 /*yield**/, _loop_1()];
                case 2:
                    _g.sent();
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/, currentBestResult];
            }
        });
    });
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