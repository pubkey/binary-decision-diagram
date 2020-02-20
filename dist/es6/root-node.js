import { AbstractNode } from './abstract-node';
import { Branches } from './branches';
import { lastOfArray, booleanToBooleanString } from './util';
export class RootNode extends AbstractNode {
    constructor() {
        super(0, null, 'RootNode');
        this.branches = new Branches(this);
        this.levels = [];
        this.nodesByLevel = new Map();
        this.levels.push(0);
        const level0Set = new Set();
        level0Set.add(this);
        this.nodesByLevel.set(0, level0Set);
    }
    addNode(node) {
        var _a;
        const level = node.level;
        if (!this.levels.includes(level)) {
            this.levels.push(level);
        }
        this.ensureLevelSetExists(level);
        const set = this.nodesByLevel.get(level);
        (_a = set) === null || _a === void 0 ? void 0 : _a.add(node);
    }
    removeNode(node) {
        const set = this.nodesByLevel.get(node.level);
        if (!set.has(node)) {
            throw new Error('removed non-existing node ' + node.id);
        }
        set.delete(node);
    }
    ensureLevelSetExists(level) {
        if (!this.nodesByLevel.has(level)) {
            this.nodesByLevel.set(level, new Set());
        }
    }
    getLevels() {
        return Array.from(this.levels).sort((a, b) => a - b);
    }
    getNodesOfLevel(level) {
        this.ensureLevelSetExists(level);
        const set = this.nodesByLevel.get(level);
        return Array.from(set);
    }
    countNodes() {
        let ret = 0;
        this.getLevels().forEach(level => {
            const nodesAmount = this.getNodesOfLevel(level).length;
            ret = ret + nodesAmount;
        });
        return ret;
    }
    /**
     * applies the reduction rules to the whole bdd
     */
    minimize(logState = false) {
        // console.log('minimize(): START ###############');
        let done = false;
        while (!done) {
            if (logState) {
                console.log('minimize() itterate once');
            }
            let successCount = 0;
            let lastLevel = lastOfArray(this.getLevels());
            while (lastLevel > 0) {
                const nodes = this.getNodesOfLevel(lastLevel);
                if (logState) {
                    console.log('minimize() run for level ' + lastLevel +
                        ' with ' + nodes.length + ' nodes');
                    // console.dir(nodes);
                }
                let nodeCount = 0;
                for (const node of nodes) {
                    nodeCount++;
                    // do not run that often because it is expensive
                    if (logState && nodeCount % 4000 === 0) {
                        console.log('minimize() node #' + node.id);
                    }
                    if (node.isLeafNode()) {
                        // console.log('have leaf node ' + node.id);
                        const reductionDone = node.asLeafNode().applyEliminationRule();
                        if (reductionDone) {
                            successCount++;
                        }
                    }
                    if (!node.deleted && node.isInternalNode()) {
                        const useNode = node;
                        const reductionDone = useNode.applyReductionRule();
                        let eliminationDone = false;
                        if (!useNode.deleted) {
                            // not might now be deleted from reduction-rule
                            eliminationDone = useNode.applyEliminationRule(nodes);
                        }
                        if (reductionDone || eliminationDone) {
                            successCount++;
                        }
                    }
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
    }
    getLeafNodes() {
        const lastLevel = lastOfArray(this.getLevels());
        const leafNodes = this.getNodesOfLevel(lastLevel).reverse();
        return leafNodes;
    }
    /**
     * strips all leaf-nodes
     * with the given value
     */
    removeIrrelevantLeafNodes(leafNodeValue) {
        let done = false;
        while (!done) {
            let countRemoved = 0;
            const leafNodes = this.getLeafNodes();
            for (const leafNode of leafNodes) {
                const removed = leafNode.removeIfValueEquals(leafNodeValue);
                if (removed) {
                    countRemoved++;
                }
            }
            this.minimize();
            if (countRemoved === 0) {
                done = true;
            }
        }
    }
    resolve(fns, booleanFunctionInput) {
        let currentNode = this;
        while (true) {
            const booleanResult = fns[currentNode.level](booleanFunctionInput);
            const branchKey = booleanToBooleanString(booleanResult);
            currentNode = currentNode.branches.getBranch(branchKey);
            if (currentNode.isLeafNode()) {
                return currentNode.asLeafNode().value;
            }
        }
    }
}
//# sourceMappingURL=root-node.js.map