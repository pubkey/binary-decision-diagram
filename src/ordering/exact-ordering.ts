import type { DenseTruthTable } from './dense-truth-table.js';
import { naturalOrdering } from './dense-truth-table.js';
import { OrderingEvaluator } from './ordering-evaluator.js';
import { IntPairMap } from './int-pair-map.js';

export interface ExactOrderingOptions {
    /**
     * The search stops without a proof when more states were expanded.
     * Default: 200000
     */
    maxExpansions?: number;
    /**
     * The search stops without a proof when the stored cofactor sets
     * contain more entries in total (memory protection).
     * Default: 2^25
     */
    maxCofactorEntries?: number;
    /**
     * A known good ordering. Its size is used as upper bound to prune the search,
     * which makes the search much faster when the ordering is already close to optimal.
     */
    upperBoundOrdering?: ArrayLike<number>;
    /**
     * Only orderings with fewer internal nodes than this are searched for.
     */
    upperBound?: number;
    log?: (message: string) => void;
}

export interface ExactOrderingResult {
    /**
     * true when it is proven that no ordering has fewer internal nodes
     * than the returned one (or than the upper bound, when ordering is null)
     */
    solved: boolean;
    /**
     * The best ordering that was found. Irrelevant boolean functions
     * are always at the bottom. null when no ordering below the numeric
     * upper bound exists and no upperBoundOrdering was given.
     */
    ordering: number[] | null;
    /** amount of internal (non-leaf) nodes of `ordering` */
    internalNodeCount: number;
    /** amount of expanded states */
    expansions: number;
    /** amount of generated states */
    generated: number;
}

/**
 * binary min-heap of search states, deterministic tie breaking:
 * smaller estimate first, then larger cost (deeper states), then smaller subset
 */
class StateHeap {
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

/**
 * The number of nodes on a level of a reduced BDD only depends on the SET of
 * variables above that level, not on their order (Friedman & Supowit, 1990):
 * it is the amount of distinct cofactors with respect to that set that still
 * depend on the level's variable.
 *
 * Therefore the optimal ordering is a shortest path through the lattice of
 * variable subsets, from the empty set to the full set, where the edge
 * S -> S + {x} costs the amount of nodes that test x when exactly the
 * variables of S are above it.
 *
 * This class finds that shortest path with an A* search. Each subset S is
 * represented by the set of its distinct non-constant cofactors, which are
 * nodes of one shared hash-consed diagram in the natural variable order
 * (so equal functions always have equal ids). The admissible estimate for the
 * remaining cost of a subset is the amount of its distinct non-constant
 * cofactors: each of them needs its own node below.
 *
 * With a good upper bound (from the local search) the search typically only
 * has to look at a tiny fraction of the 2^n subsets.
 */
export class ExactOrderingSearch {
    private readonly n: number;
    private readonly terminalCount: number;
    /** relevant variables (support of the function) */
    private readonly relevant: number[];
    private readonly compactOf: Int32Array;

    // the shared diagram, ids < terminalCount are terminals
    private nodeVar: Int32Array;
    private nodeLo: Int32Array;
    private nodeHi: Int32Array;
    private nodeSupport: Int32Array;
    private nodeCount: number;
    private readonly uniqueTables: IntPairMap[];
    private readonly restrictMemo: IntPairMap = new IntPairMap(1 << 16);
    private readonly rootId: number;

    constructor(
        private readonly table: DenseTruthTable
    ) {
        this.n = table.variableCount;
        this.terminalCount = table.terminalValues.length;
        const evaluator = new OrderingEvaluator(table);
        const diagram = evaluator.buildDiagram(naturalOrdering(this.n));
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
        this.compactOf = new Int32Array(this.n).fill(-1);
        this.relevant = [];
        const rootSupport = this.rawSupport(diagram.root);
        for (let v = 0; v < this.n; v++) {
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
        for (let v = 0; v < this.n; v++) {
            this.uniqueTables.push(new IntPairMap(256));
        }
        for (let id = this.terminalCount; id < this.terminalCount + count; id++) {
            const i = id - this.terminalCount;
            this.uniqueTables[this.nodeVar[i]].set(this.nodeLo[i], this.nodeHi[i], id);
        }
    }

    /**
     * Moves the boolean functions the truth table does not depend on
     * to the bottom. This never changes the amount of internal nodes
     * but ensures the root node tests a relevant boolean function.
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

    public run(options: ExactOrderingOptions = {}): ExactOrderingResult {
        const log = options.log ? options.log : () => null;
        const maxExpansions = options.maxExpansions === undefined ? 200000 : options.maxExpansions;
        const maxCofactorEntries = options.maxCofactorEntries === undefined ? Math.pow(2, 25) : options.maxCofactorEntries;
        const m = this.relevant.length;
        const irrelevant = naturalOrdering(this.n).filter(v => this.compactOf[v] === -1);

        // upper bound
        let upperBound = options.upperBound === undefined ? Infinity : options.upperBound;
        let incumbent: number[] | null = null;
        if (options.upperBoundOrdering) {
            incumbent = this.normalizeOrdering(options.upperBoundOrdering);
            const incumbentCount = new OrderingEvaluator(this.table).evaluate(incumbent).internalNodeCount;
            if (incumbentCount >= upperBound) {
                // the numeric bound is at least as good, the incumbent cannot be the answer
                incumbent = null;
            } else {
                upperBound = incumbentCount;
            }
        }
        const giveUp = (reason: string, expansionCount: number, generatedCount: number): ExactOrderingResult => {
            log('exact search: ' + reason);
            return {
                solved: false,
                ordering: incumbent,
                internalNodeCount: upperBound,
                expansions: expansionCount,
                generated: generatedCount
            };
        };

        if (m === 0) {
            // constant function
            return {
                solved: true,
                ordering: upperBound > 0 ? naturalOrdering(this.n) : incumbent,
                internalNodeCount: 0,
                expansions: 0,
                generated: 0
            };
        }

        const full = (1 << m) - 1;
        const cofactors: Map<number, Int32Array> = new Map();
        const bestCost: Map<number, number> = new Map();
        const parentVariable: Map<number, number> = new Map();
        const closed: Set<number> = new Set();
        const heap = new StateHeap();

        const startSet = new Int32Array(1);
        startSet[0] = this.rootId;
        cofactors.set(0, startSet);
        bestCost.set(0, 0);
        heap.push(this.estimate(0, startSet), 0, 0);

        let expansions = 0;
        let generated = 1;
        let storedEntries = 1;
        let solvedSet = -1;
        let solvedCost = -1;
        while (heap.size > 0) {
            const state = heap.pop();
            const currentCost = state.cost;
            const subset = state.subset;
            if (currentCost !== bestCost.get(subset) || closed.has(subset)) {
                // stale heap entry
                continue;
            }
            if (state.estimate >= upperBound) {
                // nothing left that can beat the upper bound
                break;
            }
            if (subset === full) {
                solvedSet = subset;
                solvedCost = currentCost;
                break;
            }
            closed.add(subset);
            expansions++;
            if (expansions > maxExpansions) {
                return giveUp('expansion budget exceeded', expansions, generated);
            }
            if (storedEntries > maxCofactorEntries) {
                return giveUp('memory budget exceeded', expansions, generated);
            }
            if (expansions % 10000 === 0) {
                log('exact search: ' + expansions + ' states expanded, ' + generated + ' generated, ' + heap.size + ' open');
            }

            const set = cofactors.get(subset) as Int32Array;
            for (let c = 0; c < m; c++) {
                const bit = 1 << c;
                if ((subset & bit) !== 0) {
                    continue;
                }
                const variable = this.relevant[c];
                let edgeCost = 0;
                for (let i = 0; i < set.length; i++) {
                    if ((this.nodeSupport[set[i] - this.terminalCount] & bit) !== 0) {
                        edgeCost++;
                    }
                }
                const nextCost = currentCost + edgeCost;
                const nextSubset = subset | bit;
                const knownCost = bestCost.get(nextSubset);
                if (knownCost !== undefined && knownCost <= nextCost) {
                    continue;
                }
                let nextSet = cofactors.get(nextSubset);
                if (nextSet === undefined) {
                    nextSet = this.cofactorsAfter(set, variable);
                    cofactors.set(nextSubset, nextSet);
                    generated++;
                    storedEntries += nextSet.length;
                }
                const estimate = nextCost + this.estimate(nextSubset, nextSet);
                if (estimate >= upperBound) {
                    continue;
                }
                bestCost.set(nextSubset, nextCost);
                parentVariable.set(nextSubset, variable);
                closed.delete(nextSubset);
                heap.push(estimate, nextCost, nextSubset);
            }
        }

        if (solvedSet === -1) {
            // no ordering below the upper bound exists: the incumbent (if any) is optimal
            return {
                solved: true,
                ordering: incumbent,
                internalNodeCount: upperBound,
                expansions,
                generated
            };
        }

        // reconstruct the path
        const reversed: number[] = [];
        let remainingSubset = solvedSet;
        while (remainingSubset !== 0) {
            const variable = parentVariable.get(remainingSubset) as number;
            reversed.push(variable);
            remainingSubset = remainingSubset & ~(1 << this.compactOf[variable]);
        }
        const ordering = reversed.reverse().concat(irrelevant);
        return {
            solved: true,
            ordering,
            internalNodeCount: solvedCost,
            expansions,
            generated
        };
    }

    /**
     * lower bound for the amount of nodes below the given subset
     */
    private estimate(subset: number, set: Int32Array): number {
        let union = 0;
        for (let i = 0; i < set.length; i++) {
            union |= this.nodeSupport[set[i] - this.terminalCount];
        }
        const remaining = union & ~subset;
        let remainingCount = 0;
        for (let x = remaining; x !== 0; x &= x - 1) {
            remainingCount++;
        }
        return Math.max(set.length, remainingCount);
    }

    /**
     * the distinct non-constant cofactors after additionally fixing `variable`
     */
    private cofactorsAfter(set: Int32Array, variable: number): Int32Array {
        const bit = 1 << this.compactOf[variable];
        const candidates = new Int32Array(set.length * 2);
        let count = 0;
        for (let i = 0; i < set.length; i++) {
            const g = set[i];
            if ((this.nodeSupport[g - this.terminalCount] & bit) === 0) {
                candidates[count++] = g;
                continue;
            }
            const lo = this.restrict(g, variable, 0);
            if (lo >= this.terminalCount) {
                candidates[count++] = lo;
            }
            const hi = this.restrict(g, variable, 1);
            if (hi >= this.terminalCount) {
                candidates[count++] = hi;
            }
        }
        const sorted = candidates.subarray(0, count).sort();
        let unique = 0;
        for (let i = 0; i < sorted.length; i++) {
            if (i === 0 || sorted[i] !== sorted[i - 1]) {
                sorted[unique++] = sorted[i];
            }
        }
        return sorted.slice(0, unique);
    }

    private restrict(g: number, variable: number, value: number): number {
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

    private makeNode(variable: number, lo: number, hi: number): number {
        if (lo === hi) {
            return lo;
        }
        const table = this.uniqueTables[variable];
        const existing = table.get(lo, hi);
        if (existing !== -1) {
            return existing;
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

    private supportOf(id: number): number {
        return id < this.terminalCount ? 0 : this.nodeSupport[id - this.terminalCount];
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
