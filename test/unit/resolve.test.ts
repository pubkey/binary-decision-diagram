import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import {
    exampleTruthTable, allEqualTable, randomTable, UNKNOWN, randomUnknownTable, getResolverFunctions
} from '../helper/test-util';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd';
import { InternalNode, NonRootNode, LeafNode, ResolverFunctions, resolveWithSimpleBdd } from '../../src';
import { bddToSimpleBdd } from '../../src/minimal-string/bdd-to-simple-bdd';

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
    it('bdd and simplebdd should resolve to the same value', () => {
        const depth = 7;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        const minimizedBdd = createBddFromTruthTable(truthTable);
        minimizedBdd.minimize();

        const simpleBdd = bddToSimpleBdd(minimizedBdd);
        const resolvers = getResolverFunctions(depth, false);

        for (const [key, value] of truthTable.entries()) {
            const bddValue = bdd.resolve(resolvers, key);
            const minimizedBddValue = minimizedBdd.resolve(resolvers, key);
            const simpleBddValue = resolveWithSimpleBdd(simpleBdd, resolvers, key);

            if (
                bddValue !== simpleBddValue ||
                bddValue !== value ||
                bddValue !== minimizedBddValue
            ) {
                console.log('value: ' + value);
                console.log('simpleBddValue: ' + simpleBddValue);
                console.log('minimizedBdd: ' + minimizedBddValue);
                console.log('bddValue: ' + bddValue);
                throw new Error('values not equal');
            }
        }
    });
});
