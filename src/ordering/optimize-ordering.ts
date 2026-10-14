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
    OrderingProgressCallback,
    DEFAULT_WINDOW_SIZE,
    ensureWindowSize,
    ensureNonNegativeInteger
} from './local-search.js';
import { ExactOrderingSearch } from './exact-ordering.js';
import { ExactCostOrderingSearch } from './exact-cost-ordering.js';
import { buildBddFromDiagram } from './build-bdd.js';
import type { AbstractNode } from '../abstract-node.js';
import type { InternalNode } from '../internal-node.js';

export const DEFAULT_MAX_EXACT_VARIABLES = 20;
export const DEFAULT_MAX_EXACT_NODE_COUNT = 5000;

export interface FindOrderingInput {
    truthTable: TruthTable;
    /**
     * Value of the rows that can never occur at runtime.
     * These rows are resolved exactly like removeIrrelevantLeafNodes() does it:
     * a branch that only leads to don't-care rows is replaced by its sibling.
     * Which ordering profits most from that is part of the search, but the
     * rule itself is a heuristic, not the smallest possible completion.
     */
    dontCareValue?: number;
    /**
     * Cost of calling each boolean function: functionCosts[i] belongs to the
     * boolean function with index i (the i-th character of the truth table keys).
     * When given, the optimizer minimizes the expected cost of one resolve() call,
     * that is the sum of the costs of the boolean functions that are called on the
     * way from the root to the leaf, averaged over the rows, instead of the amount
     * of nodes. Among orderings with the same expected cost, fewer nodes are
     * preferred (best effort, not part of the optimality proof).
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
     * - 'auto' (default): run the exact search when the truth table has at
     *   most maxExactVariables boolean functions and the BDD found by the local
     *   search has at most maxExactNodeCount internal nodes (unstructured
     *   functions have big BDDs, and on them the exact search is slow and
     *   cannot gain much)
     * - true: always run the exact search (within the budgets below)
     * - false: never
     */
    exact?: boolean | 'auto';
    /** Default: 20 */
    maxExactVariables?: number;
    /** Default: 5000 */
    maxExactNodeCount?: number;
    /**
     * Budget of the exact search per candidate completion of the truth table.
     * A candidate whose search exceeds it cannot be proven optimal.
     * Default: 200000
     */
    maxExactExpansions?: number;
    /**
     * Memory budget of the exact search: the maximum amount of nodes of its
     * internal diagram (roughly 100 bytes each).
     * Default: 4000000
     */
    maxExactDiagramNodes?: number;
    /**
     * Size of the windows the local search permutes exhaustively,
     * at most 8 (the work grows with windowSize!).
     * Default: 3
     */
    windowSize?: number;
    /**
     * Maximum amount of sifting + window permutation rounds per start ordering.
     * Default: 50
     */
    maxRounds?: number;
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
     * for the truth table in `truthTable`. With don't-care rows that is one
     * completion of the input: another ordering can occasionally reach a smaller
     * BDD by resolving the don't-care rows differently.
     */
    optimal: boolean;
    /**
     * The truth table the BDD represents: the input table with the don't-care
     * rows resolved, with the same keys as the input (iterated in row order).
     * createBddWithOrdering(result.truthTable, result.ordering) rebuilds the BDD.
     * When don't-care rows exist, this completion can differ from the one that
     * createBddWithOrdering(input, result.ordering, dontCareValue) would pick.
     */
    truthTable: TruthTable;
    stats: OptimizeOrderingStats;
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
     * The optimizer cannot account for what the hook does, so prefer dontCareValue
     * over removeIrrelevantLeafNodes() in the hook. When the hook changes the BDD,
     * `optimal` is false, and `truthTable` and `expectedCost` describe the BDD
     * before the hook.
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
    let maxCost = 0;
    costs.forEach(cost => maxCost = Math.max(maxCost, cost));
    if (!isFinite(totalWeight) || !isFinite(maxCost * totalWeight)) {
        throw new Error('the function costs or row weights are too large, scale them down');
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
    return findOrderingWithTable(input).result;
}

/**
 * Checks the options before any expensive work starts.
 */
function ensureValidOptions(input: FindOrderingInput) {
    if (input.windowSize !== undefined) {
        ensureWindowSize(input.windowSize);
    }
    if (input.maxRounds !== undefined) {
        ensureNonNegativeInteger(input.maxRounds, 'maxRounds');
    }
    const budgets: (keyof FindOrderingInput)[] = ['maxExactVariables', 'maxExactNodeCount', 'maxExactExpansions', 'maxExactDiagramNodes'];
    budgets.forEach(name => {
        const value = input[name];
        if (value !== undefined) {
            ensureNonNegativeInteger(value as number, name);
        }
    });
    if (input.exact !== undefined && input.exact !== true && input.exact !== false && input.exact !== 'auto') {
        throw new Error('exact must be true, false or \'auto\'');
    }
}

function findOrderingWithTable(input: FindOrderingInput): { result: FindOrderingResult, table: DenseTruthTable } {
    const startTime = Date.now();
    ensureValidOptions(input);
    const log = input.log ? (message: string) => console.log('findOrdering(): ' + message) : () => null;
    const onImprovement = input.onImprovement ? input.onImprovement : () => null;
    const base = parseTruthTable(input.truthTable, input.dontCareValue);
    const n = base.variableCount;
    const costModel = buildCostModel(base, input.functionCosts, input.rowWeight);
    const baseEvaluator = new OrderingEvaluator(base, costModel);
    const windowSize = input.windowSize === undefined ? DEFAULT_WINDOW_SIZE : input.windowSize;
    let evaluations = 0;
    const describe = (evaluation: OrderingEvaluation) => evaluation.nodeCount + ' nodes' +
        (costModel ? ', expected cost ' + evaluation.expectedCost : '');

    /**
     * phase 1: deterministic seeds, each improved by sifting and window permutation
     */
    const userSeeds = (input.initialOrderings ? input.initialOrderings : []).map((ordering, index) => {
        ensureValidOrdering(ordering, n);
        return { name: 'initial-' + index, ordering: Array.from(ordering) };
    });
    const seenSeeds: Set<string> = new Set();
    const seeds = userSeeds.concat(seedOrderings(baseEvaluator)).filter(seed => {
        const key = seed.ordering.join(',');
        if (seenSeeds.has(key)) {
            return false;
        }
        seenSeeds.add(key);
        return true;
    });
    let localBest: BestOrdering | null = null;
    const seedResults: BestOrdering[] = [];
    // the last evaluation passed to onImprovement
    const reported: { evaluation: OrderingEvaluation | null } = { evaluation: null };
    for (const seed of seeds) {
        const search = new LocalOrderingSearch(baseEvaluator, seed.ordering, {
            windowSize,
            maxRounds: input.maxRounds,
            log: message => log('[' + seed.name + '] ' + message),
            onImprovement: progress => {
                if (!localBest || baseEvaluator.isBetter(search.best, localBest.evaluation)) {
                    reported.evaluation = search.best;
                    onImprovement(progress);
                }
            }
        });
        const result = search.run();
        log('seed ' + seed.name + ': ' + describe(result.evaluation));
        seedResults.push({ ordering: result.ordering, evaluation: result.evaluation });
        if (!localBest || baseEvaluator.isBetter(result.evaluation, localBest.evaluation)) {
            localBest = { ordering: result.ordering, evaluation: result.evaluation };
            if (!reported.evaluation || baseEvaluator.isBetter(result.evaluation, reported.evaluation)) {
                // the seed itself was better than everything before, the search did not report it
                reported.evaluation = result.evaluation;
                onImprovement({
                    ordering: result.ordering.slice(),
                    nodeCount: result.evaluation.nodeCount,
                    expectedCost: result.evaluation.expectedCost,
                    phase: 'seed'
                });
            }
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
    const maxExactVariables = input.maxExactVariables === undefined ? DEFAULT_MAX_EXACT_VARIABLES : input.maxExactVariables;
    const maxExactNodeCount = input.maxExactNodeCount === undefined ? DEFAULT_MAX_EXACT_NODE_COUNT : input.maxExactNodeCount;
    const runExact = exactMode === true || (
        exactMode === 'auto' &&
        n <= maxExactVariables &&
        best.evaluation.internalNodeCount <= maxExactNodeCount
    );
    if (exactMode === 'auto' && !runExact) {
        log('exact search skipped: ' + n + ' boolean functions, ' + best.evaluation.internalNodeCount + ' internal nodes');
    }
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

        /**
         * completions for which the exact search finished: on them, no ordering
         * beats the best evaluation known at that time (which is never worse than
         * the final one)
         */
        const solvedCompletions: Set<string> = new Set();
        while (candidates.length > 0) {
            const candidate = candidates.shift() as { ordering: number[], table: DenseTruthTable };
            const candidateKey = completionKey(candidate.table);
            let exactOrdering: number[] | null;
            let solved: boolean;
            let expansions: number;
            const searchOptions = { maxDiagramNodes: input.maxExactDiagramNodes };
            if (costModel) {
                const exactResult = new ExactCostOrderingSearch(candidate.table, costModel, searchOptions).run({
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
                const exactResult = new ExactOrderingSearch(candidate.table, searchOptions).run({
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
                log('exact search gave up on one completion of the truth table');
                continue;
            }
            solvedCompletions.add(candidateKey);
            if (!exactOrdering) {
                continue;
            }
            const candidateEvaluator = new OrderingEvaluator(candidate.table, costModel);
            let exactEvaluation = candidateEvaluator.evaluate(exactOrdering);
            if (costModel) {
                /**
                 * The exact cost search only minimizes the expected cost. Among the
                 * orderings with the same cost, fewer nodes are better, which the
                 * local search on the same completion takes care of.
                 */
                const polished = new LocalOrderingSearch(candidateEvaluator, exactOrdering, {
                    windowSize,
                    maxRounds: input.maxRounds
                }).run();
                exactOrdering = polished.ordering;
                exactEvaluation = polished.evaluation;
            }
            evaluations += candidateEvaluator.evaluations;
            log('exact search: ' + describe(exactEvaluation) + ' after ' + expansions + ' expansions');
            if (baseEvaluator.isBetter(exactEvaluation, best.evaluation)) {
                best = { ordering: exactOrdering, evaluation: exactEvaluation };
                completed = candidate.table;
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
            }
        }

        /**
         * When the completion the ordering picks itself is just as good,
         * prefer it: then createBddWithOrdering(input, ordering, dontCareValue)
         * rebuilds the same BDD.
         */
        if (base.dontCareTerminal >= 0) {
            const own = baseEvaluator.complete(best.ordering);
            if (completionKey(own) !== completionKey(completed)) {
                const ownEvaluation = baseEvaluator.evaluate(best.ordering);
                if (baseEvaluator.compare(ownEvaluation, best.evaluation) === 0) {
                    best = { ordering: best.ordering, evaluation: ownEvaluation };
                    completed = own;
                }
            }
        }
        optimal = solvedCompletions.has(completionKey(completed));
    }
    evaluations += baseEvaluator.evaluations;

    return {
        result: {
            ordering: best.ordering,
            nodeCount: best.evaluation.nodeCount,
            expectedCost: costModel ? best.evaluation.expectedCost : undefined,
            optimal,
            truthTable: denseTruthTableToMap(completed),
            stats: {
                evaluations,
                exactExpansions,
                localSearchNodeCount,
                durationMs: Date.now() - startTime
            }
        },
        table: completed
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
 * All work is synchronous, the promise exists for compatibility with optimizeBruteForce().
 */
export async function optimizeOrdering(input: OptimizeOrderingInput): Promise<OptimizeOrderingResult> {
    const { result: found, table } = findOrderingWithTable(input);
    const bdd = buildBddForOrdering(table, found.ordering);
    let optimal = found.optimal;
    if (input.afterBddCreation) {
        const before = fingerprint(bdd);
        input.afterBddCreation(bdd);
        bdd.minimize();
        if (fingerprint(bdd) !== before) {
            // the hook changed the BDD, the proof does not hold for it anymore
            optimal = false;
        }
    }
    return {
        bdd,
        ordering: found.ordering,
        nodeCount: bdd.countNodes(),
        expectedCost: found.expectedCost,
        optimal,
        truthTable: found.truthTable,
        stats: found.stats
    };
}

/**
 * Describes the structure and the leaf values of a BDD,
 * equal BDDs give equal strings.
 */
function fingerprint(bdd: RootNode): string {
    const ids: Map<AbstractNode, number> = new Map();
    const parts: string[] = [];
    const visit = (node: AbstractNode): number => {
        const known = ids.get(node);
        if (known !== undefined) {
            return known;
        }
        let part: string;
        if (node.isLeafNode()) {
            part = 'v' + String(node.asLeafNode().value);
        } else {
            const branches = (node as InternalNode).branches;
            part = node.level + ':' + visit(branches.getBranch('0')) + ',' + visit(branches.getBranch('1'));
        }
        const id = parts.length;
        parts.push(part);
        ids.set(node, id);
        return id;
    };
    visit(bdd);
    return parts.join(';');
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
