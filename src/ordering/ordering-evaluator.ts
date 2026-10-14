import type { DenseTruthTable } from './dense-truth-table.js';
import { ensureValidOrdering, withTerminalIds } from './dense-truth-table.js';

/**
 * Describes what a resolve() call costs.
 */
export interface CostModel {
    /** functionCosts[v] = cost of calling boolean function v */
    functionCosts: Float64Array;
    /**
     * rowWeights[row] = how often the row occurs at runtime, relative to the other rows.
     * Must be 0 for don't-care rows, they never occur.
     */
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

interface DiagramRecord {
    nodeLevel: Int32Array;
    nodeLo: Int32Array;
    nodeHi: Int32Array;
}

/**
 * relative tolerance for comparing expected costs
 */
export const COST_EPSILON = 1e-9;

/**
 * Two costs closer than this are treated as equal. The tolerance is relative
 * to the larger of the value and the cost of one call of the most expensive
 * boolean function (`unit`), so it does not depend on the unit the
 * functionCosts are given in (milliseconds, seconds, ...).
 */
export function costTolerance(value: number, unit: number): number {
    return COST_EPSILON * Math.max(unit, Math.abs(value));
}

/**
 * The cost of one call of the most expensive boolean function,
 * the unit of costTolerance() for expected costs.
 */
export function costUnit(costModel: CostModel): number {
    let unit = 0;
    for (let v = 0; v < costModel.functionCosts.length; v++) {
        unit = Math.max(unit, costModel.functionCosts[v]);
    }
    return unit;
}

/**
 * An ordering together with the intermediate results of its evaluation.
 *
 * levelIds[L] holds the ids of the 2^L blocks of level L (levelIds[n] are the
 * rows of the truth table). Because blocks are indexed by the natural
 * assignment to the functions above their level, swapping the functions of two
 * levels keeps all levels below the lower one valid, only the levels from the
 * lower one up to the root are recomputed.
 */
export class OrderingCursor {
    public readonly ordering: number[];
    public evaluation: OrderingEvaluation;
    /** id of the root block, a terminal when the function is constant */
    public root: number = 0;

    private readonly n: number;
    private readonly levelIds: Int32Array[] = [];
    private readonly levelWeights: Float64Array[] | null;
    private readonly created: number[];
    private readonly payingWeights: number[];

    constructor(
        private readonly evaluator: OrderingEvaluator,
        ordering: ArrayLike<number>,
        private readonly record: DiagramRecord | null = null
    ) {
        this.n = evaluator.variableCount;
        ensureValidOrdering(ordering, this.n);
        this.ordering = Array.from(ordering);
        for (let level = 0; level < this.n; level++) {
            this.levelIds.push(new Int32Array(1 << level));
        }
        this.levelIds.push(evaluator.table.terminalIds);
        if (evaluator.costModel) {
            this.levelWeights = [];
            for (let level = 0; level < this.n; level++) {
                this.levelWeights.push(new Float64Array(1 << level));
            }
            this.levelWeights.push(evaluator.costModel.rowWeights);
        } else {
            this.levelWeights = null;
        }
        this.created = new Array(this.n).fill(0);
        this.payingWeights = new Array(this.n).fill(0);
        this.evaluation = this.recomputeFrom(this.n - 1);
    }

    /**
     * Starts over with another ordering.
     */
    public reset(ordering: ArrayLike<number>) {
        ensureValidOrdering(ordering, this.n);
        for (let i = 0; i < this.n; i++) {
            this.ordering[i] = ordering[i];
        }
        this.evaluation = this.recomputeFrom(this.n - 1);
    }

    /**
     * Swaps the boolean functions of two levels and updates the evaluation.
     */
    public swap(levelA: number, levelB: number) {
        if (levelA === levelB) {
            return;
        }
        const tmp = this.ordering[levelA];
        this.ordering[levelA] = this.ordering[levelB];
        this.ordering[levelB] = tmp;
        this.evaluation = this.recomputeFrom(Math.max(levelA, levelB));
    }

    /**
     * recomputes the levels top .. 0 (the levels below stay as they are)
     */
    private recomputeFrom(top: number): OrderingEvaluation {
        this.evaluator.evaluations++;
        const n = this.n;
        const terminalCount = this.evaluator.terminalCount;
        // ids used by the levels below `top`
        let nextId = terminalCount;
        for (let level = n - 1; level > top; level--) {
            nextId += this.created[level];
        }
        for (let level = top; level >= 0; level--) {
            const result = this.evaluator.computeLevel(
                this.ordering,
                level,
                this.levelIds[level + 1],
                this.levelWeights ? this.levelWeights[level + 1] : null,
                this.levelIds[level],
                this.levelWeights ? this.levelWeights[level] : null,
                nextId,
                this.record
            );
            this.created[level] = result.created;
            this.payingWeights[level] = result.payingWeight;
            nextId += result.created;
        }
        this.root = this.levelIds[0][0];

        const nodesPerLevel = this.created.slice();
        const internalNodeCount = nextId - terminalCount;
        const nodeCount = 1 + (internalNodeCount - nodesPerLevel[0]) + this.evaluator.table.leafCount;
        let expectedCost = 0;
        const costModel = this.evaluator.costModel;
        if (costModel) {
            const costs = costModel.functionCosts;
            // the root node always calls its boolean function
            expectedCost = costs[this.ordering[0]];
            for (let level = 1; level < n; level++) {
                expectedCost += costs[this.ordering[level]] * this.payingWeights[level] / costModel.totalWeight;
            }
        }
        return {
            nodesPerLevel,
            internalNodeCount,
            nodeCount,
            expectedCost
        };
    }
}

/**
 * Evaluates variable orderings of a truth table without ever creating
 * BDD node objects.
 *
 * The reduced BDD is built bottom-up: the rows of the truth table are the
 * leaves, every level above merges the two children of each block into a node
 * through a hash table (hash-consing). Equal children collapse to a single edge
 * (reduction rule) and equal (child0, child1) pairs share one node (elimination
 * rule), so the amount of nodes created per level is exactly the amount of
 * nodes the reduced BDD has on that level. Everything runs in O(2^n) integer
 * operations.
 *
 * A block on level L is the set of rows that agree on the boolean functions
 * above level L. Blocks are indexed by the assignment to those functions in
 * their natural (index) order, not in the order of the levels. That way the
 * blocks of a level only depend on the SET of functions above it: when two
 * levels swap their functions, nothing below them changes and OrderingCursor
 * only recomputes the levels above.
 *
 * Don't-care rows are handled like RootNode.removeIrrelevantLeafNodes() does it:
 * a node whose one branch is entirely don't-care is replaced by its other branch.
 *
 * With a cost model, the same pass also sums up the weight of the rows that
 * pass through a node on each level, which gives the expected cost of a
 * resolve() call: a row pays for the boolean function of a level exactly when
 * its block on that level has a node. The root node always calls its boolean
 * function, even when the function is irrelevant.
 */
export class OrderingEvaluator {
    public readonly variableCount: number;
    public readonly rowCount: number;
    public readonly terminalCount: number;
    public readonly dontCare: number;
    /** amount of evaluations run so far */
    public evaluations: number = 0;

    private readonly hashLo: Int32Array;
    private readonly hashHi: Int32Array;
    private readonly hashId: Int32Array;
    private scratch: OrderingCursor | null = null;
    private costUnit: number = 0;

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
            for (let row = 0; row < this.rowCount; row++) {
                if (costModel.rowWeights[row] !== 0 && table.terminalIds[row] === table.dontCareTerminal) {
                    // a don't-care row is merged into the subtree of its sibling, its weight would be lost
                    throw new Error('don\'t-care rows must have a row weight of 0');
                }
            }
            this.costUnit = costUnit(costModel);
        }
        // at most rowCount/2 distinct nodes per level -> load factor <= 0.5
        let hashSize = 16;
        while (hashSize < this.rowCount) {
            hashSize *= 2;
        }
        this.hashLo = new Int32Array(hashSize);
        this.hashHi = new Int32Array(hashSize);
        this.hashId = new Int32Array(hashSize);
    }

    /**
     * Evaluates an ordering.
     */
    public evaluate(ordering: ArrayLike<number>): OrderingEvaluation {
        if (!this.scratch) {
            this.scratch = new OrderingCursor(this, ordering);
        } else {
            this.scratch.reset(ordering);
        }
        return this.scratch.evaluation;
    }

    /**
     * A cursor keeps the intermediate results of an ordering so that
     * swapping two levels only recomputes the levels above them.
     */
    public cursor(ordering: ArrayLike<number>): OrderingCursor {
        return new OrderingCursor(this, ordering);
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
            const epsilon = costTolerance(Math.max(Math.abs(a.expectedCost), Math.abs(b.expectedCost)), this.costUnit);
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
        const capacity = Math.max(1, this.rowCount);
        const record: DiagramRecord = {
            nodeLevel: new Int32Array(capacity),
            nodeLo: new Int32Array(capacity),
            nodeHi: new Int32Array(capacity)
        };
        const cursor = new OrderingCursor(this, ordering, record);
        const count = cursor.evaluation.internalNodeCount;
        return {
            variableCount: this.variableCount,
            terminalCount: this.terminalCount,
            root: cursor.root,
            nodeLevel: record.nodeLevel.subarray(0, count),
            nodeLo: record.nodeLo.subarray(0, count),
            nodeHi: record.nodeHi.subarray(0, count),
            ordering: Array.from(ordering),
            nodesPerLevel: cursor.evaluation.nodesPerLevel
        };
    }

    /**
     * Resolves the don't-care rows the same way the BDD of the given ordering
     * resolves them (a don't-care branch takes the value of its sibling branch)
     * and returns a table without don't-care rows.
     * When the table has no don't-care rows, the same table is returned.
     */
    public complete(ordering: ArrayLike<number>): DenseTruthTable {
        if (this.dontCare < 0) {
            return this.table;
        }
        const diagram = this.buildDiagram(ordering);
        const n = this.variableCount;
        const terminalCount = this.terminalCount;
        const terminalIds = new Int32Array(this.rowCount);
        let stillDontCare = false;
        for (let row = 0; row < this.rowCount; row++) {
            let id = diagram.root;
            while (id >= terminalCount) {
                const index = id - terminalCount;
                const variable = diagram.ordering[diagram.nodeLevel[index]];
                id = ((row >>> (n - 1 - variable)) & 1) === 0 ? diagram.nodeLo[index] : diagram.nodeHi[index];
            }
            terminalIds[row] = id;
            if (id === this.dontCare) {
                stillDontCare = true;
            }
        }
        return withTerminalIds(this.table, terminalIds, stillDontCare ? this.dontCare : -1);
    }

    /**
     * Computes the blocks of one level out of the blocks of the level below.
     * @internal
     */
    public computeLevel(
        ordering: number[],
        level: number,
        deeperIds: Int32Array,
        deeperWeights: Float64Array | null,
        ids: Int32Array,
        weights: Float64Array | null,
        firstId: number,
        record: DiagramRecord | null
    ): { created: number, payingWeight: number } {
        const dc = this.dontCare;
        const terminalCount = this.terminalCount;
        const hashLo = this.hashLo;
        const hashHi = this.hashHi;
        const hashId = this.hashId;
        const count = 1 << level;
        let tableSize = 16;
        while (tableSize < count * 2) {
            tableSize *= 2;
        }
        const mask = tableSize - 1;
        hashLo.fill(-1, 0, tableSize);

        // the position of this level's function inside the index of the level below:
        // the functions above the level below are sorted ascending, the largest one is bit 0
        const variable = ordering[level];
        let position = 0;
        for (let k = 0; k <= level; k++) {
            if (ordering[k] > variable) {
                position++;
            }
        }
        const lowMask = (1 << position) - 1;
        const hiBit = 1 << position;

        let nextId = firstId;
        let created = 0;
        let payingWeight = 0;
        for (let block = 0; block < count; block++) {
            const loIndex = ((block >>> position) << (position + 1)) | (block & lowMask);
            const hiIndex = loIndex | hiBit;
            const lo = deeperIds[loIndex];
            const hi = deeperIds[hiIndex];
            let blockWeight = 0;
            if (deeperWeights && weights) {
                blockWeight = deeperWeights[loIndex] + deeperWeights[hiIndex];
                weights[block] = blockWeight;
            }
            let id: number;
            if (lo === dc) {
                id = hi;
            } else if (hi === dc || lo === hi) {
                id = lo;
            } else {
                payingWeight += blockWeight;
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
            ids[block] = id;
        }
        return { created, payingWeight };
    }
}
