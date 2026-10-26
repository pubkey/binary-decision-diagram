import type { DenseTruthTable } from './dense-truth-table.js';
import { naturalOrdering } from './dense-truth-table.js';
import { OrderingEvaluator } from './ordering-evaluator.js';
import { IntPairMap } from './int-pair-map.js';

/**
 * thrown by SharedDiagram when more nodes than allowed would be created
 */
export class DiagramBudgetExceededError extends Error {
    constructor() {
        super('the exact search would need more diagram nodes than allowed');
        // Compiled to ES5, a subclass of Error gets an instance of Error,
        // so instanceof DiagramBudgetExceededError would be false without this.
        Object.setPrototypeOf(this, DiagramBudgetExceededError.prototype);
        this.name = 'DiagramBudgetExceededError';
    }
}

export const DEFAULT_MAX_DIAGRAM_NODES = 4000000;

/**
 * A hash-consed decision diagram of a fully specified truth table in the
 * natural variable order, with a restrict() operation.
 *
 * Because the variable order is fixed, two functions are equal if and only if
 * they have the same node id. The exact searches rely on this to recognize
 * equal cofactors.
 */
export class SharedDiagram {
    public readonly variableCount: number;
    public readonly terminalCount: number;
    public readonly rootId: number;
    /** the boolean functions the truth table depends on, ascending */
    public readonly relevant: number[];
    /** bit index of each relevant boolean function inside support masks, -1 for irrelevant ones */
    public readonly compactOf: Int32Array;

    private nodeVar: Int32Array;
    private nodeLo: Int32Array;
    private nodeHi: Int32Array;
    private nodeSupport: Int32Array;
    private nodeCount: number;
    private readonly uniqueTables: IntPairMap[];
    private readonly restrictMemo: IntPairMap = new IntPairMap(1 << 16);
    private readonly maxNodes: number;

    constructor(
        public readonly table: DenseTruthTable,
        /**
         * restrict() creates nodes for the restricted functions, which can be a lot
         * on unstructured functions. More nodes than this throw a DiagramBudgetExceededError.
         * Default: 4000000 (roughly 400 MB)
         */
        maxNodes: number = DEFAULT_MAX_DIAGRAM_NODES
    ) {
        this.maxNodes = maxNodes;
        this.variableCount = table.variableCount;
        this.terminalCount = table.terminalValues.length;
        const evaluator = new OrderingEvaluator(table);
        const diagram = evaluator.buildDiagram(naturalOrdering(this.variableCount));
        const count = diagram.nodeLevel.length;
        const capacity = Math.max(1024, count * 2);
        this.nodeVar = new Int32Array(capacity);
        this.nodeLo = new Int32Array(capacity);
        this.nodeHi = new Int32Array(capacity);
        this.nodeSupport = new Int32Array(capacity);
        this.nodeVar.set(diagram.nodeLevel);
        this.nodeLo.set(diagram.nodeLo);
        this.nodeHi.set(diagram.nodeHi);
        this.nodeCount = count;
        this.rootId = diagram.root;

        // relevant variables and their compact bit index
        this.compactOf = new Int32Array(this.variableCount).fill(-1);
        this.relevant = [];
        const rootSupport = this.rawSupport(diagram.root);
        for (let v = 0; v < this.variableCount; v++) {
            if ((rootSupport & (1 << v)) !== 0) {
                this.compactOf[v] = this.relevant.length;
                this.relevant.push(v);
            }
        }
        // support masks in compact bit indexes; children always have smaller ids
        for (let i = 0; i < count; i++) {
            this.nodeSupport[i] = this.supportOf(this.nodeLo[i]) |
                this.supportOf(this.nodeHi[i]) |
                (1 << this.compactOf[this.nodeVar[i]]);
        }
        this.uniqueTables = [];
        for (let v = 0; v < this.variableCount; v++) {
            this.uniqueTables.push(new IntPairMap(256));
        }
        for (let id = this.terminalCount; id < this.terminalCount + count; id++) {
            const i = id - this.terminalCount;
            this.uniqueTables[this.nodeVar[i]].set(this.nodeLo[i], this.nodeHi[i], id);
        }
    }

    public isTerminal(id: number): boolean {
        return id < this.terminalCount;
    }

    /** amount of internal nodes created so far */
    public get size(): number {
        return this.nodeCount;
    }

    /** true when the diagram of the natural ordering alone already exceeds the node budget */
    public get overBudget(): boolean {
        return this.nodeCount > this.maxNodes;
    }

    /**
     * support mask (compact bit indexes) of a node, 0 for terminals
     */
    public supportOf(id: number): number {
        return id < this.terminalCount ? 0 : this.nodeSupport[id - this.terminalCount];
    }

    public dependsOn(id: number, variable: number): boolean {
        return (this.supportOf(id) & (1 << this.compactOf[variable])) !== 0;
    }

    /**
     * the function with `variable` fixed to `value`
     */
    public restrict(g: number, variable: number, value: number): number {
        if (g < this.terminalCount) {
            return g;
        }
        const index = g - this.terminalCount;
        if ((this.nodeSupport[index] & (1 << this.compactOf[variable])) === 0) {
            return g;
        }
        const v = this.nodeVar[index];
        if (v === variable) {
            return value === 0 ? this.nodeLo[index] : this.nodeHi[index];
        }
        const memoKey = variable * 2 + value;
        const memo = this.restrictMemo.get(g, memoKey);
        if (memo !== -1) {
            return memo;
        }
        const lo = this.restrict(this.nodeLo[index], variable, value);
        const hi = this.restrict(this.nodeHi[index], variable, value);
        const result = this.makeNode(v, lo, hi);
        this.restrictMemo.set(g, memoKey, result);
        return result;
    }

    /**
     * Moves the boolean functions the truth table does not depend on
     * to the bottom, keeping the order of the others.
     */
    public normalizeOrdering(ordering: ArrayLike<number>): number[] {
        const relevant: number[] = [];
        const irrelevant: number[] = [];
        for (let i = 0; i < ordering.length; i++) {
            if (this.compactOf[ordering[i]] === -1) {
                irrelevant.push(ordering[i]);
            } else {
                relevant.push(ordering[i]);
            }
        }
        return relevant.concat(irrelevant);
    }

    public irrelevantVariables(): number[] {
        return naturalOrdering(this.variableCount).filter(v => this.compactOf[v] === -1);
    }

    private makeNode(variable: number, lo: number, hi: number): number {
        if (lo === hi) {
            return lo;
        }
        const table = this.uniqueTables[variable];
        const existing = table.get(lo, hi);
        if (existing !== -1) {
            return existing;
        }
        if (this.nodeCount >= this.maxNodes) {
            throw new DiagramBudgetExceededError();
        }
        if (this.nodeCount === this.nodeVar.length) {
            this.growNodes();
        }
        const index = this.nodeCount++;
        const id = index + this.terminalCount;
        this.nodeVar[index] = variable;
        this.nodeLo[index] = lo;
        this.nodeHi[index] = hi;
        this.nodeSupport[index] = this.supportOf(lo) | this.supportOf(hi) | (1 << this.compactOf[variable]);
        table.set(lo, hi, id);
        return id;
    }

    /**
     * support in natural variable bits, only used before the compact mapping exists
     */
    private rawSupport(id: number): number {
        const memo: Map<number, number> = new Map();
        const recurse = (node: number): number => {
            if (node < this.terminalCount) {
                return 0;
            }
            const known = memo.get(node);
            if (known !== undefined) {
                return known;
            }
            const index = node - this.terminalCount;
            const ret = recurse(this.nodeLo[index]) | recurse(this.nodeHi[index]) | (1 << this.nodeVar[index]);
            memo.set(node, ret);
            return ret;
        };
        return recurse(id);
    }

    private growNodes() {
        const capacity = this.nodeVar.length * 2;
        const grow = (old: Int32Array) => {
            const ret = new Int32Array(capacity);
            ret.set(old);
            return ret;
        };
        this.nodeVar = grow(this.nodeVar);
        this.nodeLo = grow(this.nodeLo);
        this.nodeHi = grow(this.nodeHi);
        this.nodeSupport = grow(this.nodeSupport);
    }
}

/**
 * binary min-heap of search states, deterministic tie breaking:
 * smaller estimate first, then larger cost (deeper states), then smaller subset
 */
export class StateHeap {
    private readonly estimates: number[] = [];
    private readonly costs: number[] = [];
    private readonly subsets: number[] = [];

    get size(): number {
        return this.estimates.length;
    }

    public push(estimate: number, cost: number, subset: number) {
        this.estimates.push(estimate);
        this.costs.push(cost);
        this.subsets.push(subset);
        let i = this.estimates.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.less(i, parent)) {
                this.swap(i, parent);
                i = parent;
            } else {
                break;
            }
        }
    }

    public pop(): { estimate: number, cost: number, subset: number } {
        const ret = {
            estimate: this.estimates[0],
            cost: this.costs[0],
            subset: this.subsets[0]
        };
        const last = this.estimates.length - 1;
        this.swap(0, last);
        this.estimates.pop();
        this.costs.pop();
        this.subsets.pop();
        let i = 0;
        const size = this.estimates.length;
        while (true) {
            const left = i * 2 + 1;
            const right = left + 1;
            let smallest = i;
            if (left < size && this.less(left, smallest)) {
                smallest = left;
            }
            if (right < size && this.less(right, smallest)) {
                smallest = right;
            }
            if (smallest === i) {
                break;
            }
            this.swap(i, smallest);
            i = smallest;
        }
        return ret;
    }

    private less(a: number, b: number): boolean {
        if (this.estimates[a] !== this.estimates[b]) {
            return this.estimates[a] < this.estimates[b];
        }
        if (this.costs[a] !== this.costs[b]) {
            return this.costs[a] > this.costs[b];
        }
        return this.subsets[a] < this.subsets[b];
    }

    private swap(a: number, b: number) {
        let tmp = this.estimates[a];
        this.estimates[a] = this.estimates[b];
        this.estimates[b] = tmp;
        tmp = this.costs[a];
        this.costs[a] = this.costs[b];
        this.costs[b] = tmp;
        tmp = this.subsets[a];
        this.subsets[a] = this.subsets[b];
        this.subsets[b] = tmp;
    }
}
