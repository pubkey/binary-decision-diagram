import type { DenseTruthTable } from './dense-truth-table.js';
import { ensureValidOrdering, withTerminalIds } from './dense-truth-table.js';

/**
 * Result of evaluating a variable ordering.
 */
export interface OrderingEvaluation {
    /**
     * nodesPerLevel[k] is the amount of nodes of the reduced BDD
     * that test the boolean function ordering[k].
     */
    nodesPerLevel: number[];
    /** sum of nodesPerLevel */
    internalNodeCount: number;
    /**
     * Amount of nodes as RootNode.countNodes() would return it:
     * the root node, plus all nodes below the top level, plus the leaf nodes.
     * This is the value that gets minimized.
     */
    nodeCount: number;
}

/**
 * A reduced ordered (multi terminal) decision diagram
 * in a flat array representation. Ids below terminalCount are terminals
 * (and equal the terminal id of the dense truth table), ids from terminalCount
 * on are internal nodes: node i is stored at index (i - terminalCount).
 */
export interface ReducedDiagram {
    variableCount: number;
    terminalCount: number;
    /** id of the root, can be a terminal when the function is constant */
    root: number;
    /** level (index into the ordering) of each internal node */
    nodeLevel: Int32Array;
    /** id of the 0-branch of each internal node */
    nodeLo: Int32Array;
    /** id of the 1-branch of each internal node */
    nodeHi: Int32Array;
    /** ordering[level] = boolean function tested on that level */
    ordering: number[];
    nodesPerLevel: number[];
}

/**
 * Evaluates variable orderings of a truth table without ever creating
 * BDD node objects.
 *
 * The reduced BDD is built bottom-up: the rows of the (permuted) truth table are
 * the leaves, every level above merges pairs of children into nodes through a
 * hash table (hash-consing). Equal children collapse to a single edge (reduction
 * rule) and equal (child0, child1) pairs share one node (elimination rule), so the
 * amount of nodes created per level is exactly the amount of nodes the reduced
 * BDD has on that level. Everything runs in O(2^n) integer operations.
 *
 * Don't-care rows are handled like RootNode.removeIrrelevantLeafNodes() does it:
 * a node whose one branch is entirely don't-care is replaced by its other branch.
 *
 * Buffers are allocated once and reused, so a single evaluator instance should
 * be used for many evaluations.
 */
export class OrderingEvaluator {
    public readonly variableCount: number;
    public readonly rowCount: number;
    /** amount of evaluations run so far */
    public evaluations: number = 0;

    private readonly terminalCount: number;
    private readonly dontCare: number;
    private readonly bufA: Int32Array;
    private readonly bufB: Int32Array;
    private readonly hashLo: Int32Array;
    private readonly hashHi: Int32Array;
    private readonly hashId: Int32Array;
    private readonly hashMask: number;
    private readonly scratch: Int32Array;

    constructor(
        public readonly table: DenseTruthTable
    ) {
        this.variableCount = table.variableCount;
        this.rowCount = table.rowCount;
        this.terminalCount = table.terminalValues.length;
        this.dontCare = table.dontCareTerminal;
        const half = Math.max(1, this.rowCount >>> 1);
        this.bufA = new Int32Array(half);
        this.bufB = new Int32Array(half);
        // at most rowCount/2 distinct nodes per level -> load factor <= 0.5
        let hashSize = 16;
        while (hashSize < this.rowCount) {
            hashSize *= 2;
        }
        this.hashLo = new Int32Array(hashSize);
        this.hashHi = new Int32Array(hashSize);
        this.hashId = new Int32Array(hashSize);
        this.hashMask = hashSize - 1;
        this.scratch = new Int32Array(this.rowCount);
    }

    /**
     * Fills `out` with the terminal ids in the order given by `ordering`:
     * the value of boolean function ordering[k] becomes bit (n - 1 - k)
     * of the index into `out`.
     */
    public permute(ordering: ArrayLike<number>, out: Int32Array = new Int32Array(this.rowCount)): Int32Array {
        ensureValidOrdering(ordering, this.variableCount);
        const n = this.variableCount;
        const src = this.table.terminalIds;
        const srcBit = new Int32Array(n);
        const dstBit = new Int32Array(n);
        for (let k = 0; k < n; k++) {
            srcBit[k] = n - 1 - ordering[k];
            dstBit[k] = n - 1 - k;
        }
        for (let row = 0; row < this.rowCount; row++) {
            let target = 0;
            for (let k = 0; k < n; k++) {
                target |= ((row >>> srcBit[k]) & 1) << dstBit[k];
            }
            out[target] = src[row];
        }
        return out;
    }

    /**
     * Swaps the variables of two levels inside a permuted table in place.
     */
    public swapLevels(permuted: Int32Array, levelA: number, levelB: number) {
        if (levelA === levelB) {
            return;
        }
        const n = this.variableCount;
        const bitA = n - 1 - levelA;
        const bitB = n - 1 - levelB;
        const maskA = 1 << bitA;
        const maskB = 1 << bitB;
        const both = maskA | maskB;
        for (let row = 0; row < this.rowCount; row++) {
            if ((row & both) === maskA) {
                const other = row ^ both;
                const tmp = permuted[row];
                permuted[row] = permuted[other];
                permuted[other] = tmp;
            }
        }
    }

    /**
     * Evaluates an ordering.
     */
    public evaluate(ordering: ArrayLike<number>): OrderingEvaluation {
        const permuted = this.permute(ordering, this.scratch);
        return this.evaluatePermuted(permuted);
    }

    /**
     * Evaluates an already permuted table (see permute()).
     */
    public evaluatePermuted(permuted: Int32Array): OrderingEvaluation {
        const result = this.run(permuted, null);
        return result.evaluation;
    }

    /**
     * Builds the reduced diagram of an ordering.
     */
    public buildDiagram(ordering: ArrayLike<number>): ReducedDiagram {
        const permuted = this.permute(ordering);
        const n = this.variableCount;
        const nodeLevel = new Int32Array(Math.max(1, this.rowCount));
        const nodeLo = new Int32Array(Math.max(1, this.rowCount));
        const nodeHi = new Int32Array(Math.max(1, this.rowCount));
        const result = this.run(permuted, { nodeLevel, nodeLo, nodeHi });
        const count = result.evaluation.internalNodeCount;
        return {
            variableCount: n,
            terminalCount: this.terminalCount,
            root: result.root,
            nodeLevel: nodeLevel.subarray(0, count),
            nodeLo: nodeLo.subarray(0, count),
            nodeHi: nodeHi.subarray(0, count),
            ordering: Array.from(ordering),
            nodesPerLevel: result.evaluation.nodesPerLevel
        };
    }

    /**
     * Resolves the don't-care rows the same way the BDD of the given ordering
     * resolves them (a don't-care branch takes the value of its sibling branch)
     * and returns a table without don't-care rows in the original row order.
     * When the table has no don't-care rows, the same table is returned.
     */
    public complete(ordering: ArrayLike<number>): DenseTruthTable {
        if (this.dontCare < 0) {
            return this.table;
        }
        const n = this.variableCount;
        const permuted = this.permute(ordering);
        const dc = this.dontCare;

        // isDontCare[b] tells whether block b of the current block size is entirely don't-care
        let isDontCare = new Uint8Array(this.rowCount);
        for (let row = 0; row < this.rowCount; row++) {
            isDontCare[row] = permuted[row] === dc ? 1 : 0;
        }
        for (let blockSize = 1; blockSize < this.rowCount; blockSize *= 2) {
            const blocks = this.rowCount / (blockSize * 2);
            const nextIsDontCare = new Uint8Array(blocks);
            for (let b = 0; b < blocks; b++) {
                const leftDc = isDontCare[b * 2];
                const rightDc = isDontCare[b * 2 + 1];
                const leftStart = b * blockSize * 2;
                const rightStart = leftStart + blockSize;
                if (leftDc === 1 && rightDc === 0) {
                    permuted.copyWithin(leftStart, rightStart, rightStart + blockSize);
                } else if (rightDc === 1 && leftDc === 0) {
                    permuted.copyWithin(rightStart, leftStart, leftStart + blockSize);
                }
                nextIsDontCare[b] = (leftDc === 1 && rightDc === 1) ? 1 : 0;
            }
            isDontCare = nextIsDontCare;
        }

        // un-permute into the natural row order
        const terminalIds = new Int32Array(this.rowCount);
        const srcBit = new Int32Array(n);
        const dstBit = new Int32Array(n);
        for (let k = 0; k < n; k++) {
            srcBit[k] = n - 1 - k;
            dstBit[k] = n - 1 - ordering[k];
        }
        let stillDontCare = false;
        for (let row = 0; row < this.rowCount; row++) {
            let target = 0;
            for (let k = 0; k < n; k++) {
                target |= ((row >>> srcBit[k]) & 1) << dstBit[k];
            }
            terminalIds[target] = permuted[row];
            if (permuted[row] === dc) {
                stillDontCare = true;
            }
        }
        return withTerminalIds(this.table, terminalIds, stillDontCare ? dc : -1);
    }

    private run(
        permuted: Int32Array,
        record: { nodeLevel: Int32Array, nodeLo: Int32Array, nodeHi: Int32Array } | null
    ): { evaluation: OrderingEvaluation, root: number } {
        this.evaluations++;
        const n = this.variableCount;
        const dc = this.dontCare;
        const terminalCount = this.terminalCount;
        const hashLo = this.hashLo;
        const hashHi = this.hashHi;
        const hashId = this.hashId;
        const nodesPerLevel: number[] = new Array(n).fill(0);

        let cur: Int32Array = permuted;
        let nextId = terminalCount;
        for (let level = n - 1; level >= 0; level--) {
            const half = 1 << level;
            const next = (level & 1) === 0 ? this.bufA : this.bufB;
            let tableSize = 16;
            while (tableSize < half * 2) {
                tableSize *= 2;
            }
            const mask = tableSize - 1;
            hashLo.fill(-1, 0, tableSize);
            let created = 0;
            for (let i = 0; i < half; i++) {
                const lo = cur[2 * i];
                const hi = cur[2 * i + 1];
                let id: number;
                if (lo === dc) {
                    id = hi;
                } else if (hi === dc || lo === hi) {
                    id = lo;
                } else {
                    let h = (Math.imul(lo, 0x9E3779B1) ^ Math.imul(hi, 0x85EBCA77)) >>> 0;
                    h = (h ^ (h >>> 15)) & mask;
                    while (true) {
                        const storedLo = hashLo[h];
                        if (storedLo === -1) {
                            hashLo[h] = lo;
                            hashHi[h] = hi;
                            hashId[h] = nextId;
                            id = nextId;
                            if (record) {
                                record.nodeLevel[nextId - terminalCount] = level;
                                record.nodeLo[nextId - terminalCount] = lo;
                                record.nodeHi[nextId - terminalCount] = hi;
                            }
                            nextId++;
                            created++;
                            break;
                        }
                        if (storedLo === lo && hashHi[h] === hi) {
                            id = hashId[h];
                            break;
                        }
                        h = (h + 1) & mask;
                    }
                }
                next[i] = id;
            }
            nodesPerLevel[level] = created;
            cur = next;
        }

        const internalNodeCount = nextId - terminalCount;
        const nodeCount = 1 + (internalNodeCount - nodesPerLevel[0]) + this.table.leafCount;
        return {
            evaluation: {
                nodesPerLevel,
                internalNodeCount,
                nodeCount
            },
            root: cur[0]
        };
    }
}
