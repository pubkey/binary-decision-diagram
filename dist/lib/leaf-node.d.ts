import { Parents } from './parents';
import { AbstractNode } from './abstract-node';
import { RootNode } from './root-node';
import { NonLeafNode } from './types';
export declare class LeafNode extends AbstractNode {
    value: number;
    parents: Parents;
    constructor(level: number, rootNode: RootNode, value: number, parent: NonLeafNode);
    removeIfValueEquals(value: number): boolean;
}
