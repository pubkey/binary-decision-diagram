import { splitStringToChunks } from '../util';
import { getNumberOfChar } from './string-format';
export function minimalStringToSimpleBdd(str) {
    var nodesById = new Map();
    // parse leaf nodes
    var leafNodeAmount = parseInt(str.charAt(0) + str.charAt(1), 10);
    var lastLeafNodeChar = (2 + leafNodeAmount * 2);
    var leafNodeChars = str.substring(2, lastLeafNodeChar);
    var leafNodeChunks = splitStringToChunks(leafNodeChars, 2);
    for (var i = 0; i < leafNodeChunks.length; i++) {
        var chunk = leafNodeChunks[i];
        var id = chunk.charAt(0);
        var value = getNumberOfChar(chunk.charAt(1));
        nodesById.set(id, value);
    }
    // parse internal nodes
    var internalNodeChars = str.substring(lastLeafNodeChar, str.length - 3);
    var internalNodeChunks = splitStringToChunks(internalNodeChars, 4);
    for (var i = 0; i < internalNodeChunks.length; i++) {
        var chunk = internalNodeChunks[i];
        var id = chunk.charAt(0);
        var idOf0Branch = chunk.charAt(1);
        var idOf1Branch = chunk.charAt(2);
        var level = getNumberOfChar(chunk.charAt(3));
        if (!nodesById.has(idOf0Branch)) {
            throw new Error('missing node with id ' + idOf0Branch);
        }
        if (!nodesById.has(idOf1Branch)) {
            throw new Error('missing node with id ' + idOf1Branch);
        }
        var node0 = nodesById.get(idOf0Branch);
        var node1 = nodesById.get(idOf1Branch);
        var node = {
            l: level,
            0: node0,
            1: node1
        };
        nodesById.set(id, node);
    }
    // parse root node
    var last3 = str.slice(-3);
    var idOf0 = last3.charAt(0);
    var idOf1 = last3.charAt(1);
    var levelOfRoot = getNumberOfChar(last3.charAt(2));
    var nodeOf0 = nodesById.get(idOf0);
    var nodeOf1 = nodesById.get(idOf1);
    var rootNode = {
        l: levelOfRoot,
        0: nodeOf0,
        1: nodeOf1,
    };
    return rootNode;
}
//# sourceMappingURL=minimal-string-to-simple-bdd.js.map