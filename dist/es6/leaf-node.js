import { Parents } from './parents';
import { AbstractNode } from './abstract-node';
import { oppositeBoolean } from './util';
export class LeafNode extends AbstractNode {
    constructor(level, rootNode, value, parent) {
        super(level, rootNode, 'LeafNode');
        this.value = value;
        this.parents = new Parents(this);
        this.parents.add(parent);
    }
    removeIfValueEquals(value) {
        this.ensureNotDeleted();
        // console.log('removeIfValueEquals()');
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