import { OrderingEvaluator } from './ordering-evaluator.js';
import { ensureValidOrdering, naturalOrdering } from './dense-truth-table.js';

export type OrderingProgressCallback = (progress: {
    ordering: number[];
    nodeCount: number;
    phase: string;
}) => void;

export interface LocalSearchOptions {
    /**
     * Size of the windows whose variables are permuted exhaustively.
     * 0 or 1 disables window permutation.
     * Default: 3
     */
    windowSize?: number;
    /**
     * Maximum amount of sifting rounds.
     * Default: 50
     */
    maxRounds?: number;
    onImprovement?: OrderingProgressCallback;
    log?: (message: string) => void;
}

export interface OrderingSearchResult {
    ordering: number[];
    nodeCount: number;
    nodesPerLevel: number[];
}

/**
 * Deterministic greedy construction:
 * fills the levels from the top, at each level the boolean function
 * that leads to the smallest BDD (with the other functions in their index order)
 * is picked.
 */
export function greedyTopDownOrdering(evaluator: OrderingEvaluator): number[] {
    const n = evaluator.variableCount;
    const prefix: number[] = [];
    let remaining = naturalOrdering(n);
    while (remaining.length > 1) {
        let bestVar = -1;
        let bestCount = Infinity;
        for (const candidate of remaining) {
            const ordering = prefix.concat([candidate], remaining.filter(v => v !== candidate));
            const count = evaluator.evaluate(ordering).nodeCount;
            if (count < bestCount) {
                bestCount = count;
                bestVar = candidate;
            }
        }
        prefix.push(bestVar);
        remaining = remaining.filter(v => v !== bestVar);
    }
    return prefix.concat(remaining);
}

/**
 * Deterministic greedy construction from the bottom:
 * at each step the boolean function that is cheapest as the lowest
 * remaining level is picked.
 */
export function greedyBottomUpOrdering(evaluator: OrderingEvaluator): number[] {
    const n = evaluator.variableCount;
    let suffix: number[] = [];
    let remaining = naturalOrdering(n);
    while (remaining.length > 1) {
        let bestVar = -1;
        let bestCount = Infinity;
        for (const candidate of remaining) {
            const ordering = remaining.filter(v => v !== candidate).concat([candidate], suffix);
            const count = evaluator.evaluate(ordering).nodeCount;
            if (count < bestCount) {
                bestCount = count;
                bestVar = candidate;
            }
        }
        suffix = [bestVar].concat(suffix);
        remaining = remaining.filter(v => v !== bestVar);
    }
    return remaining.concat(suffix);
}

/**
 * Lexicographically ordered permutations of 0..size-1
 */
function allPermutations(size: number): number[][] {
    const ret: number[][] = [];
    const recurse = (prefix: number[], rest: number[]) => {
        if (rest.length === 0) {
            ret.push(prefix);
            return;
        }
        for (let i = 0; i < rest.length; i++) {
            recurse(
                prefix.concat([rest[i]]),
                rest.slice(0, i).concat(rest.slice(i + 1))
            );
        }
    };
    recurse([], naturalOrdering(size));
    return ret;
}

/**
 * Improves an ordering by sifting (moving each variable through all positions
 * and keeping the best one) and exhaustive window permutation until no
 * strict improvement is found anymore. Everything is deterministic:
 * the same input always gives the same output.
 */
export class LocalOrderingSearch {
    public readonly ordering: number[];
    public nodeCount: number;
    public nodesPerLevel: number[];

    private readonly permuted: Int32Array;
    private readonly n: number;
    private readonly windowPermutations: number[][];
    private readonly windowSize: number;
    private readonly maxRounds: number;
    private readonly onImprovement: OrderingProgressCallback;
    private readonly log: (message: string) => void;

    constructor(
        private readonly evaluator: OrderingEvaluator,
        initialOrdering: ArrayLike<number>,
        options: LocalSearchOptions = {}
    ) {
        this.n = evaluator.variableCount;
        ensureValidOrdering(initialOrdering, this.n);
        this.ordering = Array.from(initialOrdering);
        this.permuted = evaluator.permute(this.ordering);
        const evaluation = evaluator.evaluatePermuted(this.permuted);
        this.nodeCount = evaluation.nodeCount;
        this.nodesPerLevel = evaluation.nodesPerLevel;
        this.windowSize = Math.min(options.windowSize === undefined ? 3 : options.windowSize, this.n);
        this.windowPermutations = this.windowSize >= 2 ? allPermutations(this.windowSize) : [];
        this.maxRounds = options.maxRounds === undefined ? 50 : options.maxRounds;
        this.onImprovement = options.onImprovement ? options.onImprovement : () => null;
        this.log = options.log ? options.log : () => null;
    }

    public result(): OrderingSearchResult {
        return {
            ordering: this.ordering.slice(),
            nodeCount: this.nodeCount,
            nodesPerLevel: this.nodesPerLevel.slice()
        };
    }

    /**
     * Runs sifting rounds and window permutation rounds
     * until a full cycle gives no improvement.
     */
    public run(): OrderingSearchResult {
        let round = 0;
        while (round < this.maxRounds) {
            round++;
            const before = this.nodeCount;
            this.siftRound();
            if (this.windowSize >= 2) {
                this.windowRound();
            }
            this.log('local search round ' + round + ': ' + before + ' -> ' + this.nodeCount + ' nodes');
            if (this.nodeCount >= before) {
                break;
            }
        }
        return this.result();
    }

    /**
     * One sifting round: each variable, largest level first,
     * is moved to the position where the BDD is smallest.
     * @returns true if the ordering improved
     */
    public siftRound(): boolean {
        const startCount = this.nodeCount;
        const n = this.n;
        const positionOf = (v: number) => this.ordering.indexOf(v);
        const variables = this.ordering.slice().sort((a, b) => {
            const diff = this.nodesPerLevel[positionOf(b)] - this.nodesPerLevel[positionOf(a)];
            return diff !== 0 ? diff : a - b;
        });

        for (const variable of variables) {
            const start = positionOf(variable);
            let bestCount = this.nodeCount;
            let bestPosition = start;
            let bestLevels = this.nodesPerLevel;
            let position = start;

            const moveTo = (target: number) => {
                while (position < target) {
                    this.swapAdjacent(position);
                    position++;
                }
                while (position > target) {
                    this.swapAdjacent(position - 1);
                    position--;
                }
            };
            const sweep = (target: number) => {
                while (position !== target) {
                    const step = position < target ? 1 : -1;
                    this.swapAdjacent(step === 1 ? position : position - 1);
                    position += step;
                    const evaluation = this.evaluator.evaluatePermuted(this.permuted);
                    if (evaluation.nodeCount < bestCount) {
                        bestCount = evaluation.nodeCount;
                        bestPosition = position;
                        bestLevels = evaluation.nodesPerLevel;
                    }
                }
            };

            // go to the closer end first, then to the other end
            if (start < n - 1 - start) {
                sweep(0);
                sweep(n - 1);
            } else {
                sweep(n - 1);
                sweep(0);
            }
            moveTo(bestPosition);
            if (bestCount < this.nodeCount) {
                this.nodeCount = bestCount;
                this.nodesPerLevel = bestLevels;
                this.log('sifting: ' + bestCount + ' nodes');
                this.onImprovement({ ordering: this.ordering.slice(), nodeCount: bestCount, phase: 'sifting' });
            } else {
                this.nodesPerLevel = bestLevels;
            }
        }
        return this.nodeCount < startCount;
    }

    /**
     * One window permutation round: for each window of adjacent levels
     * all permutations of its variables are tried.
     * @returns true if the ordering improved
     */
    public windowRound(): boolean {
        const startCount = this.nodeCount;
        const w = this.windowSize;
        if (w < 2) {
            return false;
        }
        for (let windowStart = 0; windowStart + w <= this.n; windowStart++) {
            const original = this.ordering.slice(windowStart, windowStart + w);
            let bestCount = this.nodeCount;
            let bestLevels = this.nodesPerLevel;
            let bestPermutation: number[] | null = null;
            for (const permutation of this.windowPermutations) {
                this.setWindow(windowStart, original, permutation);
                const evaluation = this.evaluator.evaluatePermuted(this.permuted);
                if (evaluation.nodeCount < bestCount) {
                    bestCount = evaluation.nodeCount;
                    bestLevels = evaluation.nodesPerLevel;
                    bestPermutation = permutation;
                }
            }
            if (bestPermutation) {
                this.setWindow(windowStart, original, bestPermutation);
                this.nodeCount = bestCount;
                this.nodesPerLevel = bestLevels;
                this.log('window permutation: ' + bestCount + ' nodes');
                this.onImprovement({ ordering: this.ordering.slice(), nodeCount: bestCount, phase: 'window' });
            } else {
                this.setWindow(windowStart, original, naturalOrdering(w));
            }
        }
        return this.nodeCount < startCount;
    }

    /**
     * swaps the variables of level and level+1
     */
    private swapAdjacent(level: number) {
        this.swapLevels(level, level + 1);
    }

    private swapLevels(levelA: number, levelB: number) {
        if (levelA === levelB) {
            return;
        }
        this.evaluator.swapLevels(this.permuted, levelA, levelB);
        const tmp = this.ordering[levelA];
        this.ordering[levelA] = this.ordering[levelB];
        this.ordering[levelB] = tmp;
    }

    /**
     * Arranges the window so that level (windowStart + i) holds original[permutation[i]].
     */
    private setWindow(windowStart: number, original: number[], permutation: number[]) {
        for (let i = 0; i < permutation.length; i++) {
            const wanted = original[permutation[i]];
            const currentLevel = this.ordering.indexOf(wanted);
            this.swapLevels(windowStart + i, currentLevel);
        }
    }
}

export const DEFAULT_SEED_NAMES = ['natural', 'reversed', 'greedy-top-down', 'greedy-bottom-up'];

/**
 * Deterministic start orderings for the local search.
 */
export function seedOrderings(evaluator: OrderingEvaluator): { name: string, ordering: number[] }[] {
    const n = evaluator.variableCount;
    const natural = naturalOrdering(n);
    const seeds = [
        { name: 'natural', ordering: natural },
        { name: 'reversed', ordering: natural.slice().reverse() },
        { name: 'greedy-top-down', ordering: greedyTopDownOrdering(evaluator) },
        { name: 'greedy-bottom-up', ordering: greedyBottomUpOrdering(evaluator) }
    ];
    // remove duplicates, keep the first occurrence
    const seen: Set<string> = new Set();
    return seeds.filter(seed => {
        const key = seed.ordering.join(',');
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
