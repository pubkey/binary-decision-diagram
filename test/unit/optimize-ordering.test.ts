import * as assert from 'assert';
import {
    exampleTruthTable,
    allEqualTable,
    randomTable,
    randomUnknownTable,
    UNKNOWN,
    getResolverFunctions,
    getBigTruthTable
} from '../helper/test-util.js';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table.js';
import type { ResolverFunctions } from '../../src/types.js';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd.js';
import {
    optimizeOrdering,
    findOrdering,
    createBddWithOrdering,
    parseTruthTable,
    OrderingEvaluator,
    ExactOrderingSearch,
    ExactCostOrderingSearch,
    buildCostModel,
    LocalOrderingSearch,
    naturalOrdering,
    bddToMinimalString,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd,
    changeKeyOrder,
    lastOfArray,
    TruthTable,
    RootNode,
    AbstractNode,
    shuffleArray
} from '../../src/index.js';

/**
 * Creates the BDD the same way optimizeBruteForce() does it for a given ordering:
 * build the full tree from the re-sorted table, relabel the levels,
 * remove the don't-care leaves and minimize.
 */
function bddViaLibrary(
    truthTable: TruthTable,
    ordering: number[],
    dontCareValue?: number
): RootNode {
    const n = ordering.length;
    // in optimizeBruteForce() the shuffled array is the inverse of the ordering
    const shuffled: number[] = new Array(n);
    ordering.forEach((variable, level) => shuffled[variable] = level);
    const mapping: any = {};
    const mappingBeforeToAfter: any = {};
    shuffled.forEach((indexBefore, indexAfter) => {
        mapping[indexAfter] = indexBefore;
        mappingBeforeToAfter[indexBefore] = indexAfter;
    });
    const newTable: TruthTable = new Map();
    for (const [key, value] of truthTable.entries()) {
        newTable.set(changeKeyOrder(key, mapping), value);
    }
    const bdd = createBddFromTruthTable(newTable);
    const newNodesByLevel: Map<number, Set<AbstractNode>> = new Map();
    const lastLevel = lastOfArray(bdd.getLevels());
    const newSortedLevels: number[] = [];
    bdd.getLevels()
        .filter(level => level !== lastLevel)
        .forEach(level => {
            const newLevel = mappingBeforeToAfter[level];
            newSortedLevels.push(newLevel);
            const levelSet: Set<AbstractNode> = new Set();
            newNodesByLevel.set(newLevel, levelSet);
            bdd.getNodesOfLevel(level).forEach(node => {
                node.level = newLevel;
                levelSet.add(node);
            });
        });
    const lastLevelSet: Set<AbstractNode> = new Set();
    bdd.getNodesOfLevel(lastLevel).forEach(node => lastLevelSet.add(node));
    newNodesByLevel.set(lastLevel, lastLevelSet);
    newSortedLevels.push(lastLevel);
    bdd.nodesByLevel = newNodesByLevel;
    bdd.levels = newSortedLevels;
    if (dontCareValue !== undefined) {
        bdd.removeIrrelevantLeafNodes(dontCareValue);
    }
    bdd.minimize();
    return bdd;
}

function allPermutations(items: number[]): number[][] {
    if (items.length <= 1) {
        return [items];
    }
    const ret: number[][] = [];
    items.forEach((item, index) => {
        const rest = items.slice(0, index).concat(items.slice(index + 1));
        allPermutations(rest).forEach(perm => ret.push([item].concat(perm)));
    });
    return ret;
}

function assertResolvesLikeTable(
    bdd: RootNode,
    truthTable: TruthTable,
    dontCareValue?: number
) {
    const depth = (truthTable.keys().next().value as string).length;
    const resolvers = getResolverFunctions(depth);
    const simpleBdd = minimalStringToSimpleBdd(bddToMinimalString(bdd));
    for (const [key, value] of truthTable.entries()) {
        if (value === dontCareValue) {
            continue;
        }
        assert.strictEqual(bdd.resolve(resolvers, key), value);
        assert.strictEqual(resolveWithSimpleBdd(simpleBdd, resolvers, key), value);
    }
}

/**
 * The expected cost of a resolve() call, measured by actually resolving
 * every row with resolver functions that add up their costs.
 */
function measureExpectedCost(
    bdd: RootNode,
    truthTable: TruthTable,
    functionCosts: number[],
    rowWeight: (key: string, value: number) => number,
    dontCareValue?: number
): number {
    const depth = functionCosts.length;
    let spent = 0;
    const resolvers: ResolverFunctions = {};
    for (let i = 0; i < depth; i++) {
        resolvers[i] = (state: string) => {
            spent += functionCosts[i];
            return state[i] === '1';
        };
    }
    let total = 0;
    let weightSum = 0;
    for (const [key, value] of truthTable.entries()) {
        if (value === dontCareValue) {
            continue;
        }
        const weight = rowWeight(key, value);
        spent = 0;
        bdd.resolve(resolvers, key);
        total += weight * spent;
        weightSum += weight;
    }
    return total / weightSum;
}

/**
 * a random table with the given amount of distinct values
 */
function randomValuedTable(depth: number, values: number, dontCareShare: number = 0): TruthTable {
    const table: TruthTable = new Map();
    for (let row = 0; row < Math.pow(2, depth); row++) {
        const value = Math.random() < dontCareShare ? UNKNOWN : 1 + Math.floor(Math.random() * values);
        table.set(row.toString(2).padStart(depth, '0'), value);
    }
    table.set('0'.repeat(depth), 1);
    return table;
}

/**
 * f = x0*x4 + x1*x5 + x2*x6 + x3*x7: the natural ordering is bad, the interleaved one is small
 */
function interleavedTable(): TruthTable {
    const table: TruthTable = new Map();
    for (let row = 0; row < 256; row++) {
        const key = row.toString(2).padStart(8, '0');
        let value = 1;
        for (let i = 0; i < 4; i++) {
            if (key[i] === '1' && key[i + 4] === '1') {
                value = 2;
            }
        }
        table.set(key, value);
    }
    return table;
}

function randomCosts(depth: number): number[] {
    const costs: number[] = [];
    for (let i = 0; i < depth; i++) {
        costs.push(Math.floor(Math.random() * 20) + (Math.random() < 0.3 ? 0 : 1));
    }
    return costs;
}

function assertClose(actual: number, expected: number) {
    const tolerance = 1e-9 * Math.max(1, Math.abs(expected));
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        'expected ' + actual + ' to be close to ' + expected
    );
}

describe('optimize-ordering.test.ts', () => {
    describe('OrderingEvaluator', () => {
        it('should count the same amount of nodes as the library pipeline', () => {
            for (let i = 0; i < 40; i++) {
                const depth = 1 + Math.floor(Math.random() * 6);
                const useDontCare = i % 2 === 0;
                const truthTable = useDontCare ? randomUnknownTable(depth) : randomTable(depth);
                if (Array.from(truthTable.values()).every(v => v === UNKNOWN)) {
                    truthTable.set('0'.repeat(depth), 1);
                }
                const ordering = shuffleArray(naturalOrdering(depth));
                const evaluator = new OrderingEvaluator(parseTruthTable(truthTable, useDontCare ? UNKNOWN : undefined));
                const evaluation = evaluator.evaluate(ordering);
                const libraryBdd = bddViaLibrary(truthTable, ordering, useDontCare ? UNKNOWN : undefined);
                assert.strictEqual(evaluation.nodeCount, libraryBdd.countNodes());
            }
        });
        it('should resolve the don\'t-care rows like removeIrrelevantLeafNodes()', () => {
            for (let i = 0; i < 20; i++) {
                const depth = 2 + Math.floor(Math.random() * 5);
                const truthTable = randomUnknownTable(depth);
                truthTable.set('0'.repeat(depth), 1);
                const ordering = shuffleArray(naturalOrdering(depth));
                const evaluator = new OrderingEvaluator(parseTruthTable(truthTable, UNKNOWN));
                const completed = evaluator.complete(ordering);
                const libraryBdd = bddViaLibrary(truthTable, ordering, UNKNOWN);
                const resolvers = getResolverFunctions(depth);
                for (let row = 0; row < completed.rowCount; row++) {
                    const key = row.toString(2).padStart(depth, '0');
                    assert.strictEqual(
                        completed.terminalValues[completed.terminalIds[row]],
                        libraryBdd.resolve(resolvers, key)
                    );
                }
            }
        });
        it('should throw on incomplete tables', () => {
            const truthTable = exampleTruthTable(3);
            truthTable.delete('010');
            assert.throws(() => parseTruthTable(truthTable));
        });
    });
    describe('OrderingCursor', () => {
        it('should stay consistent with fresh evaluations through random swaps', () => {
            for (let i = 0; i < 30; i++) {
                const depth = 1 + Math.floor(Math.random() * 7);
                const useDontCare = i % 2 === 0;
                const useCosts = i % 3 === 0;
                const truthTable = randomValuedTable(depth, 1 + Math.floor(Math.random() * 4), useDontCare ? Math.random() * 0.8 : 0);
                const table = parseTruthTable(truthTable, useDontCare ? UNKNOWN : undefined);
                const costModel = useCosts ? buildCostModel(table, randomCosts(depth), (key: string) => 1 + (parseInt(key, 2) % 3)) : null;
                const evaluator = new OrderingEvaluator(table, costModel);
                const cursor = evaluator.cursor(shuffleArray(naturalOrdering(depth)));
                for (let step = 0; step < 15; step++) {
                    const a = Math.floor(Math.random() * depth);
                    const b = Math.floor(Math.random() * depth);
                    cursor.swap(a, b);
                    const fresh = evaluator.evaluate(cursor.ordering);
                    assert.deepStrictEqual(cursor.evaluation.nodesPerLevel, fresh.nodesPerLevel);
                    assert.strictEqual(cursor.evaluation.nodeCount, fresh.nodeCount);
                    assertClose(cursor.evaluation.expectedCost, fresh.expectedCost);
                    const libraryBdd = bddViaLibrary(truthTable, cursor.ordering, useDontCare ? UNKNOWN : undefined);
                    assert.strictEqual(cursor.evaluation.nodeCount, libraryBdd.countNodes());
                }
            }
        });
    });
    describe('createBddWithOrdering()', () => {
        it('should create a correct and minimal bdd', () => {
            for (let i = 0; i < 20; i++) {
                const depth = 1 + Math.floor(Math.random() * 7);
                const useDontCare = i % 2 === 0;
                const truthTable = useDontCare ? randomUnknownTable(depth) : randomTable(depth);
                truthTable.set('0'.repeat(depth), 1);
                const ordering = shuffleArray(naturalOrdering(depth));
                const bdd = createBddWithOrdering(truthTable, ordering, useDontCare ? UNKNOWN : undefined);
                ensureCorrectBdd(bdd);
                const libraryBdd = bddViaLibrary(truthTable, ordering, useDontCare ? UNKNOWN : undefined);
                assert.strictEqual(bdd.countNodes(), libraryBdd.countNodes());
                assertResolvesLikeTable(bdd, truthTable, useDontCare ? UNKNOWN : undefined);
                // minimize must not change anything
                bdd.minimize();
                assert.strictEqual(bdd.countNodes(), libraryBdd.countNodes());
            }
        });
        it('should list the levels from top to bottom like optimizeBruteForce()', () => {
            const truthTable = randomTable(4);
            const ordering = [2, 0, 3, 1];
            const bdd = createBddWithOrdering(truthTable, ordering);
            assert.deepStrictEqual(bdd.levels, [2, 0, 3, 1, 4]);
            assert.strictEqual(bdd.level, 2);
        });
    });
    describe('ExactOrderingSearch', () => {
        it('should find the optimum of all permutations', () => {
            for (let i = 0; i < 30; i++) {
                const depth = 1 + Math.floor(Math.random() * 6);
                const truthTable = randomValuedTable(depth, 1 + Math.floor(Math.random() * 4), i % 2 === 0 ? 0.5 : 0);
                // the exact search needs a fully specified function
                const table = new OrderingEvaluator(parseTruthTable(truthTable, UNKNOWN)).complete(naturalOrdering(depth));
                const evaluator = new OrderingEvaluator(table);
                let optimum = Infinity;
                allPermutations(naturalOrdering(depth)).forEach(permutation => {
                    optimum = Math.min(optimum, evaluator.evaluate(permutation).nodeCount);
                });
                const withoutBound = new ExactOrderingSearch(table).run();
                assert.ok(withoutBound.solved);
                assert.ok(withoutBound.ordering);
                assert.strictEqual(evaluator.evaluate(withoutBound.ordering as number[]).nodeCount, optimum);

                const withBound = new ExactOrderingSearch(table).run({
                    upperBoundOrdering: naturalOrdering(depth).reverse()
                });
                assert.ok(withBound.solved);
                assert.strictEqual(evaluator.evaluate(withBound.ordering as number[]).nodeCount, optimum);
            }
        });
        it('should report when no ordering beats the numeric upper bound', () => {
            const truthTable = randomTable(4);
            const table = parseTruthTable(truthTable);
            const best = new ExactOrderingSearch(table).run();
            const result = new ExactOrderingSearch(table).run({ upperBound: best.internalNodeCount });
            assert.ok(result.solved);
            assert.strictEqual(result.ordering, null);
        });
        it('should give up when the budget is exceeded', () => {
            const truthTable = randomTable(8);
            const table = parseTruthTable(truthTable);
            const result = new ExactOrderingSearch(table).run({ maxExpansions: 2 });
            assert.strictEqual(result.solved, false);
            assert.strictEqual(result.ordering, null);
            assert.strictEqual(result.internalNodeCount, -1);
            const tiny = new ExactOrderingSearch(table, { maxDiagramNodes: 1 }).run();
            assert.strictEqual(tiny.solved, false);
            // with a known ordering, giving up still returns that ordering
            const small = new ExactOrderingSearch(table, { maxDiagramNodes: 300 }).run({
                upperBoundOrdering: naturalOrdering(8),
                maxExpansions: 2
            });
            assert.ok(small.ordering);
            assert.strictEqual(
                new OrderingEvaluator(table).evaluate(small.ordering as number[]).internalNodeCount,
                small.internalNodeCount
            );
        });
        it('should reject tables with don\'t-care rows', () => {
            const truthTable = randomUnknownTable(4);
            truthTable.set('0000', 1);
            assert.throws(() => new ExactOrderingSearch(parseTruthTable(truthTable, UNKNOWN)));
        });
    });
    describe('LocalOrderingSearch', () => {
        it('should never return a worse ordering than it started with', () => {
            const truthTable = randomUnknownTable(7);
            truthTable.set('0000000', 1);
            const evaluator = new OrderingEvaluator(parseTruthTable(truthTable, UNKNOWN));
            const start = shuffleArray(naturalOrdering(7));
            const startCount = evaluator.evaluate(start).nodeCount;
            const result = new LocalOrderingSearch(evaluator, start).run();
            assert.ok(result.nodeCount <= startCount);
            assert.strictEqual(evaluator.evaluate(result.ordering).nodeCount, result.nodeCount);
        });
    });
    describe('findOrdering()', () => {
        it('should be deterministic', () => {
            const truthTable = randomUnknownTable(7);
            truthTable.set('0000000', 1);
            const first = findOrdering({ truthTable, dontCareValue: UNKNOWN });
            const second = findOrdering({ truthTable, dontCareValue: UNKNOWN });
            assert.deepStrictEqual(first.ordering, second.ordering);
            assert.strictEqual(first.nodeCount, second.nodeCount);
            assert.deepStrictEqual(Array.from(first.truthTable.entries()), Array.from(second.truthTable.entries()));
        });
        it('should find the optimum for small tables', () => {
            for (let i = 0; i < 10; i++) {
                const depth = 1 + Math.floor(Math.random() * 6);
                const truthTable = randomTable(depth);
                const evaluator = new OrderingEvaluator(parseTruthTable(truthTable));
                let optimum = Infinity;
                allPermutations(naturalOrdering(depth)).forEach(permutation => {
                    optimum = Math.min(optimum, evaluator.evaluate(permutation).nodeCount);
                });
                const result = findOrdering({ truthTable });
                assert.strictEqual(result.nodeCount, optimum);
                assert.strictEqual(result.optimal, true);
            }
        });
        it('should return a completed truth table with the same keys', () => {
            const truthTable = randomUnknownTable(5);
            truthTable.set('00000', 1);
            const result = findOrdering({ truthTable, dontCareValue: UNKNOWN });
            assert.strictEqual(result.truthTable.size, truthTable.size);
            for (const [key, value] of truthTable.entries()) {
                assert.ok(result.truthTable.has(key));
                if (value !== UNKNOWN) {
                    assert.strictEqual(result.truthTable.get(key), value);
                } else {
                    assert.notStrictEqual(result.truthTable.get(key), UNKNOWN);
                }
            }
        });
        it('should not run the exact search when disabled', () => {
            const truthTable = randomTable(5);
            const result = findOrdering({ truthTable, exact: false });
            assert.strictEqual(result.optimal, false);
            assert.strictEqual(result.stats.exactExpansions, 0);
        });
        it('should accept initial orderings', () => {
            const truthTable = randomTable(5);
            const result = findOrdering({ truthTable, initialOrderings: [[4, 3, 2, 1, 0]], exact: false });
            assert.ok(result.nodeCount > 0);
            assert.throws(() => findOrdering({ truthTable, initialOrderings: [[0, 0, 1, 2, 3]] }));
        });
    });
    describe('optimizeOrdering()', () => {
        it('should return a correct minimal bdd that resolves like the truth table', async () => {
            for (let i = 0; i < 6; i++) {
                const depth = 2 + Math.floor(Math.random() * 6);
                const useDontCare = i % 2 === 0;
                const truthTable = useDontCare ? randomUnknownTable(depth) : randomTable(depth);
                truthTable.set('0'.repeat(depth), 1);
                const result = await optimizeOrdering({ truthTable, dontCareValue: useDontCare ? UNKNOWN : undefined });
                ensureCorrectBdd(result.bdd);
                assert.strictEqual(result.bdd.countNodes(), result.nodeCount);
                assert.deepStrictEqual(result.bdd.levels.slice(0, depth), result.ordering);
                assertResolvesLikeTable(result.bdd, truthTable, useDontCare ? UNKNOWN : undefined);
            }
        });
        it('should never be worse than the natural ordering', async () => {
            const truthTable = randomUnknownTable(8);
            truthTable.set('00000000', 1);
            const natural = createBddFromTruthTable(truthTable);
            natural.removeIrrelevantLeafNodes(UNKNOWN);
            natural.minimize();
            const result = await optimizeOrdering({ truthTable, dontCareValue: UNKNOWN });
            assert.ok(result.nodeCount <= natural.countNodes());
        });
        it('should work with a constant table', async () => {
            const truthTable = allEqualTable(4);
            const result = await optimizeOrdering({ truthTable });
            ensureCorrectBdd(result.bdd);
            assert.strictEqual(result.nodeCount, 2);
            assert.strictEqual(result.optimal, true);
        });
        it('should call the hooks', async () => {
            const truthTable = interleavedTable();
            const reported: number[] = [];
            let hookCalled = false;
            const result = await optimizeOrdering({
                truthTable,
                onImprovement: progress => reported.push(progress.nodeCount),
                afterBddCreation: () => hookCalled = true
            });
            assert.ok(hookCalled);
            // the natural ordering of this table has 32 nodes, the interleaved one 10
            assert.strictEqual(result.nodeCount, 10);
            assert.ok(reported.length > 0);
            for (let i = 1; i < reported.length; i++) {
                assert.ok(reported[i] < reported[i - 1]);
            }
            assert.strictEqual(reported[reported.length - 1], result.nodeCount);
        });
        it('should keep the key order of the levels and the resolvers in sync', async () => {
            const truthTable = randomTable(5);
            const result = await optimizeOrdering({ truthTable });
            const resolvers = getResolverFunctions(5);
            for (const [key, value] of truthTable.entries()) {
                assert.strictEqual(result.bdd.resolve(resolvers, key), value);
            }
        });
        it('should optimize the big truth table', async function () {
            this.timeout(120000);
            const truthTable = getBigTruthTable();
            const natural = createBddFromTruthTable(truthTable);
            natural.removeIrrelevantLeafNodes(UNKNOWN);
            natural.minimize();
            const result = await optimizeOrdering({ truthTable, dontCareValue: UNKNOWN });
            ensureCorrectBdd(result.bdd);
            assert.ok(result.nodeCount < natural.countNodes() / 2);
            assertResolvesLikeTable(result.bdd, truthTable, UNKNOWN);
        });
    });
    describe('edge cases', () => {
        it('should handle tables with a single boolean function', async () => {
            const constant: TruthTable = new Map([['0', 7], ['1', 7]]);
            const constantResult = await optimizeOrdering({ truthTable: constant });
            ensureCorrectBdd(constantResult.bdd);
            assert.strictEqual(constantResult.nodeCount, 2);
            assert.deepStrictEqual(constantResult.ordering, [0]);
            assertResolvesLikeTable(constantResult.bdd, constant);

            const identity: TruthTable = new Map([['0', 1], ['1', 2]]);
            const identityResult = await optimizeOrdering({ truthTable: identity });
            ensureCorrectBdd(identityResult.bdd);
            assert.strictEqual(identityResult.nodeCount, 3);
            assert.strictEqual(identityResult.optimal, true);
            assertResolvesLikeTable(identityResult.bdd, identity);

            const withDontCare: TruthTable = new Map([['0', UNKNOWN], ['1', 3]]);
            const bdd = createBddWithOrdering(withDontCare, [0], UNKNOWN);
            ensureCorrectBdd(bdd);
            assert.strictEqual(bdd.resolve(getResolverFunctions(1), '0'), 3);
        });
        it('should handle unusual values and don\'t-care values', async () => {
            const truthTable: TruthTable = new Map();
            const values = [0, -5, 1000, 7, 0, 0, -5, 1000];
            for (let row = 0; row < 8; row++) {
                truthTable.set(row.toString(2).padStart(3, '0'), values[row]);
            }
            const plain = await optimizeOrdering({ truthTable });
            ensureCorrectBdd(plain.bdd);
            assertResolvesLikeTable(plain.bdd, truthTable);

            const zeroIsDontCare = await optimizeOrdering({ truthTable, dontCareValue: 0 });
            ensureCorrectBdd(zeroIsDontCare.bdd);
            assertResolvesLikeTable(zeroIsDontCare.bdd, truthTable, 0);
            assert.ok(zeroIsDontCare.nodeCount <= plain.nodeCount);
            for (const value of zeroIsDontCare.truthTable.values()) {
                assert.notStrictEqual(value, 0);
            }

            // a don't-care value that does not occur changes nothing
            const absent = await optimizeOrdering({ truthTable, dontCareValue: 12345 });
            assert.strictEqual(absent.nodeCount, plain.nodeCount);
            assert.deepStrictEqual(absent.ordering, plain.ordering);
        });
        it('should keep the keys of the input table', () => {
            const truthTable = randomUnknownTable(4);
            truthTable.set('0000', 1);
            const result = findOrdering({ truthTable, dontCareValue: UNKNOWN });
            assert.deepStrictEqual(
                Array.from(result.truthTable.keys()).sort(),
                Array.from(truthTable.keys()).sort()
            );
        });
        it('should rebuild the same bdd from result.truthTable and result.ordering', async () => {
            for (let i = 0; i < 5; i++) {
                const truthTable = randomUnknownTable(6);
                truthTable.set('000000', 1);
                const result = await optimizeOrdering({ truthTable, dontCareValue: UNKNOWN });
                const rebuilt = createBddWithOrdering(result.truthTable, result.ordering);
                assert.strictEqual(rebuilt.countNodes(), result.nodeCount);
                assert.strictEqual(bddToMinimalString(rebuilt), bddToMinimalString(result.bdd));
            }
        });
        it('should not claim optimality when the exact search gives up', () => {
            const truthTable = randomTable(8);
            const result = findOrdering({ truthTable, maxExactExpansions: 1 });
            assert.strictEqual(result.optimal, false);
            assert.ok(result.nodeCount > 0);
            const evaluator = new OrderingEvaluator(parseTruthTable(truthTable));
            assert.strictEqual(evaluator.evaluate(result.ordering).nodeCount, result.nodeCount);
        });
        it('should respect the exact search switches', () => {
            const truthTable = randomTable(6);
            const auto = findOrdering({ truthTable, maxExactVariables: 3 });
            assert.strictEqual(auto.optimal, false);
            assert.strictEqual(auto.stats.exactExpansions, 0);
            const bigBdd = findOrdering({ truthTable, maxExactNodeCount: 1 });
            assert.strictEqual(bigBdd.optimal, false);
            assert.strictEqual(bigBdd.stats.exactExpansions, 0);
            const forced = findOrdering({ truthTable, exact: true, maxExactVariables: 3, maxExactNodeCount: 1 });
            assert.strictEqual(forced.optimal, true);
            assert.ok(forced.nodeCount <= auto.nodeCount);
            const noMemory = findOrdering({ truthTable: randomTable(8), exact: true, maxExactDiagramNodes: 1 });
            assert.strictEqual(noMemory.optimal, false);
        });
        it('should use initial orderings in the given order and ignore duplicates', () => {
            const truthTable = randomTable(5);
            const optimum = findOrdering({ truthTable });
            const seeded = findOrdering({
                truthTable,
                initialOrderings: [optimum.ordering, optimum.ordering, naturalOrdering(5)],
                exact: false
            });
            assert.strictEqual(seeded.nodeCount, optimum.nodeCount);
            assert.deepStrictEqual(seeded.ordering, optimum.ordering);
        });
        it('should validate the window size and the rounds', () => {
            const truthTable = randomTable(5);
            assert.throws(() => findOrdering({ truthTable, windowSize: 2.5 }));
            assert.throws(() => findOrdering({ truthTable, windowSize: -1 }));
            const noWindow = findOrdering({ truthTable, windowSize: 0 });
            const bigWindow = findOrdering({ truthTable, windowSize: 8 });
            assert.ok(noWindow.nodeCount > 0);
            assert.strictEqual(bigWindow.optimal, true);
            const evaluator = new OrderingEvaluator(parseTruthTable(truthTable));
            assert.throws(() => new LocalOrderingSearch(evaluator, naturalOrdering(5), { maxRounds: 1.5 }));
            const oneRound = new LocalOrderingSearch(evaluator, naturalOrdering(5), { maxRounds: 1 }).run();
            assert.ok(oneRound.nodeCount > 0);
            const noRounds = findOrdering({ truthTable, maxRounds: 0, exact: false });
            assert.ok(noRounds.nodeCount > 0);
            assert.throws(() => findOrdering({ truthTable, maxRounds: -1 }));
        });
        it('should not claim optimality after a hook changed the bdd', async () => {
            const truthTable = randomUnknownTable(5);
            truthTable.set('00000', 1);
            truthTable.set('00001', 2);
            const noop = await optimizeOrdering({
                truthTable,
                dontCareValue: UNKNOWN,
                afterBddCreation: bdd => bdd.removeIrrelevantLeafNodes(UNKNOWN)
            });
            // the don't-care rows are already resolved, the hook changes nothing
            const withoutHook = findOrdering({ truthTable, dontCareValue: UNKNOWN });
            assert.strictEqual(withoutHook.optimal, true);
            assert.strictEqual(noop.optimal, true);
            assert.strictEqual(noop.nodeCount, withoutHook.nodeCount);
            ensureCorrectBdd(noop.bdd);

            const changing = await optimizeOrdering({
                truthTable,
                dontCareValue: UNKNOWN,
                afterBddCreation: bdd => bdd.removeIrrelevantLeafNodes(2)
            });
            ensureCorrectBdd(changing.bdd);
            assert.strictEqual(changing.optimal, false);

            // a hook that changes the values but not the amount of nodes
            const relabeled = await optimizeOrdering({
                truthTable,
                dontCareValue: UNKNOWN,
                afterBddCreation: bdd => bdd.getLeafNodes().forEach(leaf => leaf.value = leaf.value + 100)
            });
            assert.strictEqual(relabeled.nodeCount, withoutHook.nodeCount);
            assert.strictEqual(relabeled.optimal, false);
        });
        it('removeIrrelevantLeafNodes() should work when the root points to the same node twice', () => {
            // f = x1 ? 2 : 1, x0 is irrelevant so the root has the x1 node in both branches
            const truthTable: TruthTable = new Map([['00', 1], ['01', 2], ['10', 1], ['11', 2]]);
            const bdd = createBddWithOrdering(truthTable, [0, 1]);
            assert.strictEqual(bdd.branches.getBranch('0'), bdd.branches.getBranch('1'));
            bdd.removeIrrelevantLeafNodes(2);
            ensureCorrectBdd(bdd);
            const resolvers = getResolverFunctions(2);
            for (const key of truthTable.keys()) {
                assert.strictEqual(bdd.resolve(resolvers, key), 1);
            }
        });
    });
    describe('input validation', () => {
        it('should reject window sizes that would take too long before doing any work', () => {
            const truthTable = randomTable(10);
            const evaluator = new OrderingEvaluator(parseTruthTable(truthTable));
            assert.throws(() => new LocalOrderingSearch(evaluator, naturalOrdering(10), { windowSize: 9 }), /at most 8/);
            assert.throws(() => findOrdering({ truthTable, windowSize: 9 }), /at most 8/);
            assert.ok(findOrdering({ truthTable: randomTable(4), windowSize: 8, exact: false }).nodeCount > 0);
        });
        it('should reject invalid budgets and modes', () => {
            const truthTable = randomTable(4);
            assert.throws(() => findOrdering({ truthTable, maxExactExpansions: NaN }), /maxExactExpansions/);
            assert.throws(() => findOrdering({ truthTable, maxExactDiagramNodes: -1 }), /maxExactDiagramNodes/);
            assert.throws(() => findOrdering({ truthTable, maxExactVariables: 'x' as any }), /maxExactVariables/);
            assert.throws(() => findOrdering({ truthTable, maxExactNodeCount: 1.5 }), /maxExactNodeCount/);
            assert.throws(() => findOrdering({ truthTable, exact: 'yes' as any }), /exact/);
        });
        it('should reject costs and weights whose sums overflow', () => {
            const truthTable = randomTable(4);
            assert.throws(() => findOrdering({ truthTable, functionCosts: [1, 1, 1, 1], rowWeight: () => 1e308 }), /too large/);
            assert.throws(() => findOrdering({ truthTable, functionCosts: [1e308, 1, 1, 1] }), /too large/);
        });
        it('should reject a cost model that gives don\'t-care rows a weight', () => {
            const truthTable = randomUnknownTable(3);
            truthTable.set('000', 1);
            truthTable.set('001', UNKNOWN);
            const table = parseTruthTable(truthTable, UNKNOWN);
            const rowWeights = new Float64Array(table.rowCount).fill(1);
            assert.throws(
                () => new OrderingEvaluator(table, { functionCosts: new Float64Array([1, 1, 1]), rowWeights, totalWeight: table.rowCount }),
                /don't-care/
            );
        });
    });
    describe('progress reporting', () => {
        it('should report every new best ordering, the last one equals the result', () => {
            for (let i = 0; i < 30; i++) {
                const depth = 3 + (i % 5);
                const truthTable = i % 2 === 0 ? randomUnknownTable(depth) : randomTable(depth);
                truthTable.set('0'.repeat(depth), 1);
                const reported: number[] = [];
                const result = findOrdering({
                    truthTable,
                    dontCareValue: i % 2 === 0 ? UNKNOWN : undefined,
                    onImprovement: progress => reported.push(progress.nodeCount)
                });
                assert.ok(reported.length > 0);
                for (let r = 1; r < reported.length; r++) {
                    assert.ok(reported[r] < reported[r - 1]);
                }
                assert.strictEqual(reported[reported.length - 1], result.nodeCount);
            }
        });
    });
    describe('cost objective', () => {
        it('expectedCost should equal the cost measured through resolve()', () => {
            for (let i = 0; i < 20; i++) {
                const depth = 1 + Math.floor(Math.random() * 6);
                const useDontCare = i % 2 === 0;
                const truthTable = useDontCare ? randomUnknownTable(depth) : randomTable(depth);
                truthTable.set('0'.repeat(depth), 1);
                const functionCosts = randomCosts(depth);
                const rowWeight: (key: string, value: number) => number = i % 3 === 0 ? () => 1 : (key: string) => 1 + (parseInt(key, 2) % 5);
                const table = parseTruthTable(truthTable, useDontCare ? UNKNOWN : undefined);
                const costModel = buildCostModel(table, functionCosts, rowWeight);
                const evaluator = new OrderingEvaluator(table, costModel);
                const ordering = shuffleArray(naturalOrdering(depth));
                const evaluation = evaluator.evaluate(ordering);
                const bdd = createBddWithOrdering(truthTable, ordering, useDontCare ? UNKNOWN : undefined);
                const measured = measureExpectedCost(bdd, truthTable, functionCosts, rowWeight, useDontCare ? UNKNOWN : undefined);
                assertClose(evaluation.expectedCost, measured);
            }
        });
        it('ExactCostOrderingSearch should find the optimum of all permutations', () => {
            for (let i = 0; i < 30; i++) {
                const depth = 1 + Math.floor(Math.random() * 6);
                const useDontCare = i % 2 === 0;
                const truthTable = useDontCare ? randomUnknownTable(depth) : randomTable(depth);
                truthTable.set('0'.repeat(depth), 1);
                const functionCosts = randomCosts(depth);
                const rowWeight: (key: string, value: number) => number = i % 3 === 0 ? () => 1 : (key: string) => (parseInt(key, 2) % 3);
                const base = parseTruthTable(truthTable, useDontCare ? UNKNOWN : undefined);
                const completed = new OrderingEvaluator(base).complete(naturalOrdering(depth));
                let costModel: ReturnType<typeof buildCostModel>;
                try {
                    costModel = buildCostModel(completed, functionCosts, (key, value) =>
                        base.terminalIds[parseInt(key, 2)] === base.dontCareTerminal ? 0 : rowWeight(key, value)
                    );
                } catch (err) {
                    // all weights zero
                    continue;
                }
                if (!costModel) {
                    throw new Error('cost model expected');
                }
                const evaluator = new OrderingEvaluator(completed, costModel);
                let optimum = Infinity;
                allPermutations(naturalOrdering(depth)).forEach(permutation => {
                    optimum = Math.min(optimum, evaluator.evaluate(permutation).expectedCost);
                });
                const withoutBound = new ExactCostOrderingSearch(completed, costModel).run();
                assert.ok(withoutBound.solved);
                assert.ok(withoutBound.ordering);
                assertClose(evaluator.evaluate(withoutBound.ordering as number[]).expectedCost, optimum);
                assertClose(withoutBound.expectedCost, optimum);

                const withBound = new ExactCostOrderingSearch(completed, costModel).run({
                    upperBoundOrdering: naturalOrdering(depth).reverse()
                });
                assert.ok(withBound.solved);
                assertClose(evaluator.evaluate(withBound.ordering as number[]).expectedCost, optimum);

                const nothingBetter = new ExactCostOrderingSearch(completed, costModel).run({ upperBound: optimum });
                assert.ok(nothingBetter.solved);
                assert.strictEqual(nothingBetter.ordering, null);
            }
        });
        it('findOrdering() should find the cheapest ordering for small tables', () => {
            for (let i = 0; i < 10; i++) {
                const depth = 1 + Math.floor(Math.random() * 6);
                const truthTable = randomTable(depth);
                const functionCosts = randomCosts(depth);
                const table = parseTruthTable(truthTable);
                const evaluator = new OrderingEvaluator(table, buildCostModel(table, functionCosts));
                let optimum = Infinity;
                allPermutations(naturalOrdering(depth)).forEach(permutation => {
                    optimum = Math.min(optimum, evaluator.evaluate(permutation).expectedCost);
                });
                const result = findOrdering({ truthTable, functionCosts });
                assertClose(result.expectedCost as number, optimum);
                assert.strictEqual(result.optimal, true);
                assert.strictEqual(evaluator.evaluate(result.ordering).nodeCount, result.nodeCount);
            }
        });
        it('should push an expensive boolean function below the level that decides whether it is needed', async () => {
            // f = x1 ? x0 : x2
            const truthTable: TruthTable = new Map();
            for (let row = 0; row < 8; row++) {
                const key = row.toString(2).padStart(3, '0');
                truthTable.set(key, key[1] === '1' ? parseInt(key[0], 10) : parseInt(key[2], 10));
            }
            const result = await optimizeOrdering({ truthTable, functionCosts: [100, 1, 1] });
            assert.strictEqual(result.ordering[0], 1);
            assertClose(result.expectedCost as number, 1 + 100 * 0.5 + 1 * 0.5);
            assert.strictEqual(result.optimal, true);
            assertClose(
                measureExpectedCost(result.bdd, truthTable, [100, 1, 1], () => 1),
                result.expectedCost as number
            );

            // when only rows with x1 = 0 occur, x0 is never needed
            const weighted = await optimizeOrdering({
                truthTable,
                functionCosts: [100, 1, 1],
                rowWeight: key => key[1] === '0' ? 1 : 0
            });
            assertClose(weighted.expectedCost as number, 2);
        });
        it('should ignore don\'t-care rows in the expected cost', async () => {
            const truthTable = randomUnknownTable(6);
            truthTable.set('000000', 1);
            const functionCosts = randomCosts(6);
            const result = await optimizeOrdering({ truthTable, dontCareValue: UNKNOWN, functionCosts });
            ensureCorrectBdd(result.bdd);
            assertResolvesLikeTable(result.bdd, truthTable, UNKNOWN);
            assertClose(
                measureExpectedCost(result.bdd, truthTable, functionCosts, () => 1, UNKNOWN),
                result.expectedCost as number
            );
            const natural = createBddWithOrdering(truthTable, naturalOrdering(6), UNKNOWN);
            assert.ok((result.expectedCost as number) <= measureExpectedCost(natural, truthTable, functionCosts, () => 1, UNKNOWN) + 1e-9);
        });
        it('should be deterministic with costs', () => {
            const truthTable = randomUnknownTable(7);
            truthTable.set('0000000', 1);
            const functionCosts = randomCosts(7);
            const first = findOrdering({ truthTable, dontCareValue: UNKNOWN, functionCosts });
            const second = findOrdering({ truthTable, dontCareValue: UNKNOWN, functionCosts });
            assert.deepStrictEqual(first.ordering, second.ordering);
            assert.strictEqual(first.expectedCost, second.expectedCost);
        });
        it('should find the optimum independent of the unit of the costs', () => {
            for (let i = 0; i < 20; i++) {
                const depth = 3 + (i % 4);
                const truthTable = randomTable(depth);
                // for example seconds instead of milliseconds, with probabilities as weights
                const functionCosts = randomCosts(depth).map(cost => (cost + 1) * 1e-9);
                const rowWeight = (key: string) => (1 + (parseInt(key, 2) % 7)) / 1000;
                const table = parseTruthTable(truthTable);
                const evaluator = new OrderingEvaluator(table, buildCostModel(table, functionCosts, rowWeight));
                let optimum = Infinity;
                allPermutations(naturalOrdering(depth)).forEach(permutation => {
                    optimum = Math.min(optimum, evaluator.evaluate(permutation).expectedCost);
                });
                const result = findOrdering({ truthTable, functionCosts, rowWeight });
                assert.strictEqual(result.optimal, true);
                assertClose((result.expectedCost as number) / optimum, 1);
            }
        });
        it('should validate the cost inputs', () => {
            const truthTable = randomTable(3);
            assert.throws(() => findOrdering({ truthTable, functionCosts: [1, 2] }));
            assert.throws(() => findOrdering({ truthTable, functionCosts: [1, -2, 3] }));
            assert.throws(() => findOrdering({ truthTable, rowWeight: () => 1 }));
            assert.throws(() => findOrdering({ truthTable, functionCosts: [1, 2, 3], rowWeight: () => 0 }));
            assert.strictEqual(findOrdering({ truthTable }).expectedCost, undefined);
        });
    });
});
