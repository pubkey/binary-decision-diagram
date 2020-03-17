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
export function booleanStringToBoolean(str) {
    if (str === '1') {
        return true;
    }
    else {
        return false;
    }
}
export function booleanToBooleanString(b) {
    if (b) {
        return '1';
    }
    else {
        return '0';
    }
}
export function oppositeBoolean(input) {
    if (input === '1') {
        return '0';
    }
    else {
        return '1';
    }
}
export function lastChar(str) {
    return str.slice(-1);
}
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
export function nextNodeId() {
    var ret = 'node_' + nodeIdPrefix + '_' + lastIdGen;
    lastIdGen++;
    return ret;
}
/**
 * @link https://stackoverflow.com/a/16155417
 */
export function decimalToPaddedBinary(decimal, padding) {
    var binary = (decimal >>> 0).toString(2);
    var padded = binary.padStart(padding, '0');
    return padded;
}
export function oppositeBinary(i) {
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
export function binaryToDecimal(binary) {
    return parseInt(binary, 2);
}
export function minBinaryWithLength(length) {
    return new Array(length).fill(0).map(function () { return '0'; }).join('');
}
export function maxBinaryWithLength(length) {
    return new Array(length).fill(0).map(function () { return '1'; }).join('');
}
export function getNextStateSet(stateSet) {
    var decimal = binaryToDecimal(stateSet);
    var increase = decimal + 1;
    var binary = decimalToPaddedBinary(increase, stateSet.length);
    return binary;
}
export function firstKeyOfMap(map) {
    var iterator1 = map.keys();
    return iterator1.next().value;
}
/**
 * Shuffles array in place. ES6 version
 * @link https://stackoverflow.com/a/6274381
 */
export function shuffleArray(a) {
    var _a;
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        _a = __read([a[j], a[i]], 2), a[i] = _a[0], a[j] = _a[1];
    }
    return a;
}
export function lastOfArray(ar) {
    return ar[ar.length - 1];
}
/**
 * @link https://stackoverflow.com/a/6259536
 */
export function splitStringToChunks(str, chunkSize) {
    var chunks = [];
    for (var i = 0, charsLength = str.length; i < charsLength; i += chunkSize) {
        chunks.push(str.substring(i, i + chunkSize));
    }
    return chunks;
}
//# sourceMappingURL=util.js.map