import { RootNode } from '../root-node';
import { AbstractNode } from '../abstract-node';
export declare function bddToMinimalString(bdd: RootNode): string;
export declare function nodeToString(node: AbstractNode, idByNode: Map<AbstractNode, string>, lastCode: number): {
    id: string;
    str: string;
    nextCode: number;
};
