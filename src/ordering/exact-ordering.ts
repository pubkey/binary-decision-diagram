import type { DenseTruthTable } from './dense-truth-table.js';
import { naturalOrdering } from './dense-truth-table.js';
import { OrderingEvaluator } from './ordering-evaluator.js';
import { SharedDiagram, StateHeap, DiagramBudgetExceededError, DEFAULT_MAX_DIAGRAM_NODES } from './shared-diagram.js';

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
     * upper bound exists and the upperBoundOrdering (if given) is not
     * below it either.
     */
    ordering: number[] | null;
    /** amount of internal (non-leaf) nodes of `ordering`, -1 when ordering is null */
    internalNodeCount: number;
    /** amount of expanded states */
    expansions: number;
    /** amount of generated states */
    generated: number;
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
    private readonly diagram: SharedDiagram;
    private readonly n: number;
    private readonly terminalCount: number;

    constructor(
        private readonly table: DenseTruthTable,
        options: { maxDiagramNodes?: number } = {}
    ) {
        if (table.dontCareTerminal >= 0) {
            throw new Error('the exact search needs a truth table without don\'t-care rows, resolve them with OrderingEvaluator.complete() first');
        }
        this.diagram = new SharedDiagram(
            table,
            options.maxDiagramNodes === undefined ? DEFAULT_MAX_DIAGRAM_NODES : options.maxDiagramNodes
        );
        this.n = table.variableCount;
        this.terminalCount = table.terminalValues.length;
    }

    /**
     * Moves the boolean functions the truth table does not depend on
     * to the bottom. This never changes the amount of internal nodes
     * but ensures the root node tests a relevant boolean function.
     */
    public normalizeOrdering(ordering: ArrayLike<number>): number[] {
        return this.diagram.normalizeOrdering(ordering);
    }

    public run(options: ExactOrderingOptions = {}): ExactOrderingResult {
        const log = options.log ? options.log : () => null;
        const maxExpansions = options.maxExpansions === undefined ? 200000 : options.maxExpansions;
        const maxCofactorEntries = options.maxCofactorEntries === undefined ? Math.pow(2, 25) : options.maxCofactorEntries;
        const diagram = this.diagram;
        const relevant = diagram.relevant;
        const m = relevant.length;
        const irrelevant = diagram.irrelevantVariables();

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
                internalNodeCount: incumbent ? upperBound : -1,
                expansions: expansionCount,
                generated: generatedCount
            };
        };
        if (diagram.overBudget) {
            return giveUp('diagram budget exceeded', 0, 0);
        }

        if (m === 0) {
            // constant function: every ordering has 0 internal nodes
            const constantOrdering = upperBound > 0 ? naturalOrdering(this.n) : incumbent;
            return {
                solved: true,
                ordering: constantOrdering,
                internalNodeCount: constantOrdering ? 0 : -1,
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
        startSet[0] = diagram.rootId;
        cofactors.set(0, startSet);
        bestCost.set(0, 0);
        heap.push(this.estimate(0, startSet), 0, 0);

        let expansions = 0;
        let generated = 1;
        let storedEntries = 1;
        let solvedSet = -1;
        let solvedCost = -1;
        try {
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
                const variable = relevant[c];
                let edgeCost = 0;
                for (let i = 0; i < set.length; i++) {
                    if ((diagram.supportOf(set[i]) & bit) !== 0) {
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
        } catch (err) {
            if (err instanceof DiagramBudgetExceededError) {
                return giveUp('diagram budget exceeded', expansions, generated);
            }
            throw err;
        }

        if (solvedSet === -1) {
            // no ordering below the upper bound exists: the incumbent (if any) is optimal
            return {
                solved: true,
                ordering: incumbent,
                internalNodeCount: incumbent ? upperBound : -1,
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
            remainingSubset = remainingSubset & ~(1 << diagram.compactOf[variable]);
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
            union |= this.diagram.supportOf(set[i]);
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
        const diagram = this.diagram;
        const bit = 1 << diagram.compactOf[variable];
        const candidates = new Int32Array(set.length * 2);
        let count = 0;
        for (let i = 0; i < set.length; i++) {
            const g = set[i];
            if ((diagram.supportOf(g) & bit) === 0) {
                candidates[count++] = g;
                continue;
            }
            const lo = diagram.restrict(g, variable, 0);
            if (lo >= this.terminalCount) {
                candidates[count++] = lo;
            }
            const hi = diagram.restrict(g, variable, 1);
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
}
