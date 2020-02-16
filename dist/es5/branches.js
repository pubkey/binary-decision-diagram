"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * represents the branches of a single node
 */
var Branches = /** @class */ (function () {
    function Branches(node) {
        this.node = node;
        this.deleted = false;
        this.branches = {};
    }
    Branches.prototype.setBranch = function (which, branchNode) {
        var previous = this.branches[which];
        if (previous === branchNode) {
            return;
        }
        // set new branch
        this.branches[which] = branchNode;
        branchNode.parents.add(this.node);
    };
    Branches.prototype.getKeyOfNode = function (node) {
        if (this.getBranch('0') === node) {
            return '0';
        }
        else if (this.getBranch('1') === node) {
            return '1';
        }
        else {
            throw new Error('none matched');
        }
    };
    Branches.prototype.getBranch = function (which) {
        return this.branches[which];
    };
    Branches.prototype.getBothBranches = function () {
        return [
            this.getBranch('0'),
            this.getBranch('1')
        ];
    };
    Branches.prototype.hasBranchAsNode = function (node) {
        if (this.getBranch('0') === node ||
            this.getBranch('1') === node) {
            return true;
        }
        else {
            return false;
        }
    };
    Branches.prototype.hasNodeIdAsBranch = function (id) {
        if (this.getBranch('0').id === id ||
            this.getBranch('1').id === id) {
            return true;
        }
        else {
            return false;
        }
    };
    Branches.prototype.areBranchesStrictEqual = function () {
        return this.branches['0'] === this.branches['1'];
    };
    Branches.prototype.hasEqualBranches = function () {
        return JSON.stringify(this.branches['0']) ===
            JSON.stringify(this.branches['1']);
    };
    return Branches;
}());
exports.Branches = Branches;
function ensureNodesNotStrictEqual(node1, node2) {
    if (node1 === node2) {
        throw new Error('cannot have two strict equal branches');
    }
}
exports.ensureNodesNotStrictEqual = ensureNodesNotStrictEqual;
//# sourceMappingURL=branches.js.map