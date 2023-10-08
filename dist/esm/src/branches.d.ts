import type { BooleanString, NonRootNode, NonLeafNode } from './types.js';
import { AbstractNode } from './abstract-node.js';
/**
 * represents the branches of a single node
 */
export declare class Branches {
    private node;
    deleted: boolean;
    private branches;
    constructor(node: NonLeafNode);
    setBranch(which: BooleanString, branchNode: NonRootNode): void;
    getKeyOfNode(node: NonRootNode): BooleanString;
    getBranch(which: BooleanString): NonRootNode;
    getBothBranches(): NonRootNode[];
    hasBranchAsNode(node: AbstractNode): boolean;
    hasNodeIdAsBranch(id: string): boolean;
    areBranchesStrictEqual(): boolean;
    hasEqualBranches(): boolean;
}
export declare function ensureNodesNotStrictEqual(node1: NonRootNode, node2: NonRootNode): void;
