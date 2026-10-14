import type { PackedBdd } from './packed-bdd.js';

/*

String transport format of a PackedBdd, to embed it into JavaScript source code.
The string only contains ASCII characters that are safe inside of quotes,
so bundlers and minifiers never have to escape anything.

- The first char is the byte width of the entries: '1', '2' or '4'
- The rest is the standard base64 of the memory of the typed array

The base64 is decoded with the native Uint8Array.fromBase64() where it exists
and with atob() everywhere else, both are faster than decoding it in JavaScript.
The typed array then directly uses the decoded memory. This assumes a little-endian
platform, which are all browsers and nearly all Node.js servers.

*/

export function packedBddToBase64String(packedBdd: PackedBdd): string {
    const bytes = new Uint8Array(packedBdd.buffer, packedBdd.byteOffset, packedBdd.byteLength);

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
    }
    return packedBdd.BYTES_PER_ELEMENT + btoa(binary);
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
    const bytes = base64ToBytes(str.slice(1));
    return width === 1 ? bytes : width === 2 ? new Uint16Array(bytes.buffer) : new Uint32Array(bytes.buffer);
}
