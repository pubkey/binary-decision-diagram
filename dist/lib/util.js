"use strict";
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
function booleanStringToBoolean(str) {
    if (str === '1') {
        return true;
    }
    else {
        return false;
    }
}
exports.booleanStringToBoolean = booleanStringToBoolean;
function booleanToBooleanString(b) {
    if (b) {
        return '1';
    }
    else {
        return '0';
    }
}
exports.booleanToBooleanString = booleanToBooleanString;
function oppositeBoolean(input) {
    if (input === '1') {
        return '0';
    }
    else {
        return '1';
    }
}
exports.oppositeBoolean = oppositeBoolean;
function lastChar(str) {
    return str.slice(-1);
}
exports.lastChar = lastChar;
/**
 * @link https://stackoverflow.com/a/1349426
 */
function makeid(length) {
    if (length === void 0) { length = 6; }
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
var nodeIdPrefix = makeid(4);
var lastIdGen = 0;
function nextNodeId() {
    var ret = 'node_' + nodeIdPrefix + '_' + lastIdGen;
    lastIdGen++;
    return ret;
}
exports.nextNodeId = nextNodeId;
/**
 * @link https://stackoverflow.com/a/16155417
 */
function decimalToPaddedBinary(decimal, padding) {
    var binary = (decimal >>> 0).toString(2);
    var padded = binary.padStart(padding, '0');
    return padded;
}
exports.decimalToPaddedBinary = decimalToPaddedBinary;
function oppositeBinary(i) {
    if (i === '1') {
        return '0';
    }
    else if (i === '0') {
        return '1';
    }
    else {
        throw new Error('non-binary given');
    }
}
exports.oppositeBinary = oppositeBinary;
function binaryToDecimal(binary) {
    return parseInt(binary, 2);
}
exports.binaryToDecimal = binaryToDecimal;
function minBinaryWithLength(length) {
    return new Array(length).fill(0).map(function () { return '0'; }).join('');
}
exports.minBinaryWithLength = minBinaryWithLength;
function maxBinaryWithLength(length) {
    return new Array(length).fill(0).map(function () { return '1'; }).join('');
}
exports.maxBinaryWithLength = maxBinaryWithLength;
function getNextStateSet(stateSet) {
    var decimal = binaryToDecimal(stateSet);
    var increase = decimal + 1;
    var binary = decimalToPaddedBinary(increase, stateSet.length);
    return binary;
}
exports.getNextStateSet = getNextStateSet;
function firstKeyOfMap(map) {
    var iterator1 = map.keys();
    return iterator1.next().value;
}
exports.firstKeyOfMap = firstKeyOfMap;
/**
 * Shuffles array in place. ES6 version
 * @link https://stackoverflow.com/a/6274381
 */
function shuffleArray(a) {
    var _a;
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        _a = __read([a[j], a[i]], 2), a[i] = _a[0], a[j] = _a[1];
    }
    return a;
}
exports.shuffleArray = shuffleArray;
function lastOfArray(ar) {
    return ar[ar.length - 1];
}
exports.lastOfArray = lastOfArray;
/**
 * @link https://stackoverflow.com/a/6259536
 */
function splitStringToChunks(str, chunkSize) {
    var chunks = [];
    for (var i = 0, charsLength = str.length; i < charsLength; i += chunkSize) {
        chunks.push(str.substring(i, i + chunkSize));
    }
    return chunks;
}
exports.splitStringToChunks = splitStringToChunks;
//# sourceMappingURL=util.js.map