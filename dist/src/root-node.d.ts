import { AbstractNode } from './abstract-node.js';
import { Branches } from './branches.js';
import type { NonRootNode, ResolverFunctions, SimpleBdd } from './types.js';
import { LeafNode } from './leaf-node.js';
export declare class RootNode extends AbstractNode {
    branches: Branches;
    levels: number[];
    nodesByLevel: Map<number, Set<AbstractNode>>;
    constructor();
    addNode(node: NonRootNode): void;
    removeNode(node: NonRootNode): void;
    private ensureLevelSetExists;
    getLevels(): number[];
    getNodesOfLevel(level: number): NonRootNode[];
    countNodes(): number;
    /**
     * applies the reduction rules to the whole bdd
     */
    minimize(logState?: boolean): void;
    getLeafNodes(): LeafNode[];
    /**
     * strips all leaf-nodes
     * with the given value
     */
    removeIrrelevantLeafNodes(leafNodeValue: number): void;
    resolve(fns: ResolverFunctions, booleanFunctionInput: any): number;
    toSimpleBdd(): SimpleBdd;
}
