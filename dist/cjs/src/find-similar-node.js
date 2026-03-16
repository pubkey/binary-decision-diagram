"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSimilarNode = findSimilarNode;
/**
 * find an simliar node in a list of nodes
 * which is not exactly the same node
 * @hotpath
 */
function findSimilarNode(own, others) {
    const ownString = own.toString();
    for (let i = 0; i < others.length; i++) {
        const other = others[i];
        if (own !== other &&
            !other.deleted &&
            own.isEqualToOtherNode(other, ownString)) {
            return other;
        }
    }
    return null;
}
//# sourceMappingURL=find-similar-node.js.map