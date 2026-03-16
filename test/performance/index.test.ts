import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table.js';
import { bddToMinimalString, minimalStringToSimpleBdd, resolveWithSimpleBdd } from '../../src/minimal-string/index.js';
import { optimizeBruteForce } from '../../src/optimize-brute-force.js';
import {
    randomTable,
    getResolverFunctions
} from '../helper/test-util.js';

describe('performance.test.ts', () => {
    it('should create a BDD from a big truth table', () => {
        const depth = 13;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        const beforeCount = bdd.countNodes();
        bdd.minimize();
        assert.ok(bdd.countNodes() <= beforeCount);
    });
    it('should resolve all values of a big BDD', () => {
        const depth = 11;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        bdd.minimize();
        const resolvers = getResolverFunctions(depth);
        for (const [key] of truthTable.entries()) {
            bdd.resolve(resolvers, key);
        }
    });
    it('should create and resolve with a simple BDD', () => {
        const depth = 11;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        bdd.minimize();

        const minimalString = bddToMinimalString(bdd);
        const simpleBdd = minimalStringToSimpleBdd(minimalString);
        const resolvers = getResolverFunctions(depth);
        for (const [key] of truthTable.entries()) {
            resolveWithSimpleBdd(simpleBdd, resolvers, key);
        }
    });
    it('should run optimizeBruteForce', async () => {
        const depth = 8;
        const truthTable = randomTable(depth);
        const result = await optimizeBruteForce({
            truthTable,
            iterations: 10
        });
        assert.ok(result.bdd);
    });
});
