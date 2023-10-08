import type { NonLeafNode, NonRootNode } from './types.js';
/**
 * represents the parents of a single node
 */
export declare class Parents {
    node: NonRootNode;
    private parents;
    constructor(node: NonRootNode);
    remove(node: NonLeafNode): void;
    getAll(): NonLeafNode[];
    add(node: NonLeafNode): void;
    has(node: NonLeafNode): boolean;
    toString(): string;
    get size(): number;
}
