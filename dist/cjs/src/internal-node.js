"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalNode = void 0;
const branches_js_1 = require("./branches.js");
const parents_js_1 = require("./parents.js");
const abstract_node_js_1 = require("./abstract-node.js");
class InternalNode extends abstract_node_js_1.AbstractNode {
    branches = new branches_js_1.Branches(this);
    parents = new parents_js_1.Parents(this);
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
exports.InternalNode = InternalNode;
//# sourceMappingURL=internal-node.js.map