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

        const startCreate = performance.now();
        const bdd = createBddFromTruthTable(truthTable);
        const createTime = performance.now() - startCreate;
        console.log(`  createBddFromTruthTable(depth=${depth}): ${createTime.toFixed(2)}ms`);

        const beforeCount = bdd.countNodes();
        const startMinimize = performance.now();
        bdd.minimize();
        const minimizeTime = performance.now() - startMinimize;
        console.log(`  minimize(depth=${depth}): ${minimizeTime.toFixed(2)}ms`);

        assert.ok(bdd.countNodes() <= beforeCount);
    });
    it('should resolve all values of a big BDD', () => {
        const depth = 11;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        bdd.minimize();
        const resolvers = getResolverFunctions(depth);

        const start = performance.now();
        for (const [key] of truthTable.entries()) {
            bdd.resolve(resolvers, key);
        }
        const elapsed = performance.now() - start;
        console.log(`  resolve all values(depth=${depth}): ${elapsed.toFixed(2)}ms`);
    });
    it('should create and resolve with a simple BDD', () => {
        const depth = 11;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        bdd.minimize();

        const startString = performance.now();
        const minimalString = bddToMinimalString(bdd);
        const stringTime = performance.now() - startString;
        console.log(`  bddToMinimalString(depth=${depth}): ${stringTime.toFixed(2)}ms`);

        const startParse = performance.now();
        const simpleBdd = minimalStringToSimpleBdd(minimalString);
        const parseTime = performance.now() - startParse;
        console.log(`  minimalStringToSimpleBdd(depth=${depth}): ${parseTime.toFixed(2)}ms`);

        const resolvers = getResolverFunctions(depth);
        const startResolve = performance.now();
        for (const [key] of truthTable.entries()) {
            resolveWithSimpleBdd(simpleBdd, resolvers, key);
        }
        const resolveTime = performance.now() - startResolve;
        console.log(`  resolveWithSimpleBdd all values(depth=${depth}): ${resolveTime.toFixed(2)}ms`);
    });
    it('should run optimizeBruteForce', async () => {
        const depth = 8;
        const iterations = 10;
        const truthTable = randomTable(depth);

        const start = performance.now();
        const result = await optimizeBruteForce({
            truthTable,
            iterations
        });
        const elapsed = performance.now() - start;
        console.log(`  optimizeBruteForce(depth=${depth}, iterations=${iterations}): ${elapsed.toFixed(2)}ms`);

        assert.ok(result.bdd);
    });
});
