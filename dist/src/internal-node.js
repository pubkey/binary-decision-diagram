import { Branches } from './branches.js';
import { Parents } from './parents.js';
import { AbstractNode } from './abstract-node.js';
export class InternalNode extends AbstractNode {
    branches = new Branches(this);
    parents = new Parents(this);
    constructor(level, rootNode, parent) {
        super(level, rootNode, 'InternalNode');
        this.parents.add(parent);
    }
    /**
     * by the reduction-rule of bdd,
     * if both branches are equal,
     * we can remove this node from the bdd
     */
    applyReductionRule() {
        // console.log('applyReductionRule() ' + this.id);
        if (this.branches.hasEqualBranches()) {
            this.ensureNotDeleted('applyReductionRule');
            const keepBranch = this.branches.getBranch('0');
            // move own parents to keepBranch
            const ownParents = this.parents.getAll();
            ownParents.forEach(parent => {
                // console.log('ownParent: ' + parent.id);
                const branchKey = parent.branches.getKeyOfNode(this);
                parent.branches.setBranch(branchKey, keepBranch);
                // remove parents from own list
                // this will auto-remove the connection to the other '1'-branch
                this.parents.remove(parent);
                // if parent has now two equal branches,
                // we have to apply the reduction again
                // to ensure we end in a valid state
                if (parent.branches.areBranchesStrictEqual() && parent.isInternalNode()) {
                    parent.applyReductionRule();
                }
            });
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=internal-node.js.map