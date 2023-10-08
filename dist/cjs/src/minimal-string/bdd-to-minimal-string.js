"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeToString = exports.bddToMinimalString = void 0;
const string_format_js_1 = require("./string-format.js");
const string_format_js_2 = require("./string-format.js");
function bddToMinimalString(bdd) {
    let ret = '';
    let currentCharCode = string_format_js_2.FIRST_CHAR_CODE_FOR_ID;
    // add leaf node count
    const leafNodeAmount = bdd.getLeafNodes().length;
    if (leafNodeAmount > 99) {
        throw new Error('cannot build string with too many leaf nodes');
    }
    ret += leafNodeAmount.toString().padStart(2, '0');
    const levelsHighestFirst = bdd.levels.slice().reverse();
    const idByNode = new Map();
    levelsHighestFirst.forEach(level => {
        const nodes = bdd.getNodesOfLevel(level);
        nodes.forEach(node => {
            const stringRep = nodeToString(node, idByNode, currentCharCode);
            currentCharCode = stringRep.nextCode;
            idByNode.set(node, stringRep.id);
            ret += stringRep.str;
        });
    });
    return ret;
}
exports.bddToMinimalString = bddToMinimalString;
function nodeToString(node, idByNode, lastCode) {
    const nextId = (0, string_format_js_1.getNextCharId)(lastCode);
    switch (node.type) {
        case 'LeafNode':
            const valueChar = (0, string_format_js_1.getCharOfValue)(node.asLeafNode().value);
            return {
                id: nextId.char,
                nextCode: nextId.nextCode,
                str: nextId.char + valueChar
            };
        case 'InternalNode':
            const branch0Id = idByNode.get(node.asInternalNode().branches.getBranch('0'));
            const branch1Id = idByNode.get(node.asInternalNode().branches.getBranch('1'));
            return {
                id: nextId.char,
                nextCode: nextId.nextCode,
                str: nextId.char + branch0Id + branch1Id + (0, string_format_js_1.getCharOfLevel)(node.level)
            };
        case 'RootNode':
            const branch0IdRoot = idByNode.get(node.asRootNode().branches.getBranch('0'));
            const branch1IdRoot = idByNode.get(node.asRootNode().branches.getBranch('1'));
            return {
                id: nextId.char,
                nextCode: nextId.nextCode,
                str: '' + branch0IdRoot + branch1IdRoot + (0, string_format_js_1.getCharOfLevel)(node.level)
            };
        default:
            throw new Error('unknown node type');
    }
}
exports.nodeToString = nodeToString;
//# sourceMappingURL=bdd-to-minimal-string.js.map