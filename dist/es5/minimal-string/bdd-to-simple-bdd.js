"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @recursive
 */
function bddToSimpleBdd(bdd) {
    return nodeToSimpleBddNode(bdd);
}
exports.bddToSimpleBdd = bddToSimpleBdd;
/**
 * @recursive
 */
function nodeToSimpleBddNode(node) {
    var branch0 = node.branches.getBranch('0');
    var branch1 = node.branches.getBranch('1');
    return {
        l: node.level,
        0: branch0.isLeafNode() ? branch0.asLeafNode().value : nodeToSimpleBddNode(branch0),
        1: branch1.isLeafNode() ? branch1.asLeafNode().value : nodeToSimpleBddNode(branch1),
    };
}
exports.nodeToSimpleBddNode = nodeToSimpleBddNode;
//# sourceMappingURL=bdd-to-simple-bdd.js.map