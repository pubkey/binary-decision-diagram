"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * run some tests on the bdd
 * to ensure everything is correct
 */
function ensureCorrectBdd(bdd) {
    var jsonString = JSON.stringify(bdd.toJSON(true));
    var allNodes = [];
    var nodesById = new Map();
    bdd.getLevels().forEach(function (level) {
        var levelNodes = bdd.getNodesOfLevel(level);
        levelNodes.forEach(function (node) {
            nodesById.set(node.id, node);
        });
        allNodes = allNodes.concat(levelNodes);
    });
    var recursiveNodes = getNodesRecursive(bdd);
    if (allNodes.length !== recursiveNodes.size) {
        var allNodesIds_1 = allNodes.map(function (n) { return n.id; }).sort();
        var recursiveNodesIds = Array.from(recursiveNodes).map(function (n) { return n.id; }).sort();
        var nodesOnlyInRecursive = recursiveNodesIds.filter(function (id) { return !allNodesIds_1.includes(id); });
        //        console.log(JSON.stringify(allNodes.map(n => n.id).sort(), null, 2));
        //      console.log(JSON.stringify(Array.from(recursiveNodes).map(n => n.id).sort(), null, 2));
        if (recursiveNodes.size > allNodes.length) {
            var firstId_1 = nodesOnlyInRecursive[0];
            var referenceToFirst = allNodes.find(function (n) {
                if (n.isInternalNode()) {
                    return n.branches.hasNodeIdAsBranch(firstId_1);
                }
                return false;
            });
            console.log('referenceToFirst:');
            referenceToFirst === null || referenceToFirst === void 0 ? void 0 : referenceToFirst.log();
        }
        throw new Error('ensureCorrectBdd() ' +
            'nodes in list not equal size to recursive nodes ' +
            'allNodes: ' + allNodes.length + ' ' +
            'recursiveNodes: ' + recursiveNodes.size + ' ' +
            'nodesOnlyInRecursive: ' + nodesOnlyInRecursive.join(', ') + ' ');
    }
    allNodes.forEach(function (node) {
        if (node.isRootNode()) {
            return;
        }
        var useNode = node;
        if (node.deleted) {
            throw new Error('ensureCorrectBdd() ' +
                'bdd includes a deleted node');
        }
        // each node should have a parent
        if (useNode.parents.size === 0) {
            throw new Error('ensureCorrectBdd() ' +
                'node has no parent ' + useNode.id);
        }
        if (useNode.isInternalNode()) {
            var internalNode_1 = useNode;
            var bothBranches = internalNode_1.branches.getBothBranches();
            // a node should not have 2 equal branches
            if (internalNode_1.branches.areBranchesStrictEqual()) {
                throw new Error('ensureCorrectBdd() ' +
                    'node has two equal branches: ' +
                    bothBranches.map(function (n) { return n.id; }).join(', '));
            }
            // each branch should have the node as parent
            bothBranches.forEach(function (branch) {
                if (!branch.parents.has(internalNode_1)) {
                    throw new Error('ensureCorrectBdd() ' +
                        'branch must have the node as parent');
                }
            });
        }
        // each parent should have the child as branch
        useNode.parents.getAll().forEach(function (parent) {
            if (!parent.branches.hasBranchAsNode(useNode)) {
                throw new Error('ensureCorrectBdd() ' +
                    'parent node does not have child as branch');
            }
        });
    });
    if (jsonString.includes('"deleted":true')) {
        throw new Error('ensureCorrectBdd() ' +
            'bdd includes a deleted node');
    }
}
exports.ensureCorrectBdd = ensureCorrectBdd;
function getNodesRecursive(node, set) {
    if (set === void 0) { set = new Set(); }
    set.add(node);
    if (!node.isLeafNode()) {
        var useNode = node;
        var branch1 = useNode.branches.getBranch('0');
        set.add(branch1);
        getNodesRecursive(branch1, set);
        var branch2 = useNode.branches.getBranch('1');
        set.add(branch2);
        getNodesRecursive(branch2, set);
    }
    return set;
}
exports.getNodesRecursive = getNodesRecursive;
//# sourceMappingURL=ensure-correct-bdd.js.map