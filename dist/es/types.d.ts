import { LeafNode } from './leaf-node';
import { InternalNode } from './internal-node';
import { RootNode } from './root-node';
export declare type NodeType = 'LeafNode' | 'InternalNode' | 'RootNode';
export declare type NonLeafNode = InternalNode | RootNode;
export declare type NonRootNode = InternalNode | LeafNode;
export declare type TruthTable = Map<string, number>;
export declare type BooleanString = '0' | '1';
export declare type ResolverFunction<T> = (i: T) => boolean;
export declare type ResolverFunctions<T = any> = {
    [k: number]: ResolverFunction<T>;
};
export declare type SimpleBddLeafNode = number;
/**
 * a simple bdd is a json-representation
 * which could be parsed from the minimal string
 * use this to have great performance
 * when resolving values
 */
export declare type SimpleBdd = {
    0: SimpleBdd | SimpleBddLeafNode;
    1: SimpleBdd | SimpleBddLeafNode;
    l: number;
};
