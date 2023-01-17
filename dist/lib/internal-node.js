"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalNode = void 0;
const branches_1 = require("./branches");
const parents_1 = require("./parents");
const abstract_node_1 = require("./abstract-node");
class InternalNode extends abstract_node_1.AbstractNode {
    constructor(level, rootNode, parent) {
        super(level, rootNode, 'InternalNode');
        this.branches = new branches_1.Branches(this);
        this.parents = new parents_1.Parents(this);
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
exports.InternalNode = InternalNode;
//# sourceMappingURL=internal-node.js.map