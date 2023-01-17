"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitStringToChunks = exports.lastOfArray = exports.shuffleArray = exports.firstKeyOfMap = exports.getNextStateSet = exports.maxBinaryWithLength = exports.minBinaryWithLength = exports.binaryToDecimal = exports.oppositeBinary = exports.decimalToPaddedBinary = exports.nextNodeId = exports.lastChar = exports.oppositeBoolean = exports.booleanToBooleanString = exports.booleanStringToBoolean = void 0;
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
function makeid(length = 6) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
const nodeIdPrefix = makeid(4);
let lastIdGen = 0;
function nextNodeId() {
    const ret = 'node_' + nodeIdPrefix + '_' + lastIdGen;
    lastIdGen++;
    return ret;
}
exports.nextNodeId = nextNodeId;
/**
 * @link https://stackoverflow.com/a/16155417
 */
function decimalToPaddedBinary(decimal, padding) {
    const binary = (decimal >>> 0).toString(2);
    const padded = binary.padStart(padding, '0');
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
    return new Array(length).fill(0).map(() => '0').join('');
}
exports.minBinaryWithLength = minBinaryWithLength;
function maxBinaryWithLength(length) {
    return new Array(length).fill(0).map(() => '1').join('');
}
exports.maxBinaryWithLength = maxBinaryWithLength;
function getNextStateSet(stateSet) {
    const decimal = binaryToDecimal(stateSet);
    const increase = decimal + 1;
    const binary = decimalToPaddedBinary(increase, stateSet.length);
    return binary;
}
exports.getNextStateSet = getNextStateSet;
function firstKeyOfMap(map) {
    const iterator1 = map.keys();
    return iterator1.next().value;
}
exports.firstKeyOfMap = firstKeyOfMap;
/**
 * Shuffles array in place. ES6 version
 * @link https://stackoverflow.com/a/6274381
 */
function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
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
    const chunks = [];
    for (let i = 0, charsLength = str.length; i < charsLength; i += chunkSize) {
        chunks.push(str.substring(i, i + chunkSize));
    }
    return chunks;
}
exports.splitStringToChunks = splitStringToChunks;
//# sourceMappingURL=util.js.map