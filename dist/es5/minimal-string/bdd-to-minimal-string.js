"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var string_format_1 = require("./string-format");
var string_format_2 = require("./string-format");
function bddToMinimalString(bdd) {
    var ret = '';
    var currentCharCode = string_format_2.FIRST_CHAR_CODE_FOR_ID;
    // add leaf node count
    var leafNodeAmount = bdd.getLeafNodes().length;
    if (leafNodeAmount > 99) {
        throw new Error('cannot build string with too many leaf nodes');
    }
    ret += leafNodeAmount.toString().padStart(2, '0');
    var levelsHighestFirst = bdd.levels.slice().reverse();
    var idByNode = new Map();
    levelsHighestFirst.forEach(function (level) {
        var nodes = bdd.getNodesOfLevel(level);
        nodes.forEach(function (node) {
            var stringRep = nodeToString(node, idByNode, currentCharCode);
            currentCharCode = stringRep.nextCode;
            idByNode.set(node, stringRep.id);
            ret += stringRep.str;
        });
    });
    return ret;
}
exports.bddToMinimalString = bddToMinimalString;
function nodeToString(node, idByNode, lastCode) {
    var nextId = string_format_1.getNextCharId(lastCode);
    switch (node.type) {
        case 'LeafNode':
            var valueChar = string_format_1.getCharOfValue(node.asLeafNode().value);
            return {
                id: nextId.char,
                nextCode: nextId.nextCode,
                str: nextId.char + valueChar
            };
        case 'InternalNode':
            var branch0Id = idByNode.get(node.asInternalNode().branches.getBranch('0'));
            var branch1Id = idByNode.get(node.asInternalNode().branches.getBranch('1'));
            return {
                id: nextId.char,
                nextCode: nextId.nextCode,
                str: nextId.char + branch0Id + branch1Id + string_format_1.getCharOfLevel(node.level)
            };
        case 'RootNode':
            var branch0IdRoot = idByNode.get(node.asRootNode().branches.getBranch('0'));
            var branch1IdRoot = idByNode.get(node.asRootNode().branches.getBranch('1'));
            return {
                id: nextId.char,
                nextCode: nextId.nextCode,
                str: '' + branch0IdRoot + branch1IdRoot + string_format_1.getCharOfLevel(node.level)
            };
        default:
            throw new Error('unknown node type');
    }
}
exports.nodeToString = nodeToString;
//# sourceMappingURL=bdd-to-minimal-string.js.map