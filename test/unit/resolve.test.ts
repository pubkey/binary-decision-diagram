import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table.js';
import {
    exampleTruthTable, allEqualTable, randomTable, UNKNOWN, randomUnknownTable, getResolverFunctions
} from '../helper/test-util.js';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd.js';
import { InternalNode, NonRootNode, LeafNode, ResolverFunctions, bddToPackedBdd, resolveWithPackedBdd } from '../../src/index.js';

describe('resolve.test.ts', () => {
    it('should have the same values as the truth table', () => {
        const size = 8;
        const table = exampleTruthTable(size);
        const bdd = createBddFromTruthTable(table);
        const resolvers: ResolverFunctions = getResolverFunctions(size);

        for (const [key, value] of table.entries()) {
            const bddValue = bdd.resolve(resolvers, key);
            assert.strictEqual(value, bddValue);
        }
    });
    it('should have the same values after minimize', () => {
        const size = 8;
        const table = exampleTruthTable(size);
        const bdd = createBddFromTruthTable(table);
        const resolvers: ResolverFunctions = getResolverFunctions(size);

        bdd.minimize();
        for (const [key, value] of table.entries()) {
            const bddValue = bdd.resolve(resolvers, key);
            assert.strictEqual(value, bddValue);
        }
    });
    it('should work with minimized random table', () => {
        const size = 8;
        const table = randomTable(size);
        const bdd = createBddFromTruthTable(table);
        const resolvers: ResolverFunctions = getResolverFunctions(size);

        bdd.minimize();
        for (const [key, value] of table.entries()) {
            const bddValue = bdd.resolve(resolvers, key);
            assert.strictEqual(value, bddValue);
        }
    });
    it('bdd and packed bdd should resolve to the same value', () => {
        const depth = 7;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        const minimizedBdd = createBddFromTruthTable(truthTable);
        minimizedBdd.minimize();

        const packedBdd = bddToPackedBdd(minimizedBdd);
        const resolvers = getResolverFunctions(depth, false);

        for (const [key, value] of truthTable.entries()) {
            const bddValue = bdd.resolve(resolvers, key);
            const minimizedBddValue = minimizedBdd.resolve(resolvers, key);
            const packedBddValue = resolveWithPackedBdd(packedBdd, resolvers, key);

            if (
                bddValue !== packedBddValue ||
                bddValue !== value ||
                bddValue !== minimizedBddValue
            ) {
                console.log('value: ' + value);
                console.log('packedBddValue: ' + packedBddValue);
                console.log('minimizedBdd: ' + minimizedBddValue);
                console.log('bddValue: ' + bddValue);
                throw new Error('values not equal');
            }
        }
    });
    it('should resolve correct values when the bdd is changed after a resolve()', () => {
        const size = 6;
        const table = randomUnknownTable(size);
        const bdd = createBddFromTruthTable(table);
        const resolvers: ResolverFunctions = getResolverFunctions(size);

        // resolve once so the compiled data is cached
        for (const [key, value] of table.entries()) {
            assert.strictEqual(bdd.resolve(resolvers, key), value);
        }

        bdd.minimize();
        for (const [key, value] of table.entries()) {
            assert.strictEqual(bdd.resolve(resolvers, key), value);
        }

        // changing a leaf value must be reflected without any branch change
        const leafNode = bdd.getLeafNodes()[0];
        leafNode.value = 1000;
        assert.ok(
            Array.from(table.keys()).some(key => bdd.resolve(resolvers, key) === 1000)
        );

        // changing a branch must invalidate the cached data
        const newLeafNode = new LeafNode(size, bdd, 2000, bdd);
        bdd.branches.setBranch('0', newLeafNode);
        for (const key of table.keys()) {
            if (key.startsWith('0')) {
                assert.strictEqual(bdd.resolve(resolvers, key), 2000);
            }
        }
    });
});
