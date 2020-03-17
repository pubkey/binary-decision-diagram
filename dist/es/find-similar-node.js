/**
 * find an simliar node in a list of nodes
 * which is not exactly the same node
 * @hotpath
 */
export function findSimilarNode(own, others) {
    var ownString = own.toString();
    for (var i = 0; i < others.length; i++) {
        var other = others[i];
        if (own !== other &&
            !other.deleted &&
            own.isEqualToOtherNode(other, ownString)) {
            return other;
        }
    }
    return null;
}
//# sourceMappingURL=find-similar-node.js.map