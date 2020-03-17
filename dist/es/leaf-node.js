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
import { Parents } from './parents';
import { AbstractNode } from './abstract-node';
import { oppositeBoolean } from './util';
var LeafNode = /** @class */ (function (_super) {
    __extends(LeafNode, _super);
    function LeafNode(level, rootNode, value, parent) {
        var _this = _super.call(this, level, rootNode, 'LeafNode') || this;
        _this.value = value;
        _this.parents = new Parents(_this);
        _this.parents.add(parent);
        return _this;
    }
    LeafNode.prototype.removeIfValueEquals = function (value) {
        var _this = this;
        this.ensureNotDeleted();
        if (this.value !== value) {
            return false;
        }
        var parents = this.parents.getAll();
        parents.forEach(function (parent) {
            var branchKey = parent.branches.getKeyOfNode(_this);
            var otherBranch = parent.branches.getBranch(oppositeBoolean(branchKey));
            _this.parents.remove(parent);
            parent.branches.setBranch(branchKey, otherBranch);
            if (parent.isInternalNode()) {
                parent.applyReductionRule();
            }
        });
        return true;
    };
    return LeafNode;
}(AbstractNode));
export { LeafNode };
//# sourceMappingURL=leaf-node.js.map