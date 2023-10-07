import { AbstractNode } from './abstract-node.js';
import { Branches } from './branches.js';
import type {
    NonRootNode,
    ResolverFunctions,
    NonLeafNode,
    SimpleBdd
} from './types.js';
import {
    lastOfArray,
    booleanToBooleanString
} from './util.js';
import { InternalNode } from './internal-node.js';
import { LeafNode } from './leaf-node.js';
import { bddToSimpleBdd } from './minimal-string/index.js';

export class RootNode extends AbstractNode {
    public branches: Branches = new Branches(this);

    public levels: number[] = [];
    public nodesByLevel: Map<number, Set<AbstractNode>> = new Map();

    constructor() {
        super(
            0,
            null,
            'RootNode'
        );
        this.levels.push(0);
        const level0Set: Set<AbstractNode> = new Set();
        level0Set.add(this);
        this.nodesByLevel.set(0, level0Set);
    }

    public addNode(node: NonRootNode) {
        const level = node.level;

        if (!this.levels.includes(level)) {
            this.levels.push(level);
        }

        this.ensureLevelSetExists(level);
        const set = this.nodesByLevel.get(level);
        set?.add(node);
    }

    removeNode(node: NonRootNode) {
        const set = this.nodesByLevel.get(node.level) as Set<NonRootNode>;
        if (!set.has(node)) {
            throw new Error('removed non-existing node ' + node.id);
        }
        set.delete(node);
    }

    private ensureLevelSetExists(level: number) {
        if (!this.nodesByLevel.has(level)) {
            this.nodesByLevel.set(level, new Set());
        }
    }

    public getLevels(): number[] {
        return Array.from(this.levels).sort((a, b) => a - b);
    }

    public getNodesOfLevel(level: number): NonRootNode[] {
        this.ensureLevelSetExists(level);
        const set = this.nodesByLevel.get(level) as Set<NonRootNode>;
        return Array.from(set);
    }

    public countNodes(): number {
        let ret: number = 0;
        this.getLevels().forEach(level => {
            const nodesAmount = this.getNodesOfLevel(level).length;
            ret = ret + nodesAmount;
        });
        return ret;
    }

    /**
     * applies the reduction rules to the whole bdd
     */
    minimize(logState: boolean = false) {
        // console.log('minimize(): START ###############');
        let done = false;
        while (!done) {
            if (logState) {
                console.log('minimize() itterate once');
            }
            let successCount = 0;
            let lastLevel = lastOfArray(this.getLevels());
            while (lastLevel > 0) {
                const nodes: InternalNode[] = this.getNodesOfLevel(lastLevel) as InternalNode[];
                if (logState) {
                    console.log(
                        'minimize() run for level ' + lastLevel +
                        ' with ' + nodes.length + ' nodes'
                    );
                    // console.dir(nodes);
                }

                let nodeCount = 0;
                for (const node of nodes) {
                    nodeCount++;

                    // do not run that often because it is expensive
                    if (logState && nodeCount % 4000 === 0) {
                        console.log(
                            'minimize() node #' + node.id
                        );
                    }
                    if (node.isLeafNode()) {
                        // console.log('have leaf node ' + node.id);
                        const reductionDone = node.asLeafNode().applyEliminationRule();
                        if (reductionDone) {
                            successCount++;
                        }
                    }
                    if (!node.deleted && node.isInternalNode()) {
                        const useNode = node as InternalNode;
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
            } else {
                if (logState) {
                    console.log(
                        'minimize() itteration done with ' +
                        successCount + ' minimisations'
                    );
                }
            }
        }
    }

    public getLeafNodes(): LeafNode[] {
        const lastLevel = lastOfArray(this.getLevels());
        const leafNodes = this.getNodesOfLevel(lastLevel).reverse() as LeafNode[];
        return leafNodes;
    }

    /**
     * strips all leaf-nodes
     * with the given value
     */
    removeIrrelevantLeafNodes(leafNodeValue: number) {
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

    resolve(
        fns: ResolverFunctions,
        booleanFunctionInput: any
    ): number {
        let currentNode: AbstractNode = this;
        while (true) {
            const booleanResult = fns[currentNode.level](booleanFunctionInput);
            const branchKey = booleanToBooleanString(booleanResult);
            currentNode = (currentNode as NonLeafNode).branches.getBranch(branchKey);
            if (currentNode.isLeafNode()) {
                return currentNode.asLeafNode().value;
            }
        }
    }

    public toSimpleBdd(): SimpleBdd {
        return bddToSimpleBdd(this);
    }
}
