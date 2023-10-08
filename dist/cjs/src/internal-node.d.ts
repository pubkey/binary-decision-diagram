import { Branches } from './branches.js';
import { Parents } from './parents.js';
import { RootNode } from './root-node.js';
import { AbstractNode } from './abstract-node.js';
import type { NonLeafNode } from './types.js';
export declare class InternalNode extends AbstractNode {
    branches: Branches;
    parents: Parents;
    constructor(level: number, rootNode: RootNode, parent: NonLeafNode);
    /**
     * by the reduction-rule of bdd,
     * if both branches are equal,
     * we can remove this node from the bdd
     */
    applyReductionRule(): boolean;
}
