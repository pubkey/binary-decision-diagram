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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
import { AbstractNode } from './abstract-node';
import { Branches } from './branches';
import { lastOfArray, booleanToBooleanString } from './util';
import { bddToSimpleBdd } from './minimal-string';
var RootNode = /** @class */ (function (_super) {
    __extends(RootNode, _super);
    function RootNode() {
        var _this = _super.call(this, 0, null, 'RootNode') || this;
        _this.branches = new Branches(_this);
        _this.levels = [];
        _this.nodesByLevel = new Map();
        _this.levels.push(0);
        var level0Set = new Set();
        level0Set.add(_this);
        _this.nodesByLevel.set(0, level0Set);
        return _this;
    }
    RootNode.prototype.addNode = function (node) {
        var level = node.level;
        if (!this.levels.includes(level)) {
            this.levels.push(level);
        }
        this.ensureLevelSetExists(level);
        var set = this.nodesByLevel.get(level);
        set === null || set === void 0 ? void 0 : set.add(node);
    };
    RootNode.prototype.removeNode = function (node) {
        var set = this.nodesByLevel.get(node.level);
        if (!set.has(node)) {
            throw new Error('removed non-existing node ' + node.id);
        }
        set.delete(node);
    };
    RootNode.prototype.ensureLevelSetExists = function (level) {
        if (!this.nodesByLevel.has(level)) {
            this.nodesByLevel.set(level, new Set());
        }
    };
    RootNode.prototype.getLevels = function () {
        return Array.from(this.levels).sort(function (a, b) { return a - b; });
    };
    RootNode.prototype.getNodesOfLevel = function (level) {
        this.ensureLevelSetExists(level);
        var set = this.nodesByLevel.get(level);
        return Array.from(set);
    };
    RootNode.prototype.countNodes = function () {
        var _this = this;
        var ret = 0;
        this.getLevels().forEach(function (level) {
            var nodesAmount = _this.getNodesOfLevel(level).length;
            ret = ret + nodesAmount;
        });
        return ret;
    };
    /**
     * applies the reduction rules to the whole bdd
     */
    RootNode.prototype.minimize = function (logState) {
        var e_1, _a;
        if (logState === void 0) { logState = false; }
        // console.log('minimize(): START ###############');
        var done = false;
        while (!done) {
            if (logState) {
                console.log('minimize() itterate once');
            }
            var successCount = 0;
            var lastLevel = lastOfArray(this.getLevels());
            while (lastLevel > 0) {
                var nodes = this.getNodesOfLevel(lastLevel);
                if (logState) {
                    console.log('minimize() run for level ' + lastLevel +
                        ' with ' + nodes.length + ' nodes');
                    // console.dir(nodes);
                }
                var nodeCount = 0;
                try {
                    for (var nodes_1 = (e_1 = void 0, __values(nodes)), nodes_1_1 = nodes_1.next(); !nodes_1_1.done; nodes_1_1 = nodes_1.next()) {
                        var node = nodes_1_1.value;
                        nodeCount++;
                        // do not run that often because it is expensive
                        if (logState && nodeCount % 4000 === 0) {
                            console.log('minimize() node #' + node.id);
                        }
                        if (node.isLeafNode()) {
                            // console.log('have leaf node ' + node.id);
                            var reductionDone = node.asLeafNode().applyEliminationRule();
                            if (reductionDone) {
                                successCount++;
                            }
                        }
                        if (!node.deleted && node.isInternalNode()) {
                            var useNode = node;
                            var reductionDone = useNode.applyReductionRule();
                            var eliminationDone = false;
                            if (!useNode.deleted) {
                                // not might now be deleted from reduction-rule
                                eliminationDone = useNode.applyEliminationRule(nodes);
                            }
                            if (reductionDone || eliminationDone) {
                                successCount++;
                            }
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (nodes_1_1 && !nodes_1_1.done && (_a = nodes_1.return)) _a.call(nodes_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                lastLevel--;
            }
            if (successCount === 0) {
                // could do no more optimisations
                done = true;
            }
            else {
                if (logState) {
                    console.log('minimize() itteration done with ' +
                        successCount + ' minimisations');
                }
            }
        }
    };
    RootNode.prototype.getLeafNodes = function () {
        var lastLevel = lastOfArray(this.getLevels());
        var leafNodes = this.getNodesOfLevel(lastLevel).reverse();
        return leafNodes;
    };
    /**
     * strips all leaf-nodes
     * with the given value
     */
    RootNode.prototype.removeIrrelevantLeafNodes = function (leafNodeValue) {
        var e_2, _a;
        var done = false;
        while (!done) {
            var countRemoved = 0;
            var leafNodes = this.getLeafNodes();
            try {
                for (var leafNodes_1 = (e_2 = void 0, __values(leafNodes)), leafNodes_1_1 = leafNodes_1.next(); !leafNodes_1_1.done; leafNodes_1_1 = leafNodes_1.next()) {
                    var leafNode = leafNodes_1_1.value;
                    var removed = leafNode.removeIfValueEquals(leafNodeValue);
                    if (removed) {
                        countRemoved++;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (leafNodes_1_1 && !leafNodes_1_1.done && (_a = leafNodes_1.return)) _a.call(leafNodes_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            this.minimize();
            if (countRemoved === 0) {
                done = true;
            }
        }
    };
    RootNode.prototype.resolve = function (fns, booleanFunctionInput) {
        var currentNode = this;
        while (true) {
            var booleanResult = fns[currentNode.level](booleanFunctionInput);
            var branchKey = booleanToBooleanString(booleanResult);
            currentNode = currentNode.branches.getBranch(branchKey);
            if (currentNode.isLeafNode()) {
                return currentNode.asLeafNode().value;
            }
        }
    };
    RootNode.prototype.toSimpleBdd = function () {
        return bddToSimpleBdd(this);
    };
    return RootNode;
}(AbstractNode));
export { RootNode };
//# sourceMappingURL=root-node.js.map