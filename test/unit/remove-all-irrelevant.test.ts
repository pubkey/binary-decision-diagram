import * as assert from 'assert';
import { getResolverFunctions } from '../helper/test-util.js';
import {
    createBddFromTruthTable,
    ensureCorrectBdd,
    getNodesRecursive,
    TruthTable
} from '../../src/index.js';

/**
 * When all rows have the irrelevant value, the root node points to the same leaf
 * with both branches and there is no other branch that could replace the leaf.
 * removeIrrelevantLeafNodes() deleted the leaf anyway, so the root node pointed
 * to a deleted node and countNodes() did not count it.
 */
describe('remove-all-irrelevant.test.ts', () => {
    [1, 3].forEach(depth => {
        [false, true].forEach(minimizeFirst => {
            it('should keep a valid BDD when all ' + Math.pow(2, depth) + ' rows are irrelevant' +
                (minimizeFirst ? ' (minimized first)' : ''), () => {
                const truthTable: TruthTable = new Map();
                for (let row = 0; row < Math.pow(2, depth); row++) {
                    truthTable.set(row.toString(2).padStart(depth, '0'), 5);
                }
                const bdd = createBddFromTruthTable(truthTable);
                if (minimizeFirst) {
                    bdd.minimize();
                }
                bdd.removeIrrelevantLeafNodes(5);

                ensureCorrectBdd(bdd);
                assert.strictEqual(bdd.countNodes(), getNodesRecursive(bdd).size);
                assert.strictEqual(bdd.getLeafNodes().length, 1);
                const resolvers = getResolverFunctions(depth);
                for (const key of truthTable.keys()) {
                    assert.strictEqual(bdd.resolve(resolvers, key), 5);
                }
            });
        });
    });
});
