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
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd.js';
import {
    optimizeOrdering,
    findOrdering,
    createBddWithOrdering,
    parseTruthTable,
    OrderingEvaluator,
    ExactOrderingSearch,
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
                const truthTable = randomTable(depth);
                const table = parseTruthTable(truthTable);
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
        it('should return a completed truth table in the original key order', () => {
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
            const truthTable = randomTable(6);
            let improvements = 0;
            let hookCalled = false;
            const result = await optimizeOrdering({
                truthTable,
                onImprovement: () => improvements++,
                afterBddCreation: () => hookCalled = true
            });
            assert.ok(result.bdd);
            assert.ok(hookCalled);
            assert.ok(improvements >= 0);
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
});
