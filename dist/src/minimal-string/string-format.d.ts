export declare const CHAR_CODE_OFFSET = 40;
export declare function getCharOfLevel(level: number): string;
export declare function getNumberOfChar(char: string): number;
export declare function getCharOfValue(value: number): string;
export declare const FIRST_CHAR_CODE_FOR_ID = 97;
export declare function getNextCharId(lastCode: number): {
    char: string;
    nextCode: number;
};
