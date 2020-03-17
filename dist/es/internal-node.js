var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { Branches } from './branches';
import { Parents } from './parents';
import { AbstractNode } from './abstract-node';
var InternalNode = /** @class */ (function (_super) {
    __extends(InternalNode, _super);
    function InternalNode(level, rootNode, parent) {
        var _this = _super.call(this, level, rootNode, 'InternalNode') || this;
        _this.branches = new Branches(_this);
        _this.parents = new Parents(_this);
        _this.parents.add(parent);
        return _this;
    }
    /**
     * by the reduction-rule of bdd,
     * if both branches are equal,
     * we can remove this node from the bdd
     */
    InternalNode.prototype.applyReductionRule = function () {
        // console.log('applyReductionRule() ' + this.id);
        var _this = this;
        if (this.branches.hasEqualBranches()) {
            this.ensureNotDeleted('applyReductionRule');
            var keepBranch_1 = this.branches.getBranch('0');
            // move own parents to keepBranch
            var ownParents = this.parents.getAll();
            ownParents.forEach(function (parent) {
                // console.log('ownParent: ' + parent.id);
                var branchKey = parent.branches.getKeyOfNode(_this);
                parent.branches.setBranch(branchKey, keepBranch_1);
                // remove parents from own list
                // this will auto-remove the connection to the other '1'-branch
                _this.parents.remove(parent);
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
    };
    return InternalNode;
}(AbstractNode));
export { InternalNode };
//# sourceMappingURL=internal-node.js.map