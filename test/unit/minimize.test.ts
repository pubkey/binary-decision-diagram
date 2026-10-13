import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table.js';
import {
    exampleTruthTable, allEqualTable, randomTable, UNKNOWN, randomUnknownTable, getResolverFunctions
} from '../helper/test-util.js';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd.js';
import {
    InternalNode,
    NonRootNode,
    LeafNode,
    RootNode,
    AbstractNode,
    TruthTable,
    changeKeyOrder,
    lastOfArray,
    optimizeBruteForce,
    bddToMinimalString,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from '../../src/index.js';

/**
 * Fails when the bdd still contains a node that the reduction rule
 * or the elimination rule could remove.
 */
function assertFullyReduced(bdd: RootNode) {
    bdd.getLevels().forEach(level => {
        const nodes = bdd.getNodesOfLevel(level);
        nodes.forEach((node, index) => {
            if (node.isInternalNode()) {
                assert.ok(
                    !node.asInternalNode().branches.hasEqualBranches(),
                    'node ' + node.id + ' on level ' + level + ' has two equal branches'
                );
            }
            for (let other = index + 1; other < nodes.length; other++) {
                assert.ok(
                    !node.isEqualToOtherNode(nodes[other]),
                    'nodes ' + node.id + ' and ' + nodes[other].id + ' on level ' + level + ' are equal'
                );
            }
        });
    });
}

/**
 * Builds the bdd of a truth table with the boolean functions in another order,
 * exactly like optimizeBruteForce() does it: the keys are re-sorted, the tree is
 * built and the levels of the nodes are renamed to the original indexes of the
 * boolean functions. ordering[level] is the index of the boolean function
 * that is tested on that level.
 */
function createBddWithRelabeledLevels(truthTable: TruthTable, ordering: number[]): RootNode {
    const shuffled: number[] = new Array(ordering.length);
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
    return bdd;
}

describe('minimize.test.ts', () => {
    describe('applyReductionRule()', () => {
        it('should remove itself', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes: NonRootNode[] = bdd.getNodesOfLevel(2);
            const first: InternalNode = nodes[0] as InternalNode;
            ensureCorrectBdd(bdd);
            first.applyReductionRule();
            ensureCorrectBdd(bdd);
            assert.ok(
                (bdd as any).branches.getBranch('0').branches.getBranch('0').isLeafNode()
            );
            const second: InternalNode = nodes[1] as InternalNode;
            second.applyReductionRule();
            assert.ok(
                (bdd as any).branches.getBranch('0').branches.getBranch('1').isLeafNode()
            );
            ensureCorrectBdd(bdd);
        });
        it('should work on deeper bdd itself', () => {
            const table = allEqualTable(4);
            const bdd = createBddFromTruthTable(table);
            const nodes: NonRootNode[] = bdd.getNodesOfLevel(2);
            const first: InternalNode = nodes[0] as InternalNode;
            ensureCorrectBdd(bdd);
            first.applyReductionRule();
            ensureCorrectBdd(bdd);
            assert.ok(
                (bdd as any)
                    .branches.getBranch('0')
                    .branches.getBranch('0')
                    .branches.getBranch('0').isLeafNode()
            );
        });
    });
    describe('applyEliminationRule()', () => {
        it('should remove the found one', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            let nodes: NonRootNode[] = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes[0] as InternalNode;
            first.applyEliminationRule();
            ensureCorrectBdd(bdd);
            assert.strictEqual(
                bdd.branches.getBranch('0').id,
                bdd.branches.getBranch('1').id
            );

            nodes = bdd.getNodesOfLevel(1);
            const second: InternalNode = nodes[0] as InternalNode;
            second.applyEliminationRule();
            ensureCorrectBdd(bdd);
        });
    });
    describe('minimize()', () => {
        it('should also reduce nodes whose level is 0 (levels renamed like optimizeBruteForce() does it)', () => {
            /**
             * After optimizeBruteForce() renames the levels, the nodes that test
             * boolean function 0 carry the level 0 while sitting below the root.
             * minimize() skipped level 0 and left those nodes unreduced.
             */
            const rows: [string, number][] = [
                ['0000', 2], ['0001', 2], ['0010', 1], ['0011', 1],
                ['0100', 2], ['0101', 1], ['0110', 1], ['0111', 1],
                ['1000', 2], ['1001', 1], ['1010', 1], ['1011', 2],
                ['1100', 1], ['1101', 1], ['1110', 1], ['1111', 1]
            ];
            const truthTable: TruthTable = new Map(rows);
            // boolean function 0 is tested on the lowest level
            const ordering = [1, 2, 3, 0];
            const bdd = createBddWithRelabeledLevels(truthTable, ordering);
            bdd.minimize();
            ensureCorrectBdd(bdd);
            assertFullyReduced(bdd);
            // the amount of nodes of the reduced bdd does not depend on how the levels are named
            const reference = createBddFromTruthTable(
                new Map(Array.from(truthTable.entries()).map(([key, value]) => [
                    ordering.map(variable => key[variable]).join(''),
                    value
                ]))
            );
            reference.minimize();
            assert.strictEqual(reference.countNodes(), 10);
            assert.strictEqual(bdd.countNodes(), reference.countNodes());
            const resolvers = getResolverFunctions(4);
            for (const [key, value] of truthTable.entries()) {
                assert.strictEqual(bdd.resolve(resolvers, key), value);
            }
        });
        it('should fully reduce random bdds with renamed levels', () => {
            for (let i = 0; i < 20; i++) {
                const depth = 2 + Math.floor(Math.random() * 5);
                const truthTable = randomTable(depth);
                const ordering: number[] = [];
                for (let v = depth - 1; v >= 0; v--) {
                    ordering.push(v);
                }
                const bdd = createBddWithRelabeledLevels(truthTable, ordering);
                bdd.minimize();
                ensureCorrectBdd(bdd);
                assertFullyReduced(bdd);
            }
        });
        it('should return a minimized version', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            bdd.minimize(false);
            assert.ok((bdd as any).branches.getBranch('0').isLeafNode());
            assert.ok((bdd as any).branches.getBranch('1').isLeafNode());
            ensureCorrectBdd(bdd);
        });
        it('should not crash on random table', () => {
            const table = exampleTruthTable();
            table.set('000', 1);
            table.set('001', 1);
            table.set('010', 1);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            assert.ok((bdd as any).branches.getBranch('0').branches.getBranch('0').isLeafNode());
            ensureCorrectBdd(bdd);
        });
        it('should not crash on a really big table', () => {
            const depth = 11;
            const table = randomTable(depth);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            ensureCorrectBdd(bdd);
        });
        it('random table should not have two equal branches', () => {
            const depth = 9;
            const table = randomTable(depth);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            ensureCorrectBdd(bdd);
            const leafNodes: LeafNode[] = bdd.getNodesOfLevel(depth) as LeafNode[];
            leafNodes.forEach(leaf => {
                const parents = leaf.parents.getAll();
                parents.forEach(parent => {
                    assert.notStrictEqual(
                        (parent.branches.getBranch('0') as LeafNode).value,
                        (parent.branches.getBranch('1') as LeafNode).value
                    );
                });
            });
        });
    });
    describe('countNodes()', () => {
        it('should be smaller after minimize', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const before = bdd.countNodes();
            bdd.minimize();
            const after = bdd.countNodes();
            assert.ok(before > after);
        });
    });
    describe('.removeIrrelevantLeafNodes()', () => {
        it('should not leave a deleted node reachable when the root node points to the same node twice', () => {
            /**
             * The whole 1-branch of the root is irrelevant, so it collapses into the
             * 0-branch and the root points to the same node in both branches. When that
             * node is reduced, both branches of the root must be rewired, not just the first.
             */
            const truthTable: TruthTable = new Map([
                ['00', UNKNOWN],
                ['01', 1],
                ['10', UNKNOWN],
                ['11', UNKNOWN]
            ]);
            const bdd = createBddFromTruthTable(truthTable);
            bdd.removeIrrelevantLeafNodes(UNKNOWN);
            bdd.minimize();
            ensureCorrectBdd(bdd);
            assert.strictEqual(bdd.countNodes(), 2);
            const minimalString = bddToMinimalString(bdd);
            assert.ok(!minimalString.includes('undefined'));
            const simpleBdd = minimalStringToSimpleBdd(minimalString);
            const resolvers = getResolverFunctions(2);
            for (const key of truthTable.keys()) {
                assert.strictEqual(bdd.resolve(resolvers, key), 1);
                assert.strictEqual(resolveWithSimpleBdd(simpleBdd, resolvers, key), 1);
            }
        });
        it('should work through the afterBddCreation hook of optimizeBruteForce()', async () => {
            const truthTable: TruthTable = new Map([
                ['00', UNKNOWN],
                ['01', 1],
                ['10', UNKNOWN],
                ['11', UNKNOWN]
            ]);
            const result = await optimizeBruteForce({
                truthTable,
                iterations: 0,
                afterBddCreation: bdd => bdd.removeIrrelevantLeafNodes(UNKNOWN)
            });
            ensureCorrectBdd(result.bdd);
            const minimalString = bddToMinimalString(result.bdd);
            assert.ok(!minimalString.includes('undefined'));
            assert.strictEqual(result.bdd.resolve(getResolverFunctions(2), '01'), 1);
        });
        it('should produce correct bdds for random tables with irrelevant values', async () => {
            for (let i = 0; i < 40; i++) {
                const depth = 2 + Math.floor(Math.random() * 5);
                const truthTable = randomUnknownTable(depth);
                truthTable.set('0'.repeat(depth), 1);
                const result = await optimizeBruteForce({
                    truthTable,
                    iterations: 1,
                    afterBddCreation: bdd => bdd.removeIrrelevantLeafNodes(UNKNOWN)
                });
                ensureCorrectBdd(result.bdd);
                assertFullyReduced(result.bdd);
                const minimalString = bddToMinimalString(result.bdd);
                assert.ok(!minimalString.includes('undefined'));
                const simpleBdd = minimalStringToSimpleBdd(minimalString);
                const resolvers = getResolverFunctions(depth);
                for (const [key, value] of truthTable.entries()) {
                    if (value !== UNKNOWN) {
                        assert.strictEqual(result.bdd.resolve(resolvers, key), value);
                        assert.strictEqual(resolveWithSimpleBdd(simpleBdd, resolvers, key), value);
                    }
                }
            }
        });
        it('should remove all irrelevant nodes', () => {
            const table = exampleTruthTable(5);
            table.set('00001', UNKNOWN);
            table.set('00000', UNKNOWN);
            table.set('00101', UNKNOWN);
            const bdd = createBddFromTruthTable(table);
            bdd.removeIrrelevantLeafNodes(UNKNOWN);
            bdd.getLeafNodes().forEach(node => {
                assert.notStrictEqual(
                    UNKNOWN,
                    node.value
                );
            });
        });
        it('should work on a big table', () => {
            const table = randomUnknownTable(6);
            const bdd = createBddFromTruthTable(table);
            bdd.removeIrrelevantLeafNodes(UNKNOWN);
            bdd.getLeafNodes().forEach(node => {
                assert.notStrictEqual(
                    UNKNOWN,
                    node.value
                );
            });
        });
    });
});
