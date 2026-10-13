import { Branches, BRANCH_KEYS } from './branches.js';
import { Parents } from './parents.js';
import { RootNode } from './root-node.js';
import { AbstractNode } from './abstract-node.js';
import type { NonLeafNode, NonRootNode } from './types.js';

export class InternalNode extends AbstractNode {
    public branches: Branches = new Branches(this);
    public parents = new Parents(this);

    constructor(
        level: number,
        rootNode: RootNode,
        parent: NonLeafNode
    ) {
        super(level, rootNode, 'InternalNode');
        this.parents.add(parent);
    }



    /**
     * by the reduction-rule of bdd,
     * if both branches are equal,
     * we can remove this node from the bdd
     */
    applyReductionRule(): boolean {

        // console.log('applyReductionRule() ' + this.id);

        if (this.branches.hasEqualBranches()) {
            this.ensureNotDeleted('applyReductionRule');
            const keepBranch: NonRootNode = this.branches.getBranch('0');

            // move own parents to keepBranch
            const ownParents = this.parents.getAll();
            ownParents.forEach(parent => {
                // a parent (the root node) can have this node in both branches
                BRANCH_KEYS.forEach(branchKey => {
                    if (parent.branches.getBranch(branchKey) === this) {
                        parent.branches.setBranch(branchKey, keepBranch);
                    }
                });

                // remove parents from own list
                // this will auto-remove the connection to the other '1'-branch
                this.parents.remove(parent);

                // if parent has now two equal branches,
                // we have to apply the reduction again
                // to ensure we end in a valid state
                if (parent.branches.areBranchesStrictEqual() && parent.isInternalNode()) {
                    (parent as InternalNode).applyReductionRule();
                }
            });

            return true;
        }
        return false;
    }

}
