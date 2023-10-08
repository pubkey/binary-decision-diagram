import { RootNode } from './root-node.js';
import { AbstractNode } from './abstract-node.js';
/**
 * run some tests on the bdd
 * to ensure everything is correct
 */
export declare function ensureCorrectBdd(bdd: RootNode): void;
export declare function getNodesRecursive(node: AbstractNode, set?: Set<AbstractNode>): Set<AbstractNode>;
