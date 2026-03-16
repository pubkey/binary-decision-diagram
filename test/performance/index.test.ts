import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table.js';
import { bddToMinimalString, minimalStringToSimpleBdd, resolveWithSimpleBdd } from '../../src/minimal-string/index.js';
import { optimizeBruteForce } from '../../src/optimize-brute-force.js';
import { booleanToBooleanString } from '../../src/util.js';
import {
    randomTable,
    getResolverFunctions
} from '../helper/test-util.js';
import type {
    ResolverFunctions,
    NonLeafNode,
    SimpleBdd,
    SimpleBddLeafNode
} from '../../src/types.js';
import type { AbstractNode } from '../../src/abstract-node.js';

/**
 * Previous implementation of resolve for comparison.
 */
function resolveOld(
    rootNode: any,
    fns: ResolverFunctions,
    booleanFunctionInput: any
): number {
    let currentNode: AbstractNode = rootNode;
    while (true) {
        const booleanResult = fns[currentNode.level](booleanFunctionInput);
        const branchKey = booleanToBooleanString(booleanResult);
        currentNode = (currentNode as NonLeafNode).branches.getBranch(branchKey);
        if (currentNode.isLeafNode()) {
            return currentNode.asLeafNode().value;
        }
    }
}

/**
 * Previous implementation of resolveWithSimpleBdd for comparison.
 */
function resolveWithSimpleBddOld(
    simpleBdd: SimpleBdd,
    fns: ResolverFunctions,
    input: any
): number {
    let currentNode: SimpleBdd | SimpleBddLeafNode = simpleBdd;
    let currentLevel: number = simpleBdd.l;
    while (true) {
        const booleanResult = fns[currentLevel](input);
        const branchKey = booleanToBooleanString(booleanResult);
        currentNode = currentNode[branchKey];
        if (typeof currentNode === 'number' || typeof currentNode === 'string') {
            return currentNode as any;
        } else {
            currentLevel = currentNode.l;
        }
    }
}

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
    it('resolve() optimized vs previous implementation', () => {
        const depth = 13;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        bdd.minimize();
        const resolvers = getResolverFunctions(depth);
        const keys = Array.from(truthTable.keys());
        const rounds = 50;

        // Warmup both paths thoroughly
        for (let w = 0; w < 5; w++) {
            for (const key of keys) {
                bdd.resolve(resolvers, key);
                resolveOld(bdd, resolvers, key);
            }
        }

        let oldTotal = 0;
        let newTotal = 0;
        for (let r = 0; r < rounds; r++) {
            const startOld = performance.now();
            for (const key of keys) {
                resolveOld(bdd, resolvers, key);
            }
            oldTotal += performance.now() - startOld;

            const startNew = performance.now();
            for (const key of keys) {
                bdd.resolve(resolvers, key);
            }
            newTotal += performance.now() - startNew;
        }

        const oldAvg = oldTotal / rounds;
        const newAvg = newTotal / rounds;
        const improvement = ((oldAvg - newAvg) / oldAvg * 100);

        console.log(`  resolve() previous avg (depth=${depth}, ${rounds} rounds): ${oldAvg.toFixed(4)}ms`);
        console.log(`  resolve() optimized avg (depth=${depth}, ${rounds} rounds): ${newAvg.toFixed(4)}ms`);
        console.log(`  resolve() improvement: ${improvement.toFixed(1)}%`);

        // Verify correctness: both must return the same values
        for (const key of keys) {
            assert.strictEqual(bdd.resolve(resolvers, key), resolveOld(bdd, resolvers, key));
        }
    });
    it('resolveWithSimpleBdd() optimized vs previous implementation', () => {
        const depth = 13;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        bdd.minimize();
        const minimalString = bddToMinimalString(bdd);
        const simpleBdd = minimalStringToSimpleBdd(minimalString);
        const resolvers = getResolverFunctions(depth);
        const keys = Array.from(truthTable.keys());
        const rounds = 50;

        // Warmup both paths thoroughly
        for (let w = 0; w < 5; w++) {
            for (const key of keys) {
                resolveWithSimpleBdd(simpleBdd, resolvers, key);
                resolveWithSimpleBddOld(simpleBdd, resolvers, key);
            }
        }

        let oldTotal = 0;
        let newTotal = 0;
        for (let r = 0; r < rounds; r++) {
            const startOld = performance.now();
            for (const key of keys) {
                resolveWithSimpleBddOld(simpleBdd, resolvers, key);
            }
            oldTotal += performance.now() - startOld;

            const startNew = performance.now();
            for (const key of keys) {
                resolveWithSimpleBdd(simpleBdd, resolvers, key);
            }
            newTotal += performance.now() - startNew;
        }

        const oldAvg = oldTotal / rounds;
        const newAvg = newTotal / rounds;
        const improvement = ((oldAvg - newAvg) / oldAvg * 100);

        console.log(`  resolveWithSimpleBdd() previous avg (depth=${depth}, ${rounds} rounds): ${oldAvg.toFixed(4)}ms`);
        console.log(`  resolveWithSimpleBdd() optimized avg (depth=${depth}, ${rounds} rounds): ${newAvg.toFixed(4)}ms`);
        console.log(`  resolveWithSimpleBdd() improvement: ${improvement.toFixed(1)}%`);

        // Verify correctness: both must return the same values
        for (const key of keys) {
            assert.strictEqual(
                resolveWithSimpleBdd(simpleBdd, resolvers, key),
                resolveWithSimpleBddOld(simpleBdd, resolvers, key)
            );
        }
    });
});
