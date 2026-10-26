import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table.js';
import { randomUnknownTable, UNKNOWN, getResolverFunctions } from '../helper/test-util.js';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd.js';
import {
    TruthTable,
    optimizeBruteForce,
    bddToPackedBdd,
    resolveWithPackedBdd
} from '../../src/index.js';

/**
 * The root node can hold the same node in both branches, which
 * removeIrrelevantLeafNodes() produces whenever one half of the tree is
 * entirely irrelevant. When that node is reduced, the reduction rule and the
 * elimination rule rewired only the first branch of the root, deleted the node
 * anyway and left the other branch pointing to the deleted node.
 */
describe('reduction-both-branches.test.ts', () => {
    it('should not leave a deleted node reachable when the root node points to the same node twice', () => {
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
        // packing walks every branch and throws on a missing one
        const packedBdd = bddToPackedBdd(bdd);
        const resolvers = getResolverFunctions(2);
        for (const key of Array.from(truthTable.keys())) {
            assert.strictEqual(bdd.resolve(resolvers, key), 1);
            assert.strictEqual(resolveWithPackedBdd(packedBdd, resolvers, key), 1);
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
        // packing walks every branch and throws on a missing one
        bddToPackedBdd(result.bdd);
        assert.strictEqual(result.bdd.resolve(getResolverFunctions(2), '01'), 1);
    });
    it('should produce correct bdds for random tables with irrelevant values', async () => {
        for (let i = 0; i < 40; i++) {
            const depth = 2 + Math.floor(Math.random() * 5);
            const truthTable = randomUnknownTable(depth);
            truthTable.set('0'.repeat(depth), 1);
            const result = await optimizeBruteForce({
                truthTable,
                iterations: 0,
                afterBddCreation: bdd => bdd.removeIrrelevantLeafNodes(UNKNOWN)
            });
            ensureCorrectBdd(result.bdd);
            // packing walks every branch and throws on a missing one
            const packedBdd = bddToPackedBdd(result.bdd);
            const resolvers = getResolverFunctions(depth);
            for (const [key, value] of Array.from(truthTable.entries())) {
                if (value !== UNKNOWN) {
                    assert.strictEqual(result.bdd.resolve(resolvers, key), value);
                    assert.strictEqual(resolveWithPackedBdd(packedBdd, resolvers, key), value);
                }
            }
        }
    });
});
