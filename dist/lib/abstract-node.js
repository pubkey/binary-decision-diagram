"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var util_1 = require("./util");
var find_similar_node_1 = require("./find-similar-node");
var AbstractNode = /** @class */ (function () {
    function AbstractNode(level, rootNode, type) {
        this.level = level;
        this.id = util_1.nextNodeId();
        this.deleted = false;
        this.type = type;
        this.rootNode = rootNode;
        if (rootNode) {
            this.rootNode.addNode(this);
        }
    }
    AbstractNode.prototype.isEqualToOtherNode = function (otherNode, 
    // optimisation shortcut, is faster if own string already known
    ownString) {
        if (ownString === void 0) { ownString = this.toString(); }
        var ret = ownString === otherNode.toString();
        return ret;
    };
    // deletes the whole node
    AbstractNode.prototype.remove = function () {
        this.ensureNotDeleted('remove');
        // console.log('AbstractNode().remove() node: ' + this.id);
        // console.log(this.toJSON(true));
        if (this.isInternalNode()) {
            var useNode = this;
            if (useNode.parents.size > 0) {
                throw new Error('cannot remove node with parents ' + this.id);
            }
        }
        if (this.branches) {
            var useNode = this;
            if (useNode.branches.areBranchesStrictEqual()) {
                useNode.branches.getBranch('0').parents.remove(useNode);
            }
            else {
                useNode.branches.getBranch('0').parents.remove(useNode);
                useNode.branches.getBranch('1').parents.remove(useNode);
            }
        }
        this.deleted = true;
        this.rootNode.removeNode(this);
    };
    AbstractNode.prototype.toJSON = function (withId) {
        if (withId === void 0) { withId = false; }
        var ret = {
            id: withId ? this.id : undefined,
            deleted: withId ? this.deleted : undefined,
            type: this.type,
            level: this.level
        };
        if (withId && this.parents) {
            ret.parents = this.parents.toString();
        }
        if (this.isLeafNode()) {
            ret.value = this.asLeafNode().value;
        }
        if (this.branches && !this.branches.deleted) {
            var branches = this.branches;
            ret.branches = {
                '0': branches.getBranch('0').toJSON(withId),
                '1': branches.getBranch('1').toJSON(withId)
            };
        }
        return ret;
    };
    // a strange string-representation
    // to make an equal check between nodes
    AbstractNode.prototype.toString = function () {
        var ret = '' +
            '<' +
            this.type + ':' + this.level;
        if (this.branches) {
            var branches = this.branches;
            ret += '|0:' + branches.getBranch('0');
            ret += '|1:' + branches.getBranch('1');
        }
        if (this.isLeafNode()) {
            ret += '|v:' + this.asLeafNode().value;
        }
        ret += '>';
        return ret;
    };
    AbstractNode.prototype.isRootNode = function () {
        return this.type === 'RootNode';
    };
    AbstractNode.prototype.isInternalNode = function () {
        return this.type === 'InternalNode';
    };
    AbstractNode.prototype.isLeafNode = function () {
        return this.type === 'LeafNode';
    };
    AbstractNode.prototype.asRootNode = function () {
        if (!this.isRootNode()) {
            throw new Error('ouch');
        }
        return this;
    };
    AbstractNode.prototype.asInternalNode = function () {
        if (!this.isInternalNode()) {
            throw new Error('ouch');
        }
        return this;
    };
    AbstractNode.prototype.asLeafNode = function () {
        if (!this.isLeafNode()) {
            throw new Error('ouch');
        }
        return this;
    };
    AbstractNode.prototype.ensureNotDeleted = function (op) {
        if (op === void 0) { op = 'unknown'; }
        if (this.deleted) {
            throw new Error('forbidden operation ' + op + ' on deleted node ' + this.id);
        }
    };
    AbstractNode.prototype.log = function () {
        console.log(JSON.stringify(this.toJSON(true), null, 2));
    };
    /**
 * by the elimination-rule of bdd,
 * if two branches of the same level are equal,
 * one can be removed
 *
 * See page 21 at:
 * @link https://people.eecs.berkeley.edu/~sseshia/219c/lectures/BinaryDecisionDiagrams.pdf
 */
    AbstractNode.prototype.applyEliminationRule = function (
    // can be provided for better performance
    nodesOfSameLevel) {
        var _this = this;
        this.ensureNotDeleted('applyEliminationRule');
        if (!nodesOfSameLevel) {
            nodesOfSameLevel = this.rootNode.getNodesOfLevel(this.level);
        }
        var other = find_similar_node_1.findSimilarNode(this, nodesOfSameLevel);
        if (other) {
            // console.log('applyEliminationRule() remove:' + this.id + '; other: ' + other.id);
            // keep 'other', remove 'this'
            // move own parents to other
            var ownParents = this.parents.getAll();
            var parentsWithStrictEqualBranches_1 = [];
            ownParents.forEach(function (parent) {
                // console.log('ownParent: ' + parent.id);
                var branchKey = parent.branches.getKeyOfNode(_this);
                // console.log('branchKey: ' + branchKey);
                parent.branches.setBranch(branchKey, other);
                if (parent.branches.areBranchesStrictEqual()) {
                    parentsWithStrictEqualBranches_1.push(parent);
                }
                // remove parents from own list
                // this will auto-remove the connection to the other '1'-branch
                _this.parents.remove(parent);
            });
            // parents that now have equal branches, must be removed again
            parentsWithStrictEqualBranches_1.forEach(function (node) {
                if (node.isInternalNode()) {
                    // console.log('trigger applyReductionRule from applyEliminationRule');
                    node.applyReductionRule();
                }
            });
            return true;
        }
        else {
            return false;
        }
    };
    return AbstractNode;
}());
exports.AbstractNode = AbstractNode;
//# sourceMappingURL=abstract-node.js.map