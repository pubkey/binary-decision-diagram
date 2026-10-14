import type { LeafNode } from './leaf-node.js';
import type { InternalNode } from './internal-node.js';
import type { RootNode } from './root-node.js';

export type NodeType = 'LeafNode' | 'InternalNode' | 'RootNode';

export type NonLeafNode = InternalNode | RootNode;
export type NonRootNode = InternalNode | LeafNode;

// maps state-set to value
export type TruthTable = Map<string, number>;

export type BooleanString = '0' | '1';

export type ResolverFunction<T> = (i: T) => boolean;

export type ResolverFunctions<T = any> = {
    [k: number]: ResolverFunction<T>;
};
