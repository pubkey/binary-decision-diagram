import { NonRootNode, NodeType } from './types';
import { RootNode } from './root-node';
import { InternalNode } from './internal-node';
import { LeafNode } from './leaf-node';
export declare class AbstractNode {
    level: number;
    readonly id: string;
    deleted: boolean;
    type: NodeType;
    rootNode: RootNode;
    constructor(level: number, rootNode: RootNode | null, type: NodeType);
    isEqualToOtherNode(otherNode: NonRootNode | RootNode, ownString?: string): boolean;
    remove(): void;
    toJSON(withId?: boolean): any;
    toString(): string;
    isRootNode(): boolean;
    isInternalNode(): boolean;
    isLeafNode(): boolean;
    asRootNode(): RootNode;
    asInternalNode(): InternalNode;
    asLeafNode(): LeafNode;
    ensureNotDeleted(op?: string): void;
    log(): void;
    /**
 * by the elimination-rule of bdd,
 * if two branches of the same level are equal,
 * one can be removed
 *
 * See page 21 at:
 * @link https://people.eecs.berkeley.edu/~sseshia/219c/lectures/BinaryDecisionDiagrams.pdf
 */
    applyEliminationRule<T extends AbstractNode>(nodesOfSameLevel?: T[]): boolean;
}
