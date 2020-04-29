import { AbstractNode } from './abstract-node';
/**
 * find an simliar node in a list of nodes
 * which is not exactly the same node
 * @hotpath
 */
export declare function findSimilarNode<T extends AbstractNode>(own: T, others: T[]): T | null;
