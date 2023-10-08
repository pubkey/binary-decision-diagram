import { Parents } from './parents.js';
import { AbstractNode } from './abstract-node.js';
import { oppositeBoolean } from './util.js';
export class LeafNode extends AbstractNode {
    value;
    parents = new Parents(this);
    constructor(level, rootNode, value, parent) {
        super(level, rootNode, 'LeafNode');
        this.value = value;
        this.parents.add(parent);
    }
    removeIfValueEquals(value) {
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
                parent.applyReductionRule();
            }
        });
        return true;
    }
}
//# sourceMappingURL=leaf-node.js.map