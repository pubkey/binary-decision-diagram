import { RootNode } from '../root-node.js';
import { SimpleBdd } from '../types.js';
import { AbstractNode } from '../abstract-node.js';
/**
 * @recursive
 */
export declare function bddToSimpleBdd(bdd: RootNode): SimpleBdd;
/**
 * @recursive
 */
export declare function nodeToSimpleBddNode(node: AbstractNode): SimpleBdd;
