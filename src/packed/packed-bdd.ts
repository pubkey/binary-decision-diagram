import type { RootNode } from '../root-node.js';
import type { AbstractNode } from '../abstract-node.js';
import type { NonLeafNode, ResolverFunctions } from '../types.js';

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
    const branchesOf = (node: AbstractNode) => (node as NonLeafNode).branches;

    // breadth first, branch 0 before branch 1, so the output is deterministic
    const nonLeafNodes: AbstractNode[] = [bdd];
    const idByNode = new Map<AbstractNode, number>([[bdd, 0]]);
    for (let i = 0; i < nonLeafNodes.length; i++) {
        const branches = branchesOf(nonLeafNodes[i]);
        for (const child of [branches.getBranch('0'), branches.getBranch('1')]) {
            if (!child.isLeafNode() && !idByNode.has(child)) {
                idByNode.set(child, nonLeafNodes.length);
                nonLeafNodes.push(child);
            }
        }
    }

    const n = nonLeafNodes.length;
    const ref = (node: AbstractNode): number => {
        if (!node.isLeafNode()) {
            return idByNode.get(node) as number;
        }
        const value = node.asLeafNode().value;
        if (!Number.isInteger(value) || value < 0) {
            throw new Error('PackedBdd only supports non-negative integer leaf values, got ' + value);
        }
        return n + value;
    };
    const entries: number[] = [];
    let max = 0;
    nonLeafNodes.forEach(node => {
        const branches = branchesOf(node);
        const nodeEntries = [node.level, ref(branches.getBranch('0')), ref(branches.getBranch('1'))];
        nodeEntries.forEach(entry => {
            entries.push(entry);
            max = Math.max(max, entry);
        });
    });

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
