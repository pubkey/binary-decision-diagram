import { RootNode } from '../root-node.js';
import { AbstractNode } from '../abstract-node.js';
export declare function bddToMinimalString(bdd: RootNode): string;
export declare function nodeToString(node: AbstractNode, idByNode: Map<AbstractNode, string>, lastCode: number): {
    id: string;
    str: string;
    nextCode: number;
};
