"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeafNode = void 0;
const parents_1 = require("./parents");
const abstract_node_1 = require("./abstract-node");
const util_1 = require("./util");
class LeafNode extends abstract_node_1.AbstractNode {
    constructor(level, rootNode, value, parent) {
        super(level, rootNode, 'LeafNode');
        this.value = value;
        this.parents = new parents_1.Parents(this);
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
            const otherBranch = parent.branches.getBranch((0, util_1.oppositeBoolean)(branchKey));
            this.parents.remove(parent);
            parent.branches.setBranch(branchKey, otherBranch);
            if (parent.isInternalNode()) {
                parent.applyReductionRule();
            }
        });
        return true;
    }
}
exports.LeafNode = LeafNode;
//# sourceMappingURL=leaf-node.js.map