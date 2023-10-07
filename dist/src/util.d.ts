import type { BooleanString } from './types.ts';
export declare function booleanStringToBoolean(str: BooleanString): boolean;
export declare function booleanToBooleanString(b: boolean): BooleanString;
export declare function oppositeBoolean(input: BooleanString): BooleanString;
export declare function lastChar(str: string): string;
export declare function nextNodeId(): string;
/**
 * @link https://stackoverflow.com/a/16155417
 */
export declare function decimalToPaddedBinary(decimal: number, padding: number): string;
export declare function oppositeBinary(i: string): string;
export declare function binaryToDecimal(binary: string): number;
export declare function minBinaryWithLength(length: number): string;
export declare function maxBinaryWithLength(length: number): string;
export declare function getNextStateSet(stateSet: string): string;
export declare function firstKeyOfMap(map: Map<string, any>): string;
/**
 * Shuffles array in place. ES6 version
 * @link https://stackoverflow.com/a/6274381
 */
export declare function shuffleArray<T>(a: T[]): T[];
export declare function lastOfArray<T>(ar: T[]): T;
/**
 * @link https://stackoverflow.com/a/6259536
 */
export declare function splitStringToChunks(str: string, chunkSize: number): string[];
