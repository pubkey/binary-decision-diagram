import type { DenseTruthTable } from './dense-truth-table.js';
import { naturalOrdering } from './dense-truth-table.js';
import { OrderingEvaluator, CostModel, costTolerance, costUnit } from './ordering-evaluator.js';
import { SharedDiagram, StateHeap, DiagramBudgetExceededError, DEFAULT_MAX_DIAGRAM_NODES } from './shared-diagram.js';

export interface ExactCostOrderingOptions {
    /**
     * The search stops without a proof when more states were expanded.
     * Default: 200000
     */
    maxExpansions?: number;
    /**
     * The search stops without a proof when the stored states reference
     * more rows in total (memory protection).
     * Default: 2^25
     */
    maxStoredRows?: number;
    /**
     * A known good ordering. Its expected cost is used as upper bound to prune the search.
     */
    upperBoundOrdering?: ArrayLike<number>;
    /**
     * Only orderings with a lower expected cost than this are searched for.
     */
    upperBound?: number;
    log?: (message: string) => void;
}

export interface ExactCostOrderingResult {
    /**
     * true when it is proven that no ordering has a lower expected cost
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
    /** expected cost of one resolve() call with `ordering`, -1 when ordering is null */
    expectedCost: number;
    expansions: number;
    generated: number;
}

/**
 * the rows of a search state, grouped by their cofactor
 */
interface GroupedRows {
    /** indexes into activeRows, grouped */
    rows: Int32Array;
    /** group g spans rows[groupStart[g]] .. rows[groupStart[g + 1] - 1] */
    groupStart: Int32Array;
    /** node id of the cofactor of each group */
    groupFunction: Int32Array;
    /** total weight of the rows of each group */
    groupWeight: Float64Array;
}

/**
 * Exact minimization of the expected cost of a resolve() call.
 *
 * A row pays the cost of a boolean function when its path through the BDD
 * visits a node of that function, which happens exactly when the cofactor of
 * the row with respect to the functions above still depends on that function.
 * So like the amount of nodes, the expected cost decomposes over the lattice of
 * variable subsets: the edge S -> S + {x} costs cost(x) times the weight of the
 * rows whose cofactor with respect to S depends on x (the root level always
 * pays, because the root node always calls its function).
 *
 * A state keeps the rows with positive weight grouped by their cofactor.
 * Rows whose cofactor became constant never pay anything again and are dropped.
 * The admissible estimate for the remaining cost sums, for every function x
 * not yet placed, cost(x) times the weight of the rows that are sensitive to x
 * (the value changes when only x is flipped), because such rows pay for x in
 * every ordering.
 */
export class ExactCostOrderingSearch {
    private readonly diagram: SharedDiagram;
    private readonly n: number;
    /** natural indexes of the rows with positive weight, ascending */
    private readonly activeRows: Int32Array;
    private readonly activeWeights: Float64Array;
    private readonly totalWeight: number;
    /** sensitiveWeight[v] = weight of the active rows whose value changes when only v is flipped */
    private readonly sensitiveWeight: Float64Array;
    private readonly costs: Float64Array;

    constructor(
        private readonly table: DenseTruthTable,
        private readonly costModel: CostModel,
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
        this.costs = costModel.functionCosts;
        const rowWeights = costModel.rowWeights;
        let activeCount = 0;
        for (let row = 0; row < table.rowCount; row++) {
            if (rowWeights[row] > 0) {
                activeCount++;
            }
        }
        this.activeRows = new Int32Array(activeCount);
        this.activeWeights = new Float64Array(activeCount);
        let total = 0;
        let index = 0;
        for (let row = 0; row < table.rowCount; row++) {
            if (rowWeights[row] > 0) {
                this.activeRows[index] = row;
                this.activeWeights[index] = rowWeights[row];
                total += rowWeights[row];
                index++;
            }
        }
        this.totalWeight = total;
        this.sensitiveWeight = new Float64Array(this.n);
        const ids = table.terminalIds;
        for (let v = 0; v < this.n; v++) {
            const bit = 1 << (this.n - 1 - v);
            let weight = 0;
            for (let i = 0; i < activeCount; i++) {
                const row = this.activeRows[i];
                if (ids[row] !== ids[row ^ bit]) {
                    weight += this.activeWeights[i];
                }
            }
            this.sensitiveWeight[v] = weight;
        }
    }

    public normalizeOrdering(ordering: ArrayLike<number>): number[] {
        return this.diagram.normalizeOrdering(ordering);
    }

    public run(options: ExactCostOrderingOptions = {}): ExactCostOrderingResult {
        const log = options.log ? options.log : () => null;
        const maxExpansions = options.maxExpansions === undefined ? 200000 : options.maxExpansions;
        const maxStoredRows = options.maxStoredRows === undefined ? Math.pow(2, 25) : options.maxStoredRows;
        const diagram = this.diagram;
        const relevant = diagram.relevant;
        const m = relevant.length;
        const total = this.totalWeight;
        const costs = this.costs;
        const irrelevant = diagram.irrelevantVariables();
        // path costs are unnormalized (multiplied by the total weight), so is the tolerance unit
        const unit = costUnit(this.costModel) * total;
        const tolerance = (value: number) => costTolerance(value, unit);
        /**
         * Only costs below this threshold can beat the upper bound.
         * Without an upper bound every finite cost can.
         */
        const pruneThreshold = (bound: number) => isFinite(bound) ? bound - tolerance(bound) : Infinity;

        // upper bound, kept unnormalized (multiplied by the total weight) like the path costs
        let upperBound = options.upperBound === undefined ? Infinity : options.upperBound * total;
        let incumbent: number[] | null = null;
        if (options.upperBoundOrdering) {
            incumbent = this.normalizeOrdering(options.upperBoundOrdering);
            const incumbentCost = new OrderingEvaluator(this.table, this.costModel).evaluate(incumbent).expectedCost * total;
            if (incumbentCost >= pruneThreshold(upperBound)) {
                incumbent = null;
            } else {
                upperBound = incumbentCost;
            }
        }
        const threshold = pruneThreshold(upperBound);
        const result = (
            solved: boolean,
            ordering: number[] | null,
            cost: number,
            expansionCount: number,
            generatedCount: number
        ): ExactCostOrderingResult => ({
            solved,
            ordering,
            expectedCost: ordering ? cost / total : -1,
            expansions: expansionCount,
            generated: generatedCount
        });
        if (diagram.overBudget) {
            log('exact cost search: diagram budget exceeded');
            return result(false, incumbent, upperBound, 0, 0);
        }

        if (m === 0) {
            // constant function: only the root pays, so the cheapest function goes on top
            const ordering = naturalOrdering(this.n).sort((a, b) => (costs[a] - costs[b]) || (a - b));
            const cost = costs[ordering[0]] * total;
            if (cost >= threshold) {
                return result(true, incumbent, upperBound, 0, 0);
            }
            return result(true, ordering, cost, 0, 0);
        }

        const full = (1 << m) - 1;
        const states: Map<number, GroupedRows> = new Map();
        const bestCost: Map<number, number> = new Map();
        const parentVariable: Map<number, number> = new Map();
        const closed: Set<number> = new Set();
        const heap = new StateHeap();

        const startRows = new Int32Array(this.activeRows.length);
        for (let i = 0; i < startRows.length; i++) {
            startRows[i] = i;
        }
        const startState: GroupedRows = {
            rows: startRows,
            groupStart: Int32Array.of(0, startRows.length),
            groupFunction: Int32Array.of(diagram.rootId),
            groupWeight: Float64Array.of(total)
        };
        states.set(0, startState);
        bestCost.set(0, 0);
        heap.push(this.estimate(0), 0, 0);

        let expansions = 0;
        let generated = 1;
        let storedRows = startRows.length;
        let solvedSet = -1;
        let solvedCost = -1;
        try {
        while (heap.size > 0) {
            const state = heap.pop();
            const currentCost = state.cost;
            const subset = state.subset;
            if (currentCost !== bestCost.get(subset) || closed.has(subset)) {
                continue;
            }
            if (state.estimate >= threshold) {
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
                log('exact cost search: expansion budget exceeded');
                return result(false, incumbent, upperBound, expansions, generated);
            }
            if (storedRows > maxStoredRows) {
                log('exact cost search: memory budget exceeded');
                return result(false, incumbent, upperBound, expansions, generated);
            }
            if (expansions % 10000 === 0) {
                log('exact cost search: ' + expansions + ' states expanded, ' + generated + ' generated, ' + heap.size + ' open');
            }

            const grouped = states.get(subset) as GroupedRows;
            for (let c = 0; c < m; c++) {
                const bit = 1 << c;
                if ((subset & bit) !== 0) {
                    continue;
                }
                const variable = relevant[c];
                const nextSubset = subset | bit;
                const payingWeight = subset === 0 ? total : this.payingWeight(grouped, variable);
                const nextCost = currentCost + costs[variable] * payingWeight;
                const knownCost = bestCost.get(nextSubset);
                if (knownCost !== undefined && knownCost <= nextCost + tolerance(nextCost)) {
                    continue;
                }
                const estimate = nextCost + this.estimate(nextSubset);
                if (estimate >= threshold) {
                    continue;
                }
                // the grouping of the rows is only needed when the state can be expanded
                if (!states.has(nextSubset)) {
                    const next = this.transition(grouped, variable);
                    states.set(nextSubset, next);
                    generated++;
                    storedRows += next.rows.length;
                }
                bestCost.set(nextSubset, nextCost);
                parentVariable.set(nextSubset, variable);
                closed.delete(nextSubset);
                heap.push(estimate, nextCost, nextSubset);
            }
        }
        } catch (err) {
            if (err instanceof DiagramBudgetExceededError) {
                log('exact cost search: diagram budget exceeded');
                return result(false, incumbent, upperBound, expansions, generated);
            }
            throw err;
        }

        if (solvedSet === -1) {
            return result(true, incumbent, upperBound, expansions, generated);
        }

        const reversed: number[] = [];
        let remainingSubset = solvedSet;
        while (remainingSubset !== 0) {
            const variable = parentVariable.get(remainingSubset) as number;
            reversed.push(variable);
            remainingSubset = remainingSubset & ~(1 << diagram.compactOf[variable]);
        }
        return result(true, reversed.reverse().concat(irrelevant), solvedCost, expansions, generated);
    }

    /**
     * lower bound for the remaining (unnormalized) cost below the subset
     */
    private estimate(subset: number): number {
        const relevant = this.diagram.relevant;
        let estimate = 0;
        for (let c = 0; c < relevant.length; c++) {
            if ((subset & (1 << c)) === 0) {
                const variable = relevant[c];
                estimate += this.costs[variable] * this.sensitiveWeight[variable];
            }
        }
        return estimate;
    }

    /**
     * the weight of the rows that pay for `variable` when it is fixed next
     */
    private payingWeight(grouped: GroupedRows, variable: number): number {
        const diagram = this.diagram;
        const bit = 1 << diagram.compactOf[variable];
        let payingWeight = 0;
        for (let g = 0; g < grouped.groupFunction.length; g++) {
            if ((diagram.supportOf(grouped.groupFunction[g]) & bit) !== 0) {
                payingWeight += grouped.groupWeight[g];
            }
        }
        return payingWeight;
    }

    /**
     * fixes `variable` additionally: returns the new grouping of the rows
     * that still have a non-constant cofactor
     */
    private transition(grouped: GroupedRows, variable: number): GroupedRows {
        const diagram = this.diagram;
        const rowBit = 1 << (this.n - 1 - variable);
        const groupCount = grouped.groupFunction.length;
        const functions: number[] = [];
        const rowLists: Int32Array[] = [];
        for (let g = 0; g < groupCount; g++) {
            const fn = grouped.groupFunction[g];
            const start = grouped.groupStart[g];
            const end = grouped.groupStart[g + 1];
            const rows = grouped.rows.subarray(start, end);
            if (!diagram.dependsOn(fn, variable)) {
                functions.push(fn);
                rowLists.push(rows);
                continue;
            }
            const lo = diagram.restrict(fn, variable, 0);
            const hi = diagram.restrict(fn, variable, 1);
            let loCount = 0;
            for (let i = 0; i < rows.length; i++) {
                if ((this.activeRows[rows[i]] & rowBit) === 0) {
                    loCount++;
                }
            }
            const loRows = new Int32Array(loCount);
            const hiRows = new Int32Array(rows.length - loCount);
            let loIndex = 0;
            let hiIndex = 0;
            for (let i = 0; i < rows.length; i++) {
                if ((this.activeRows[rows[i]] & rowBit) === 0) {
                    loRows[loIndex++] = rows[i];
                } else {
                    hiRows[hiIndex++] = rows[i];
                }
            }
            if (!diagram.isTerminal(lo) && loRows.length > 0) {
                functions.push(lo);
                rowLists.push(loRows);
            }
            if (!diagram.isTerminal(hi) && hiRows.length > 0) {
                functions.push(hi);
                rowLists.push(hiRows);
            }
        }

        // merge the groups with equal cofactors
        const order = functions.map((_fn, index) => index).sort((a, b) => (functions[a] - functions[b]) || (a - b));
        let totalRows = 0;
        rowLists.forEach(list => totalRows += list.length);
        const mergedRows = new Int32Array(totalRows);
        const groupStart: number[] = [0];
        const groupFunction: number[] = [];
        const groupWeight: number[] = [];
        let position = 0;
        let weight = 0;
        for (let i = 0; i < order.length; i++) {
            const fn = functions[order[i]];
            const list = rowLists[order[i]];
            mergedRows.set(list, position);
            position += list.length;
            for (let r = 0; r < list.length; r++) {
                weight += this.activeWeights[list[r]];
            }
            if (i + 1 < order.length && functions[order[i + 1]] === fn) {
                continue;
            }
            groupFunction.push(fn);
            groupStart.push(position);
            groupWeight.push(weight);
            weight = 0;
        }
        return {
            rows: mergedRows,
            groupStart: Int32Array.from(groupStart),
            groupFunction: Int32Array.from(groupFunction),
            groupWeight: Float64Array.from(groupWeight)
        };
    }
}
