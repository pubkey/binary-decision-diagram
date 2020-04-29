import { Branches } from './branches';
import { Parents } from './parents';
import { RootNode } from './root-node';
import { AbstractNode } from './abstract-node';
import { NonLeafNode } from './types';
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
