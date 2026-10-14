import type { PackedBdd } from './packed-bdd.js';

/*

String transport format of a PackedBdd, to embed it into JavaScript source code.
The string only contains ASCII characters that are safe inside of quotes,
so bundlers and minifiers never have to escape anything.

- The first char is the byte width of the entries: '1', '2' or '4'
- The rest is the standard base64 of the entries as little-endian bytes

The base64 is decoded with the native Uint8Array.fromBase64() where it exists
and with atob() everywhere else, both are faster than decoding it in JavaScript.

*/

const IS_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

export function packedBddToBase64String(packedBdd: PackedBdd): string {
    const width = packedBdd.BYTES_PER_ELEMENT;
    const bytes = new Uint8Array(packedBdd.length * width);
    for (let i = 0; i < packedBdd.length; i++) {
        const value = packedBdd[i];
        for (let b = 0; b < width; b++) {
            bytes[i * width + b] = (value >>> (b * 8)) & 0xFF;
        }
    }

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
    }
    return width + btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
    const fromBase64 = (Uint8Array as any).fromBase64;
    if (fromBase64) {
        return fromBase64(base64);
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function packedBddFromBase64String(str: string): PackedBdd {
    const width = str.charCodeAt(0) - 48;
    if (width !== 1 && width !== 2 && width !== 4) {
        throw new Error('not a PackedBdd string');
    }
    const bytes = base64ToBytes(str.slice(1));
    if (bytes.length % width !== 0) {
        throw new Error('not a PackedBdd string');
    }

    if (width === 1) {
        return bytes;
    }
    if (IS_LITTLE_ENDIAN && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
        // the bytes already are in the right order, use the same memory
        return width === 2 ? new Uint16Array(bytes.buffer) : new Uint32Array(bytes.buffer);
    }
    const ret = width === 2 ? new Uint16Array(bytes.length / 2) : new Uint32Array(bytes.length / 4);
    for (let i = 0; i < ret.length; i++) {
        const b = i * width;
        ret[i] = width === 2 ?
            bytes[b] | (bytes[b + 1] << 8) :
            (bytes[b] | (bytes[b + 1] << 8) | (bytes[b + 2] << 16) | (bytes[b + 3] << 24)) >>> 0;
    }
    return ret;
}
