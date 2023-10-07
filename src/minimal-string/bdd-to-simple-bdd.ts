import { RootNode } from '../root-node.js';
import {
    SimpleBdd
} from '../types.js';
import { AbstractNode } from '../abstract-node.js';
import { InternalNode } from '../internal-node.js';

/**
 * @recursive
 */
export function bddToSimpleBdd(bdd: RootNode): SimpleBdd {
    return nodeToSimpleBddNode(bdd);
}


/**
 * @recursive
 */
export function nodeToSimpleBddNode(
    node: AbstractNode
): SimpleBdd {

    const branch0: AbstractNode = (node as InternalNode).branches.getBranch('0');
    const branch1: AbstractNode = (node as InternalNode).branches.getBranch('1');

    return {
        l: node.level,
        0: branch0.isLeafNode() ? branch0.asLeafNode().value : nodeToSimpleBddNode(branch0),
        1: branch1.isLeafNode() ? branch1.asLeafNode().value : nodeToSimpleBddNode(branch1),
    };
}
