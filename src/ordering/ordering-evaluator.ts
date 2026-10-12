import type { DenseTruthTable } from './dense-truth-table.js';
import { ensureValidOrdering, withTerminalIds } from './dense-truth-table.js';

/**
 * Describes what a resolve() call costs.
 */
export interface CostModel {
    /** functionCosts[v] = cost of calling boolean function v */
    functionCosts: Float64Array;
    /** rowWeights[row] = how often the row occurs at runtime, relative to the other rows */
    rowWeights: Float64Array;
    /** sum of rowWeights */
    totalWeight: number;
}

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
     */
    nodeCount: number;
    /**
     * Expected cost of one resolve() call: the costs of the boolean functions
     * that are called on the way from the root to the leaf, averaged over the
     * rows with their weights. 0 when the evaluator has no cost model.
     */
    expectedCost: number;
}

/**
 * The truth table permuted into the row order of an ordering:
 * the value of boolean function ordering[k] is bit (n - 1 - k) of the row index.
 */
export interface PermutedTable {
    ordering: number[];
    ids: Int32Array;
    /** row weights in the same order, null without cost model */
    weights: Float64Array | null;
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
 * relative tolerance for comparing expected costs
 */
export const COST_EPSILON = 1e-9;

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
 * With a cost model, the same pass also sums up the weight of the rows that
 * pass through a node on each level, which gives the expected cost of a
 * resolve() call: a row pays for the boolean function of a level exactly when
 * its block on that level has a node. The root node always calls its boolean
 * function, even when the function is irrelevant.
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
    private readonly weightBufA: Float64Array | null;
    private readonly weightBufB: Float64Array | null;
    private readonly hashLo: Int32Array;
    private readonly hashHi: Int32Array;
    private readonly hashId: Int32Array;
    private readonly scratch: PermutedTable;

    constructor(
        public readonly table: DenseTruthTable,
        public readonly costModel: CostModel | null = null
    ) {
        this.variableCount = table.variableCount;
        this.rowCount = table.rowCount;
        this.terminalCount = table.terminalValues.length;
        this.dontCare = table.dontCareTerminal;
        if (costModel) {
            if (costModel.functionCosts.length !== this.variableCount || costModel.rowWeights.length !== this.rowCount) {
                throw new Error('cost model does not fit the truth table');
            }
        }
        const half = Math.max(1, this.rowCount >>> 1);
        this.bufA = new Int32Array(half);
        this.bufB = new Int32Array(half);
        this.weightBufA = costModel ? new Float64Array(half) : null;
        this.weightBufB = costModel ? new Float64Array(half) : null;
        // at most rowCount/2 distinct nodes per level -> load factor <= 0.5
        let hashSize = 16;
        while (hashSize < this.rowCount) {
            hashSize *= 2;
        }
        this.hashLo = new Int32Array(hashSize);
        this.hashHi = new Int32Array(hashSize);
        this.hashId = new Int32Array(hashSize);
        this.scratch = this.newPermutedTable();
    }

    /**
     * Permutes the table into the row order of `ordering`,
     * into `target` when given.
     */
    public permute(ordering: ArrayLike<number>, target: PermutedTable = this.newPermutedTable()): PermutedTable {
        ensureValidOrdering(ordering, this.variableCount);
        const n = this.variableCount;
        const src = this.table.terminalIds;
        const srcWeights = this.costModel ? this.costModel.rowWeights : null;
        const out = target.ids;
        const outWeights = target.weights;
        const srcBit = new Int32Array(n);
        const dstBit = new Int32Array(n);
        for (let k = 0; k < n; k++) {
            srcBit[k] = n - 1 - ordering[k];
            dstBit[k] = n - 1 - k;
        }
        for (let row = 0; row < this.rowCount; row++) {
            let targetRow = 0;
            for (let k = 0; k < n; k++) {
                targetRow |= ((row >>> srcBit[k]) & 1) << dstBit[k];
            }
            out[targetRow] = src[row];
            if (outWeights && srcWeights) {
                outWeights[targetRow] = srcWeights[row];
            }
        }
        target.ordering = Array.from(ordering);
        return target;
    }

    /**
     * Swaps the boolean functions of two levels inside a permuted table in place.
     */
    public swapLevels(permuted: PermutedTable, levelA: number, levelB: number) {
        if (levelA === levelB) {
            return;
        }
        const n = this.variableCount;
        const maskA = 1 << (n - 1 - levelA);
        const maskB = 1 << (n - 1 - levelB);
        const both = maskA | maskB;
        const ids = permuted.ids;
        const weights = permuted.weights;
        for (let row = 0; row < this.rowCount; row++) {
            if ((row & both) === maskA) {
                const other = row ^ both;
                const tmp = ids[row];
                ids[row] = ids[other];
                ids[other] = tmp;
                if (weights) {
                    const tmpWeight = weights[row];
                    weights[row] = weights[other];
                    weights[other] = tmpWeight;
                }
            }
        }
        const tmpVariable = permuted.ordering[levelA];
        permuted.ordering[levelA] = permuted.ordering[levelB];
        permuted.ordering[levelB] = tmpVariable;
    }

    /**
     * Evaluates an ordering.
     */
    public evaluate(ordering: ArrayLike<number>): OrderingEvaluation {
        return this.evaluatePermuted(this.permute(ordering, this.scratch));
    }

    /**
     * Evaluates an already permuted table (see permute()).
     */
    public evaluatePermuted(permuted: PermutedTable): OrderingEvaluation {
        return this.run(permuted, null).evaluation;
    }

    /**
     * @returns true when evaluation a is strictly better than b:
     * fewer nodes, or with a cost model a lower expected cost
     * (ties in the expected cost are broken by the amount of nodes)
     */
    public isBetter(a: OrderingEvaluation, b: OrderingEvaluation): boolean {
        return this.compare(a, b) < 0;
    }

    /**
     * negative when a is better than b, positive when b is better, 0 when equal
     */
    public compare(a: OrderingEvaluation, b: OrderingEvaluation): number {
        if (this.costModel) {
            const epsilon = COST_EPSILON * Math.max(1, Math.abs(a.expectedCost), Math.abs(b.expectedCost));
            if (a.expectedCost < b.expectedCost - epsilon) {
                return -1;
            }
            if (a.expectedCost > b.expectedCost + epsilon) {
                return 1;
            }
        }
        return a.nodeCount - b.nodeCount;
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
        const permuted = this.permute(ordering).ids;
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

    private newPermutedTable(): PermutedTable {
        return {
            ordering: [],
            ids: new Int32Array(this.rowCount),
            weights: this.costModel ? new Float64Array(this.rowCount) : null
        };
    }

    private run(
        permuted: PermutedTable,
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
        const levelWeights: number[] = new Array(n).fill(0);
        const withWeights = this.costModel !== null && permuted.weights !== null;

        let cur: Int32Array = permuted.ids;
        let curWeights: Float64Array | null = withWeights ? permuted.weights : null;
        let nextId = terminalCount;
        for (let level = n - 1; level >= 0; level--) {
            const half = 1 << level;
            const even = (level & 1) === 0;
            const next = even ? this.bufA : this.bufB;
            const nextWeights = withWeights ? (even ? this.weightBufA : this.weightBufB) : null;
            let tableSize = 16;
            while (tableSize < half * 2) {
                tableSize *= 2;
            }
            const mask = tableSize - 1;
            hashLo.fill(-1, 0, tableSize);
            let created = 0;
            let levelWeight = 0;
            for (let i = 0; i < half; i++) {
                const lo = cur[2 * i];
                const hi = cur[2 * i + 1];
                let blockWeight = 0;
                if (curWeights && nextWeights) {
                    blockWeight = curWeights[2 * i] + curWeights[2 * i + 1];
                    nextWeights[i] = blockWeight;
                }
                let id: number;
                if (lo === dc) {
                    id = hi;
                } else if (hi === dc || lo === hi) {
                    id = lo;
                } else {
                    levelWeight += blockWeight;
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
            levelWeights[level] = levelWeight;
            cur = next;
            curWeights = nextWeights;
        }

        const internalNodeCount = nextId - terminalCount;
        const nodeCount = 1 + (internalNodeCount - nodesPerLevel[0]) + this.table.leafCount;
        let expectedCost = 0;
        if (this.costModel && withWeights) {
            const costs = this.costModel.functionCosts;
            const ordering = permuted.ordering;
            // the root node always calls its boolean function
            expectedCost = costs[ordering[0]];
            for (let level = 1; level < n; level++) {
                expectedCost += costs[ordering[level]] * levelWeights[level] / this.costModel.totalWeight;
            }
        }
        return {
            evaluation: {
                nodesPerLevel,
                internalNodeCount,
                nodeCount,
                expectedCost
            },
            root: cur[0]
        };
    }
}
