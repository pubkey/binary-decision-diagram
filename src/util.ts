import type { BooleanString } from './types.ts';

export function booleanStringToBoolean(str: BooleanString): boolean {
    if (str === '1') {
        return true;
    } else {
        return false;
    }
}

export function booleanToBooleanString(b: boolean): BooleanString {
    if (b) {
        return '1';
    } else {
        return '0';
    }
}

export function oppositeBoolean(input: BooleanString): BooleanString {
    if (input === '1') {
        return '0';
    } else {
        return '1';
    }
}

export function lastChar(str: string): string {
    return str.slice(-1);
}

/**
 * @link https://stackoverflow.com/a/1349426
 */
function makeid(length: number = 6): string {
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
export function nextNodeId(): string {
    const ret = 'node_' + nodeIdPrefix + '_' + lastIdGen;
    lastIdGen++;
    return ret;
}

/**
 * @link https://stackoverflow.com/a/16155417
 */
export function decimalToPaddedBinary(
    decimal: number,
    padding: number
) {
    // >>> 0 would cut off everything above 32 bits, only use it for the two's complement of negative numbers
    const binary = (decimal < 0 ? decimal >>> 0 : decimal).toString(2);
    const padded = binary.padStart(padding, '0');
    return padded;
}

export function oppositeBinary(i: string): string {
    if (i === '1') {
        return '0';
    } else if (i === '0') {
        return '1';
    } else {
        throw new Error('non-binary given');
    }
}

export function binaryToDecimal(binary: string): number {
    return parseInt(binary, 2);
}

export function minBinaryWithLength(length: number): string {
    return new Array(length).fill(0).map(() => '0').join('');
}

export function maxBinaryWithLength(length: number): string {
    return new Array(length).fill(0).map(() => '1').join('');
}

export function getNextStateSet(
    stateSet: string
): string {
    if (stateSet.length <= 52) {
        // fast path, the number stays exact
        const decimal = binaryToDecimal(stateSet);
        return decimalToPaddedBinary(decimal + 1, stateSet.length);
    }
    // longer keys would lose precision as a number, so increment the string directly
    const lastZero = stateSet.lastIndexOf('0');
    if (lastZero === -1) {
        // overflow, the result gets one char longer
        return '1' + '0'.repeat(stateSet.length);
    }
    return stateSet.slice(0, lastZero) + '1' + '0'.repeat(stateSet.length - lastZero - 1);
}

export function firstKeyOfMap(map: Map<string, any>): string {
    const iterator1 = map.keys();
    return iterator1.next().value as string;
}

/**
 * Shuffles array in place. ES6 version
 * @link https://stackoverflow.com/a/6274381
 */
export function shuffleArray<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function lastOfArray<T>(ar: T[]): T {
    return ar[ar.length - 1];
}

/**
 * @link https://stackoverflow.com/a/6259536
 */
export function splitStringToChunks(str: string, chunkSize: number): string[] {
    const chunks: string[] = [];

    for (let i = 0, charsLength = str.length; i < charsLength; i += chunkSize) {
        chunks.push(str.substring(i, i + chunkSize));
    }
    return chunks;
}
