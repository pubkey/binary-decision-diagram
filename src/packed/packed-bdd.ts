import type { RootNode } from '../root-node.js';
import type { AbstractNode } from '../abstract-node.js';
import type { NonLeafNode, ResolverFunctions, SimpleBdd, SimpleBddLeafNode } from '../types.js';

/*

A PackedBdd is the whole BDD in a single typed array.
It can be resolved directly without creating any JavaScript objects,
so there is nothing to parse on startup.

Layout:
- Every non-leaf node takes three consecutive entries: [level, ref0, ref1]
  - level is the index of the boolean function
  - ref0 is the reference that is followed when the boolean function returns false
  - ref1 is the reference that is followed when it returns true
- The node with the id x starts at index 3 * x, the root node has the id 0.
- With n = array.length / 3 (the amount of non-leaf nodes), a reference r
    - r < n points to the non-leaf node with the id r
    - r >= n is a leaf node with the value r - n

The narrowest array type that fits all entries is used,
so a BDD with less than ~250 nodes and values only needs 3 bytes per node.

*/

export type PackedBdd = Uint8Array | Uint16Array | Uint32Array;

/**
 * Creates a PackedBdd from a (minimized) BDD.
 * The leaf values must be non-negative integers.
 */
export function bddToPackedBdd(bdd: RootNode): PackedBdd {
    return pack<AbstractNode>(
        bdd,
        node => node.isLeafNode(),
        node => node.asLeafNode().value,
        node => node.level,
        (node, branch) => (node as NonLeafNode).branches.getBranch(branch === 0 ? '0' : '1')
    );
}

/**
 * Creates a PackedBdd from a SimpleBdd,
 * for example to convert a string from bddToMinimalString()
 * via minimalStringToSimpleBdd() without having to recreate the BDD.
 * Nodes are deduplicated by object identity, so use the result of minimalStringToSimpleBdd()
 * and not the one of bddToSimpleBdd() which repeats shared sub-graphs.
 */
export function simpleBddToPackedBdd(simpleBdd: SimpleBdd): PackedBdd {
    return pack<SimpleBdd | SimpleBddLeafNode>(
        simpleBdd,
        node => typeof node !== 'object',
        node => node as SimpleBddLeafNode,
        node => (node as SimpleBdd).l,
        (node, branch) => (node as SimpleBdd)[branch]
    );
}

function pack<T>(
    root: T,
    isLeaf: (node: T) => boolean,
    leafValue: (node: T) => number,
    level: (node: T) => number,
    branch: (node: T, branch: 0 | 1) => T
): PackedBdd {
    // breadth first, branch 0 before branch 1, so the output is deterministic
    const nonLeafNodes: T[] = [root];
    const idByNode = new Map<T, number>([[root, 0]]);
    for (let i = 0; i < nonLeafNodes.length; i++) {
        const node = nonLeafNodes[i];
        for (const b of [0, 1] as const) {
            const child = branch(node, b);
            if (!isLeaf(child) && !idByNode.has(child)) {
                idByNode.set(child, nonLeafNodes.length);
                nonLeafNodes.push(child);
            }
        }
    }

    const n = nonLeafNodes.length;
    const entries: number[] = [];
    const ref = (node: T): number => {
        if (!isLeaf(node)) {
            return idByNode.get(node) as number;
        }
        const value = leafValue(node);
        if (!Number.isInteger(value) || value < 0) {
            throw new Error('PackedBdd only supports non-negative integer leaf values, got ' + value);
        }
        return n + value;
    };
    nonLeafNodes.forEach(node => {
        entries.push(level(node), ref(branch(node, 0)), ref(branch(node, 1)));
    });

    const max = Math.max(...entries);
    if (max <= 0xFF) {
        return Uint8Array.from(entries);
    } else if (max <= 0xFFFF) {
        return Uint16Array.from(entries);
    } else if (max <= 0xFFFFFFFF) {
        return Uint32Array.from(entries);
    }
    throw new Error('BDD too big for a PackedBdd');
}

/**
 * Resolves a value by walking directly over the PackedBdd.
 * Works with every array type (also a plain number[]).
 */
export function resolveWithPackedBdd<T = any>(
    packedBdd: ArrayLike<number>,
    fns: ResolverFunctions<T>,
    input: T
): number {
    const n = packedBdd.length / 3;
    let i = 0;
    while (true) {
        const ref = packedBdd[fns[packedBdd[i]](input) ? i + 2 : i + 1];
        if (ref >= n) {
            return ref - n;
        }
        i = ref * 3;
    }
}
