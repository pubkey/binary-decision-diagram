/**
 * Public API of the variable ordering optimizer, see docs/variable-ordering.md.
 *
 * - optimize-ordering.ts: optimizeOrdering(), findOrdering(), createBddWithOrdering()
 * - ordering-evaluator.ts: counts the nodes (and the expected cost) of any ordering in O(2^n)
 * - local-search.ts: deterministic seeds, sifting and window permutation
 * - exact-ordering.ts, exact-cost-ordering.ts: A* searches that prove optimality
 * - shared-diagram.ts: the shared function diagram the exact searches work on
 * - dense-truth-table.ts, build-bdd.ts, int-pair-map.ts: data structures and helpers
 */
export {
    optimizeOrdering,
    findOrdering,
    createBddWithOrdering,
    buildCostModel,
    DEFAULT_MAX_EXACT_VARIABLES,
    DEFAULT_MAX_EXACT_NODE_COUNT
} from './optimize-ordering.js';
export type {
    FindOrderingInput,
    FindOrderingResult,
    OptimizeOrderingInput,
    OptimizeOrderingResult,
    OptimizeOrderingStats
} from './optimize-ordering.js';
export {
    OrderingEvaluator,
    OrderingCursor
} from './ordering-evaluator.js';
export type {
    CostModel,
    OrderingEvaluation,
    ReducedDiagram
} from './ordering-evaluator.js';
export {
    LocalOrderingSearch,
    DEFAULT_WINDOW_SIZE,
    DEFAULT_MAX_ROUNDS,
    MAX_WINDOW_SIZE
} from './local-search.js';
export type {
    LocalSearchOptions,
    OrderingSearchResult,
    OrderingProgress,
    OrderingProgressCallback
} from './local-search.js';
export { ExactOrderingSearch } from './exact-ordering.js';
export type { ExactOrderingOptions, ExactOrderingResult } from './exact-ordering.js';
export { ExactCostOrderingSearch } from './exact-cost-ordering.js';
export type { ExactCostOrderingOptions, ExactCostOrderingResult } from './exact-cost-ordering.js';
export {
    parseTruthTable,
    denseTruthTableToMap,
    naturalOrdering,
    MAX_VARIABLE_COUNT
} from './dense-truth-table.js';
export type { DenseTruthTable } from './dense-truth-table.js';
