import { nextNodeId } from './util.js';
import { findSimilarNode } from './find-similar-node.js';
export class AbstractNode {
    level;
    id = nextNodeId();
    deleted = false;
    type;
    rootNode;
    constructor(level, rootNode, type) {
        this.level = level;
        this.type = type;
        this.rootNode = rootNode;
        if (rootNode) {
            this.rootNode.addNode(this);
        }
    }
    isEqualToOtherNode(otherNode, 
    // optimisation shortcut, is faster if own string already known
    ownString = this.toString()) {
        const ret = ownString === otherNode.toString();
        return ret;
    }
    // deletes the whole node
    remove() {
        this.ensureNotDeleted('remove');
        // console.log('AbstractNode().remove() node: ' + this.id);
        // console.log(this.toJSON(true));
        if (this.isInternalNode()) {
            const useNode = this;
            if (useNode.parents.size > 0) {
                throw new Error('cannot remove node with parents ' + this.id);
            }
        }
        if (this.branches) {
            const useNode = this;
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
    }
    toJSON(withId = false) {
        const ret = {
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
            const branches = this.branches;
            ret.branches = {
                '0': branches.getBranch('0').toJSON(withId),
                '1': branches.getBranch('1').toJSON(withId)
            };
        }
        return ret;
    }
    // a strange string-representation
    // to make an equal check between nodes
    toString() {
        let ret = '' +
            '<' +
            this.type + ':' + this.level;
        if (this.branches) {
            const branches = this.branches;
            ret += '|0:' + branches.getBranch('0');
            ret += '|1:' + branches.getBranch('1');
        }
        if (this.isLeafNode()) {
            ret += '|v:' + this.asLeafNode().value;
        }
        ret += '>';
        return ret;
    }
    isRootNode() {
        return this.type === 'RootNode';
    }
    isInternalNode() {
        return this.type === 'InternalNode';
    }
    isLeafNode() {
        return this.type === 'LeafNode';
    }
    asRootNode() {
        if (!this.isRootNode()) {
            throw new Error('ouch');
        }
        return this;
    }
    asInternalNode() {
        if (!this.isInternalNode()) {
            throw new Error('ouch');
        }
        return this;
    }
    asLeafNode() {
        if (!this.isLeafNode()) {
            throw new Error('ouch');
        }
        return this;
    }
    ensureNotDeleted(op = 'unknown') {
        if (this.deleted) {
            throw new Error('forbidden operation ' + op + ' on deleted node ' + this.id);
        }
    }
    log() {
        console.log(JSON.stringify(this.toJSON(true), null, 2));
    }
    /**
 * by the elimination-rule of bdd,
 * if two branches of the same level are equal,
 * one can be removed
 *
 * See page 21 at:
 * @link https://people.eecs.berkeley.edu/~sseshia/219c/lectures/BinaryDecisionDiagrams.pdf
 */
    applyEliminationRule(
    // can be provided for better performance
    nodesOfSameLevel) {
        this.ensureNotDeleted('applyEliminationRule');
        if (!nodesOfSameLevel) {
            nodesOfSameLevel = this.rootNode.getNodesOfLevel(this.level);
        }
        const other = findSimilarNode(this, nodesOfSameLevel);
        if (other) {
            // console.log('applyEliminationRule() remove:' + this.id + '; other: ' + other.id);
            // keep 'other', remove 'this'
            // move own parents to other
            const ownParents = this.parents.getAll();
            const parentsWithStrictEqualBranches = [];
            ownParents.forEach((parent) => {
                // console.log('ownParent: ' + parent.id);
                const branchKey = parent.branches.getKeyOfNode(this);
                // console.log('branchKey: ' + branchKey);
                parent.branches.setBranch(branchKey, other);
                if (parent.branches.areBranchesStrictEqual()) {
                    parentsWithStrictEqualBranches.push(parent);
                }
                // remove parents from own list
                // this will auto-remove the connection to the other '1'-branch
                this.parents.remove(parent);
            });
            // parents that now have equal branches, must be removed again
            parentsWithStrictEqualBranches.forEach(node => {
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
    }
}
//# sourceMappingURL=abstract-node.js.map