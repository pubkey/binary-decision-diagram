"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bddToSimpleBdd = bddToSimpleBdd;
exports.nodeToSimpleBddNode = nodeToSimpleBddNode;
/**
 * @recursive
 */
function bddToSimpleBdd(bdd) {
    return nodeToSimpleBddNode(bdd);
}
/**
 * @recursive
 */
function nodeToSimpleBddNode(node) {
    const branch0 = node.branches.getBranch('0');
    const branch1 = node.branches.getBranch('1');
    return {
        l: node.level,
        0: branch0.isLeafNode() ? branch0.asLeafNode().value : nodeToSimpleBddNode(branch0),
        1: branch1.isLeafNode() ? branch1.asLeafNode().value : nodeToSimpleBddNode(branch1),
    };
}
//# sourceMappingURL=bdd-to-simple-bdd.js.map