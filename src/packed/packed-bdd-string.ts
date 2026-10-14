import type { PackedBdd } from './packed-bdd.js';

/*

String transport format of a PackedBdd, to embed it into JavaScript source code.
The string only contains ASCII characters that are safe inside of quotes,
so bundlers and minifiers never have to escape anything.

- The first char is the byte width of the entries: '1', '2' or '4'
- The rest is the base64 (without padding) of the entries as little-endian bytes

Decoding is a single loop over the string that writes into a typed array,
no JavaScript objects are created.

*/

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function packedBddToString(packedBdd: PackedBdd): string {
    const width = packedBdd.BYTES_PER_ELEMENT;
    const bytes = new Uint8Array(packedBdd.length * width);
    for (let i = 0; i < packedBdd.length; i++) {
        const value = packedBdd[i];
        for (let b = 0; b < width; b++) {
            bytes[i * width + b] = (value >>> (b * 8)) & 0xFF;
        }
    }

    let ret = '' + width;
    for (let i = 0; i < bytes.length; i += 3) {
        const chunk = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
        const chars = Math.min(4, Math.ceil((bytes.length - i) * 4 / 3));
        for (let c = 0; c < chars; c++) {
            ret += BASE64_CHARS[(chunk >>> (18 - c * 6)) & 0x3F];
        }
    }
    return ret;
}

let charValues: Uint8Array | undefined;

export function packedBddFromString(str: string): PackedBdd {
    if (!charValues) {
        charValues = new Uint8Array(128);
        for (let i = 0; i < 64; i++) {
            charValues[BASE64_CHARS.charCodeAt(i)] = i;
        }
    }
    const width = str.charCodeAt(0) - 48;
    const charCount = str.length - 1;
    const byteLength = (charCount * 3) >> 2;
    if ((width !== 1 && width !== 2 && width !== 4) || byteLength % width !== 0) {
        throw new Error('not a PackedBdd string');
    }

    const bytes = new Uint8Array(byteLength + 2);
    let byteIndex = 0;
    for (let i = 1; i < str.length; i += 4) {
        const chunk = (charValues[str.charCodeAt(i) & 0x7F] << 18) |
            (charValues[str.charCodeAt(i + 1) & 0x7F] << 12) |
            (charValues[str.charCodeAt(i + 2) & 0x7F] << 6) |
            charValues[str.charCodeAt(i + 3) & 0x7F];
        bytes[byteIndex++] = chunk >>> 16;
        bytes[byteIndex++] = (chunk >>> 8) & 0xFF;
        bytes[byteIndex++] = chunk & 0xFF;
    }

    if (width === 1) {
        return bytes.subarray(0, byteLength);
    }
    const ret = width === 2 ? new Uint16Array(byteLength / 2) : new Uint32Array(byteLength / 4);
    for (let i = 0; i < ret.length; i++) {
        const b = i * width;
        ret[i] = width === 2 ?
            bytes[b] | (bytes[b + 1] << 8) :
            (bytes[b] | (bytes[b + 1] << 8) | (bytes[b + 2] << 16) | (bytes[b + 3] << 24)) >>> 0;
    }
    return ret;
}
