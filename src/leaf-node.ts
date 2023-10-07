import { Parents } from './parents.js';
import { AbstractNode } from './abstract-node.js';
import { RootNode } from './root-node.js';
import type { NonLeafNode } from './types.js';
import { oppositeBoolean } from './util.js';
import { InternalNode } from './internal-node.js';

export class LeafNode extends AbstractNode {
    public parents = new Parents(this);

    constructor(
        level: number,
        rootNode: RootNode,
        public value: number,
        parent: NonLeafNode
    ) {
        super(level, rootNode, 'LeafNode');
        this.parents.add(parent);
    }

    removeIfValueEquals(value: number): boolean {
        this.ensureNotDeleted();

        if (this.value !== value) {
            return false;
        }

        const parents = this.parents.getAll();
        parents.forEach(parent => {
            const branchKey = parent.branches.getKeyOfNode(this);
            const otherBranch = parent.branches.getBranch(oppositeBoolean(branchKey));
            this.parents.remove(parent);
            parent.branches.setBranch(branchKey, otherBranch);
            if (parent.isInternalNode()) {
                (parent as InternalNode).applyReductionRule();
            }
        });

        return true;
    }


}
