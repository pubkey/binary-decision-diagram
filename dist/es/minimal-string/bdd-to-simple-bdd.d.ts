import { RootNode } from '../root-node';
import { SimpleBdd } from '../types';
import { AbstractNode } from '../abstract-node';
/**
 * @recursive
 */
export declare function bddToSimpleBdd(bdd: RootNode): SimpleBdd;
/**
 * @recursive
 */
export declare function nodeToSimpleBddNode(node: AbstractNode): SimpleBdd;
