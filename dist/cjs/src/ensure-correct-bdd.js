"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodesRecursive = exports.ensureCorrectBdd = void 0;
/**
 * run some tests on the bdd
 * to ensure everything is correct
 */
function ensureCorrectBdd(bdd) {
    const jsonString = JSON.stringify(bdd.toJSON(true));
    let allNodes = [];
    const nodesById = new Map();
    bdd.getLevels().forEach(level => {
        const levelNodes = bdd.getNodesOfLevel(level);
        levelNodes.forEach(node => {
            nodesById.set(node.id, node);
        });
        allNodes = allNodes.concat(levelNodes);
    });
    const recursiveNodes = getNodesRecursive(bdd);
    if (allNodes.length !== recursiveNodes.size) {
        const allNodesIds = allNodes.map(n => n.id).sort();
        const recursiveNodesIds = Array.from(recursiveNodes).map(n => n.id).sort();
        const nodesOnlyInRecursive = recursiveNodesIds.filter(id => !allNodesIds.includes(id));
        //        console.log(JSON.stringify(allNodes.map(n => n.id).sort(), null, 2));
        //      console.log(JSON.stringify(Array.from(recursiveNodes).map(n => n.id).sort(), null, 2));
        if (recursiveNodes.size > allNodes.length) {
            const firstId = nodesOnlyInRecursive[0];
            const referenceToFirst = allNodes.find(n => {
                if (n.isInternalNode()) {
                    return n.branches.hasNodeIdAsBranch(firstId);
                }
                return false;
            });
            console.log('referenceToFirst:');
            referenceToFirst?.log();
        }
        throw new Error('ensureCorrectBdd() ' +
            'nodes in list not equal size to recursive nodes ' +
            'allNodes: ' + allNodes.length + ' ' +
            'recursiveNodes: ' + recursiveNodes.size + ' ' +
            'nodesOnlyInRecursive: ' + nodesOnlyInRecursive.join(', ') + ' ');
    }
    allNodes.forEach(node => {
        if (node.isRootNode()) {
            return;
        }
        const useNode = node;
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
            const internalNode = useNode;
            const bothBranches = internalNode.branches.getBothBranches();
            // a node should not have 2 equal branches
            if (internalNode.branches.areBranchesStrictEqual()) {
                throw new Error('ensureCorrectBdd() ' +
                    'node has two equal branches: ' +
                    bothBranches.map(n => n.id).join(', '));
            }
            // each branch should have the node as parent
            bothBranches.forEach(branch => {
                if (!branch.parents.has(internalNode)) {
                    throw new Error('ensureCorrectBdd() ' +
                        'branch must have the node as parent');
                }
            });
        }
        // each parent should have the child as branch
        useNode.parents.getAll().forEach(parent => {
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
function getNodesRecursive(node, set = new Set()) {
    set.add(node);
    if (!node.isLeafNode()) {
        const useNode = node;
        const branch1 = useNode.branches.getBranch('0');
        set.add(branch1);
        getNodesRecursive(branch1, set);
        const branch2 = useNode.branches.getBranch('1');
        set.add(branch2);
        getNodesRecursive(branch2, set);
    }
    return set;
}
exports.getNodesRecursive = getNodesRecursive;
//# sourceMappingURL=ensure-correct-bdd.js.map