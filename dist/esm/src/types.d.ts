import type { LeafNode } from './leaf-node.js';
import type { InternalNode } from './internal-node.js';
import type { RootNode } from './root-node.js';
export type NodeType = 'LeafNode' | 'InternalNode' | 'RootNode';
export type NonLeafNode = InternalNode | RootNode;
export type NonRootNode = InternalNode | LeafNode;
export type TruthTable = Map<string, number>;
export type BooleanString = '0' | '1';
export type ResolverFunction<T> = (i: T) => boolean;
export type ResolverFunctions<T = any> = {
    [k: number]: ResolverFunction<T>;
};
export type SimpleBddLeafNode = number;
/**
 * a simple bdd is a json-representation
 * which could be parsed from the minimal string
 * use this to have great performance
 * when resolving values
 */
export type SimpleBdd = {
    0: SimpleBdd | SimpleBddLeafNode;
    1: SimpleBdd | SimpleBddLeafNode;
    l: number;
};
