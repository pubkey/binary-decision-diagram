/**
 * represents the branches of a single node
 */
export class Branches {
    node;
    deleted = false;
    branches = {};
    constructor(node) {
        this.node = node;
    }
    setBranch(which, branchNode) {
        const previous = this.branches[which];
        if (previous === branchNode) {
            return;
        }
        // set new branch
        this.branches[which] = branchNode;
        branchNode.parents.add(this.node);
    }
    getKeyOfNode(node) {
        if (this.getBranch('0') === node) {
            return '0';
        }
        else if (this.getBranch('1') === node) {
            return '1';
        }
        else {
            throw new Error('none matched');
        }
    }
    getBranch(which) {
        return this.branches[which];
    }
    getBothBranches() {
        return [
            this.getBranch('0'),
            this.getBranch('1')
        ];
    }
    hasBranchAsNode(node) {
        if (this.getBranch('0') === node ||
            this.getBranch('1') === node) {
            return true;
        }
        else {
            return false;
        }
    }
    hasNodeIdAsBranch(id) {
        if (this.getBranch('0').id === id ||
            this.getBranch('1').id === id) {
            return true;
        }
        else {
            return false;
        }
    }
    areBranchesStrictEqual() {
        return this.branches['0'] === this.branches['1'];
    }
    hasEqualBranches() {
        return JSON.stringify(this.branches['0']) ===
            JSON.stringify(this.branches['1']);
    }
}
export function ensureNodesNotStrictEqual(node1, node2) {
    if (node1 === node2) {
        throw new Error('cannot have two strict equal branches');
    }
}
//# sourceMappingURL=branches.js.map