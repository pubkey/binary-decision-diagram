import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import {
    exampleTruthTable, allEqualTable, randomTable, UNKNOWN, randomUnknownTable, getResolverFunctions
} from '../helper/test-util';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd';
import { InternalNode, NonRootNode, LeafNode, ResolverFunctions } from '../../src';

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
});
