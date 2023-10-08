import { Parents } from './parents.js';
import { AbstractNode } from './abstract-node.js';
import { RootNode } from './root-node.js';
import type { NonLeafNode } from './types.js';
export declare class LeafNode extends AbstractNode {
    value: number;
    parents: Parents;
    constructor(level: number, rootNode: RootNode, value: number, parent: NonLeafNode);
    removeIfValueEquals(value: number): boolean;
}
