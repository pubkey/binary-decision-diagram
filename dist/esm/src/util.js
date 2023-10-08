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
export function nextNodeId() {
    const ret = 'node_' + nodeIdPrefix + '_' + lastIdGen;
    lastIdGen++;
    return ret;
}
/**
 * @link https://stackoverflow.com/a/16155417
 */
export function decimalToPaddedBinary(decimal, padding) {
    const binary = (decimal >>> 0).toString(2);
    const padded = binary.padStart(padding, '0');
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
    return new Array(length).fill(0).map(() => '0').join('');
}
export function maxBinaryWithLength(length) {
    return new Array(length).fill(0).map(() => '1').join('');
}
export function getNextStateSet(stateSet) {
    const decimal = binaryToDecimal(stateSet);
    const increase = decimal + 1;
    const binary = decimalToPaddedBinary(increase, stateSet.length);
    return binary;
}
export function firstKeyOfMap(map) {
    const iterator1 = map.keys();
    return iterator1.next().value;
}
/**
 * Shuffles array in place. ES6 version
 * @link https://stackoverflow.com/a/6274381
 */
export function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
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
    const chunks = [];
    for (let i = 0, charsLength = str.length; i < charsLength; i += chunkSize) {
        chunks.push(str.substring(i, i + chunkSize));
    }
    return chunks;
}
//# sourceMappingURL=util.js.map