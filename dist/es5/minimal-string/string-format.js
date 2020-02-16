"use strict";
/*
let t = 0;
while (t < 10000) {
    const char = String.fromCharCode(t);
    console.log(t + ' : ' + char);
    t++;
}
*/
Object.defineProperty(exports, "__esModule", { value: true });
/*

To have a really small string representation, we have to hack some stuff
which makes is complicated but effective.

Rules for the string:
- The string starts with a number like '23' that defines how many leaf-nodes we have
- leaf nodes consist of two chars like 'ab'
    - the first char is the id
    - the second the value is a number you can get via String.charCodeAt()
- Internal nodes have four chars like 'abcd'
    - the first char is the id
    - the second char is the id of the 0-branch
    - the third char is the id of the 1-branch
    - the last char is the id of the boolean-function (= level)
- The last 2 chars of the string is the root node like 'ab'
    - it looks like the internal-node but without the id (first char)
    - and without the id of the boolean function (is always level 0)

*/
// we use this because 39 is the quotes which causes problems
exports.CHAR_CODE_OFFSET = 40; // String.fromCharCode(33) === ')'
function getCharOfLevel(level) {
    var charCode = exports.CHAR_CODE_OFFSET + level;
    return String.fromCharCode(charCode);
}
exports.getCharOfLevel = getCharOfLevel;
function getNumberOfChar(char) {
    var charCode = char.charCodeAt(0);
    return charCode - exports.CHAR_CODE_OFFSET;
}
exports.getNumberOfChar = getNumberOfChar;
function getCharOfValue(value) {
    var charCode = exports.CHAR_CODE_OFFSET + value;
    return String.fromCharCode(charCode);
}
exports.getCharOfValue = getCharOfValue;
exports.FIRST_CHAR_CODE_FOR_ID = 97; // String.fromCharCode(97) === 'a'
function getNextCharId(lastCode) {
    // jump these codes because they look strange
    if (lastCode >= 128 && lastCode <= 160) {
        lastCode = 161;
    }
    var char = String.fromCharCode(lastCode);
    return {
        char: char,
        nextCode: lastCode + 1
    };
}
exports.getNextCharId = getNextCharId;
//# sourceMappingURL=string-format.js.map