import type { TruthTable } from '../types.js';
import { RootNode } from '../root-node.js';
import {
    parseTruthTable,
    denseTruthTableToMap,
    ensureValidOrdering,
    DenseTruthTable
} from './dense-truth-table.js';
import { OrderingEvaluator, OrderingEvaluation, CostModel } from './ordering-evaluator.js';
import {
    LocalOrderingSearch,
    seedOrderings,
    OrderingProgressCallback
} from './local-search.js';
import { ExactOrderingSearch } from './exact-ordering.js';
import { ExactCostOrderingSearch } from './exact-cost-ordering.js';
import { buildBddFromDiagram } from './build-bdd.js';

export interface FindOrderingInput {
    truthTable: TruthTable;
    /**
     * Value of the rows that can never occur at runtime.
     * These rows are resolved to whatever makes the BDD smallest,
     * exactly like removeIrrelevantLeafNodes() would do it.
     */
    dontCareValue?: number;
    /**
     * Cost of calling each boolean function: functionCosts[i] belongs to the
     * boolean function with index i (the i-th character of the truth table keys).
     * When given, the optimizer minimizes the expected cost of one resolve() call,
     * that is the sum of the costs of the boolean functions that are called on the
     * way from the root to the leaf, averaged over the rows, instead of the amount
     * of nodes. The amount of nodes then only breaks ties.
     */
    functionCosts?: number[];
    /**
     * How often each row occurs at runtime relative to the other rows,
     * used together with functionCosts. Default: every row that is not a
     * don't-care row occurs equally often. Don't-care rows never occur.
     */
    rowWeight?: (key: string, value: number) => number;
    /**
     * Additional start orderings for the local search, for example the
     * best ordering of a previous run. ordering[level] is the index
     * of the boolean function tested at that level.
     */
    initialOrderings?: number[][];
    /**
     * - 'auto' (default): run the exact search when the truth table has
     *   at most maxExactVariables boolean functions
     * - true: always run the exact search (limited by maxExactExpansions)
     * - false: never
     */
    exact?: boolean | 'auto';
    /** Default: 20 */
    maxExactVariables?: number;
    /**
     * Budget of the exact search. When it is exceeded, the result of the
     * local search is returned and result.optimal is false.
     * Default: 200000
     */
    maxExactExpansions?: number;
    /** Default: 3 */
    windowSize?: number;
    log?: boolean;
    /** called whenever a better ordering was found */
    onImprovement?: OrderingProgressCallback;
}

export interface FindOrderingResult {
    /** ordering[level] = index of the boolean function tested at that level */
    ordering: number[];
    /** amount of nodes of the BDD, as RootNode.countNodes() returns it */
    nodeCount: number;
    /**
     * Expected cost of one resolve() call with the returned ordering,
     * only set when functionCosts were given.
     */
    expectedCost?: number;
    /**
     * true when the exact search has proven that no other ordering gives a
     * BDD with fewer nodes (or, with functionCosts, a lower expected cost)
     * for the (completed) truth table
     */
    optimal: boolean;
    /** the truth table with the don't-care rows resolved, in the original key order */
    truthTable: TruthTable;
    stats: OptimizeOrderingStats;
    /** @internal */
    table: DenseTruthTable;
}

export interface OptimizeOrderingStats {
    /** amount of orderings that were evaluated */
    evaluations: number;
    /** amount of states the exact search expanded */
    exactExpansions: number;
    /** the amount of nodes found by the local search alone */
    localSearchNodeCount: number;
    durationMs: number;
}

interface BestOrdering {
    ordering: number[];
    evaluation: OrderingEvaluation;
}

export interface OptimizeOrderingInput extends FindOrderingInput {
    /**
     * Hook that runs on the created BDD before it is minimized,
     * for compatibility with optimizeBruteForce().
     * The optimizer cannot account for what the hook does, so prefer dontCareValue.
     */
    afterBddCreation?: (bdd: RootNode) => void;
}

export interface OptimizeOrderingResult extends FindOrderingResult {
    bdd: RootNode;
}

/**
 * Validates functionCosts and rowWeight and turns them into a cost model.
 */
export function buildCostModel(
    table: DenseTruthTable,
    functionCosts?: number[],
    rowWeight?: (key: string, value: number) => number
): CostModel | null {
    if (!functionCosts) {
        if (rowWeight) {
            throw new Error('rowWeight can only be used together with functionCosts');
        }
        return null;
    }
    const n = table.variableCount;
    if (functionCosts.length !== n) {
        throw new Error('functionCosts must have one entry per boolean function (' + n + ')');
    }
    const costs = new Float64Array(n);
    for (let v = 0; v < n; v++) {
        const cost = functionCosts[v];
        if (typeof cost !== 'number' || !isFinite(cost) || cost < 0) {
            throw new Error('functionCosts[' + v + '] must be a non-negative number');
        }
        costs[v] = cost;
    }
    const weights = new Float64Array(table.rowCount);
    let totalWeight = 0;
    for (let row = 0; row < table.rowCount; row++) {
        const id = table.terminalIds[row];
        if (id === table.dontCareTerminal) {
            continue;
        }
        let weight = 1;
        if (rowWeight) {
            const key = row.toString(2).padStart(n, '0');
            weight = rowWeight(key, table.terminalValues[id]);
            if (typeof weight !== 'number' || !isFinite(weight) || weight < 0) {
                throw new Error('rowWeight must return a non-negative number, got ' + weight + ' for ' + key);
            }
        }
        weights[row] = weight;
        totalWeight += weight;
    }
    if (totalWeight <= 0) {
        throw new Error('all row weights are zero');
    }
    return {
        functionCosts: costs,
        rowWeights: weights,
        totalWeight
    };
}

/**
 * Deterministically finds a variable ordering with a small BDD
 * (or, with functionCosts, with a cheap resolve() call).
 * See docs/variable-ordering.md for how it works.
 * Does not create BDD nodes, use optimizeOrdering() for that.
 */
export function findOrdering(input: FindOrderingInput): FindOrderingResult {
    const startTime = Date.now();
    const log = input.log ? (message: string) => console.log('findOrdering(): ' + message) : () => null;
    const onImprovement = input.onImprovement ? input.onImprovement : () => null;
    const base = parseTruthTable(input.truthTable, input.dontCareValue);
    const n = base.variableCount;
    const costModel = buildCostModel(base, input.functionCosts, input.rowWeight);
    const baseEvaluator = new OrderingEvaluator(base, costModel);
    const windowSize = input.windowSize === undefined ? 3 : input.windowSize;
    let evaluations = 0;
    const describe = (evaluation: OrderingEvaluation) => evaluation.nodeCount + ' nodes' +
        (costModel ? ', expected cost ' + evaluation.expectedCost : '');

    /**
     * phase 1: deterministic seeds, each improved by sifting and window permutation
     */
    const seeds = seedOrderings(baseEvaluator);
    (input.initialOrderings ? input.initialOrderings : []).forEach((ordering, index) => {
        ensureValidOrdering(ordering, n);
        seeds.unshift({ name: 'initial-' + index, ordering: ordering.slice() });
    });
    let localBest: BestOrdering | null = null;
    const seedResults: BestOrdering[] = [];
    for (const seed of seeds) {
        const search = new LocalOrderingSearch(baseEvaluator, seed.ordering, {
            windowSize,
            log: message => log('[' + seed.name + '] ' + message),
            onImprovement: progress => {
                if (!localBest || baseEvaluator.isBetter(search.best, localBest.evaluation)) {
                    onImprovement(progress);
                }
            }
        });
        const result = search.run();
        log('seed ' + seed.name + ': ' + describe(result.evaluation));
        seedResults.push({ ordering: result.ordering, evaluation: result.evaluation });
        if (!localBest || baseEvaluator.isBetter(result.evaluation, localBest.evaluation)) {
            localBest = { ordering: result.ordering, evaluation: result.evaluation };
        }
    }
    if (!localBest) {
        throw new Error('no ordering found, this should not happen');
    }
    let best: BestOrdering = localBest;
    const localSearchNodeCount = best.evaluation.nodeCount;

    /**
     * phase 2: exact search
     *
     * The exact search needs a fully specified function, so it runs on the
     * truth table with the don't-care rows resolved. Different orderings resolve
     * them differently, so every completion the local search came across is a
     * candidate. Whenever a new best ordering is found, its own completion
     * becomes a candidate too.
     */
    let completed = baseEvaluator.complete(best.ordering);
    let optimal = false;
    let exactExpansions = 0;
    const exactMode = input.exact === undefined ? 'auto' : input.exact;
    const maxExactVariables = input.maxExactVariables === undefined ? 20 : input.maxExactVariables;
    const runExact = exactMode === true || (exactMode === 'auto' && n <= maxExactVariables);
    if (runExact) {
        const candidates: { ordering: number[], table: DenseTruthTable }[] = [];
        const seenCompletions: Set<string> = new Set();
        const addCandidate = (ordering: number[], front: boolean) => {
            const table = baseEvaluator.complete(ordering);
            const key = completionKey(table);
            if (seenCompletions.has(key)) {
                return;
            }
            seenCompletions.add(key);
            const candidate = { ordering, table };
            if (front) {
                candidates.unshift(candidate);
            } else {
                candidates.push(candidate);
            }
        };
        addCandidate(best.ordering, false);
        if (base.dontCareTerminal >= 0) {
            seedResults.forEach(result => addCandidate(result.ordering, false));
        }

        let budgetExceeded = false;
        let provenFor: string | null = null;
        while (candidates.length > 0 && !budgetExceeded) {
            const candidate = candidates.shift() as { ordering: number[], table: DenseTruthTable };
            const candidateKey = completionKey(candidate.table);
            let exactOrdering: number[] | null;
            let solved: boolean;
            let expansions: number;
            if (costModel) {
                const exactResult = new ExactCostOrderingSearch(candidate.table, costModel).run({
                    maxExpansions: input.maxExactExpansions,
                    upperBoundOrdering: candidate.ordering,
                    // only orderings that beat the best known one are interesting
                    upperBound: best.evaluation.expectedCost,
                    log
                });
                exactOrdering = exactResult.ordering;
                solved = exactResult.solved;
                expansions = exactResult.expansions;
            } else {
                const exactResult = new ExactOrderingSearch(candidate.table).run({
                    maxExpansions: input.maxExactExpansions,
                    upperBoundOrdering: candidate.ordering,
                    upperBound: best.evaluation.nodeCount - candidate.table.leafCount,
                    log
                });
                exactOrdering = exactResult.ordering;
                solved = exactResult.solved;
                expansions = exactResult.expansions;
            }
            exactExpansions += expansions;
            if (!solved) {
                budgetExceeded = true;
                log('exact search gave up, keeping the best ordering so far');
                break;
            }
            if (exactOrdering) {
                const candidateEvaluator = new OrderingEvaluator(candidate.table, costModel);
                const exactEvaluation = candidateEvaluator.evaluate(exactOrdering);
                evaluations += candidateEvaluator.evaluations;
                log('exact search: ' + describe(exactEvaluation) + ' after ' + expansions + ' expansions');
                if (baseEvaluator.isBetter(exactEvaluation, best.evaluation)) {
                    best = { ordering: exactOrdering, evaluation: exactEvaluation };
                    completed = candidate.table;
                    provenFor = candidateKey;
                    onImprovement({
                        ordering: best.ordering.slice(),
                        nodeCount: exactEvaluation.nodeCount,
                        expectedCost: exactEvaluation.expectedCost,
                        phase: 'exact'
                    });
                    if (base.dontCareTerminal >= 0) {
                        // the don't-care rows might resolve even better with the new ordering
                        addCandidate(best.ordering, true);
                    }
                    continue;
                }
            }
            if (candidateKey === completionKey(completed)) {
                // nothing beats the best ordering on its own completion
                provenFor = candidateKey;
            }
        }
        optimal = !budgetExceeded && provenFor === completionKey(completed);
    }
    evaluations += baseEvaluator.evaluations;

    return {
        ordering: best.ordering,
        nodeCount: best.evaluation.nodeCount,
        expectedCost: costModel ? best.evaluation.expectedCost : undefined,
        optimal,
        truthTable: denseTruthTableToMap(completed),
        table: completed,
        stats: {
            evaluations,
            exactExpansions,
            localSearchNodeCount,
            durationMs: Date.now() - startTime
        }
    };
}

/**
 * identifies the content of a (completed) table
 */
function completionKey(table: DenseTruthTable): string {
    let h1 = 0x811C9DC5;
    let h2 = 0x01000193;
    const ids = table.terminalIds;
    for (let i = 0; i < ids.length; i++) {
        h1 = Math.imul(h1 ^ ids[i], 0x01000193);
        h2 = Math.imul(h2 + ids[i], 0x9E3779B1) ^ (h2 >>> 13);
    }
    return (h1 >>> 0).toString(16) + ':' + (h2 >>> 0).toString(16) + ':' + ids.length;
}

/**
 * Deterministic replacement for optimizeBruteForce():
 * finds a good variable ordering and returns the minimized BDD for it.
 */
export async function optimizeOrdering(input: OptimizeOrderingInput): Promise<OptimizeOrderingResult> {
    const found = findOrdering(input);
    const bdd = buildBddForOrdering(found.table, found.ordering);
    if (input.afterBddCreation) {
        input.afterBddCreation(bdd);
        bdd.minimize();
    }
    return {
        bdd,
        ordering: found.ordering,
        nodeCount: bdd.countNodes(),
        expectedCost: found.expectedCost,
        optimal: found.optimal,
        truthTable: found.truthTable,
        table: found.table,
        stats: found.stats
    };
}

/**
 * Creates the minimized BDD of a truth table for a given ordering
 * without going through the unreduced decision tree.
 */
export function createBddWithOrdering(
    truthTable: TruthTable,
    ordering: ArrayLike<number>,
    dontCareValue?: number
): RootNode {
    const base = parseTruthTable(truthTable, dontCareValue);
    const evaluator = new OrderingEvaluator(base);
    const completed = evaluator.complete(ordering);
    return buildBddForOrdering(completed, ordering);
}

function buildBddForOrdering(table: DenseTruthTable, ordering: ArrayLike<number>): RootNode {
    const evaluator = new OrderingEvaluator(table);
    const diagram = evaluator.buildDiagram(ordering);
    return buildBddFromDiagram(diagram, table);
}
