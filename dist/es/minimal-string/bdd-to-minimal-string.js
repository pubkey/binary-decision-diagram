import { getCharOfLevel, getCharOfValue, getNextCharId } from './string-format';
import { FIRST_CHAR_CODE_FOR_ID } from './string-format';
export function bddToMinimalString(bdd) {
    var ret = '';
    var currentCharCode = FIRST_CHAR_CODE_FOR_ID;
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
export function nodeToString(node, idByNode, lastCode) {
    var nextId = getNextCharId(lastCode);
    switch (node.type) {
        case 'LeafNode':
            var valueChar = getCharOfValue(node.asLeafNode().value);
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
                str: nextId.char + branch0Id + branch1Id + getCharOfLevel(node.level)
            };
        case 'RootNode':
            var branch0IdRoot = idByNode.get(node.asRootNode().branches.getBranch('0'));
            var branch1IdRoot = idByNode.get(node.asRootNode().branches.getBranch('1'));
            return {
                id: nextId.char,
                nextCode: nextId.nextCode,
                str: '' + branch0IdRoot + branch1IdRoot + getCharOfLevel(node.level)
            };
        default:
            throw new Error('unknown node type');
    }
}
//# sourceMappingURL=bdd-to-minimal-string.js.map