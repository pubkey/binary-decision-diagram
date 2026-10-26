import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table.js';
import { bddToPackedBdd, packedBddToBase64String, packedBddFromBase64String, resolveWithPackedBdd } from '../../src/packed/index.js';
import { optimizeBruteForce } from '../../src/optimize-brute-force.js';
import { optimizeOrdering } from '../../src/ordering/optimize-ordering.js';
import { booleanToBooleanString } from '../../src/util.js';
import {
    randomTable,
    getResolverFunctions
} from '../helper/test-util.js';
import type {
    ResolverFunctions,
    NonLeafNode
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
        for (const [key] of Array.from(truthTable.entries())) {
            bdd.resolve(resolvers, key);
        }
        const elapsed = performance.now() - start;
        console.log(`  resolve all values(depth=${depth}): ${elapsed.toFixed(2)}ms`);
    });
    it('should create and resolve with a packed BDD', () => {
        const depth = 11;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        bdd.minimize();

        const startString = performance.now();
        const packedBddString = packedBddToBase64String(bddToPackedBdd(bdd));
        const stringTime = performance.now() - startString;
        console.log(`  packedBddToBase64String(bddToPackedBdd()) (depth=${depth}): ${stringTime.toFixed(2)}ms`);

        const startParse = performance.now();
        const packedBdd = packedBddFromBase64String(packedBddString);
        const parseTime = performance.now() - startParse;
        console.log(`  packedBddFromBase64String(depth=${depth}): ${parseTime.toFixed(2)}ms`);

        const resolvers = getResolverFunctions(depth);
        const startResolve = performance.now();
        for (const [key] of Array.from(truthTable.entries())) {
            resolveWithPackedBdd(packedBdd, resolvers, key);
        }
        const resolveTime = performance.now() - startResolve;
        console.log(`  resolveWithPackedBdd all values(depth=${depth}): ${resolveTime.toFixed(2)}ms`);
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
    it('should run optimizeOrdering', async () => {
        /**
         * a structured table: the value depends on a few boolean functions,
         * so the ordering matters (uniformly random tables have no good ordering)
         */
        const depth = 12;
        const truthTable: Map<string, number> = new Map();
        for (let row = 0; row < Math.pow(2, depth); row++) {
            const key = row.toString(2).padStart(depth, '0');
            const a = key[0] === '1' && key[7] === '1';
            const b = key[11] === '1' || key[3] === '0';
            const c = key[1] === key[9];
            truthTable.set(key, (a ? 1 : 0) + (b ? 2 : 0) + (c ? 4 : 0) + 1);
        }
        const natural = createBddFromTruthTable(truthTable);
        natural.minimize();

        const start = performance.now();
        const result = await optimizeOrdering({
            truthTable
        });
        const elapsed = performance.now() - start;
        console.log(
            `  optimizeOrdering(depth=${depth}): ${elapsed.toFixed(2)}ms, ` +
            `${natural.countNodes()} -> ${result.nodeCount} nodes, optimal=${result.optimal}, ` +
            `${result.stats.evaluations} evaluations, ${result.stats.exactExpansions} exact expansions`
        );

        assert.ok(result.nodeCount < natural.countNodes());
        assert.ok(result.optimal);
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
    it('resolveWithPackedBdd() vs RootNode.resolve()', () => {
        const depth = 13;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        bdd.minimize();
        const packedBdd = bddToPackedBdd(bdd);
        const resolvers = getResolverFunctions(depth);
        const keys = Array.from(truthTable.keys());
        const rounds = 50;

        // Warmup both paths thoroughly
        for (let w = 0; w < 5; w++) {
            for (const key of keys) {
                bdd.resolve(resolvers, key);
                resolveWithPackedBdd(packedBdd, resolvers, key);
            }
        }

        let bddTotal = 0;
        let packedTotal = 0;
        for (let r = 0; r < rounds; r++) {
            const startBdd = performance.now();
            for (const key of keys) {
                bdd.resolve(resolvers, key);
            }
            bddTotal += performance.now() - startBdd;

            const startPacked = performance.now();
            for (const key of keys) {
                resolveWithPackedBdd(packedBdd, resolvers, key);
            }
            packedTotal += performance.now() - startPacked;
        }

        console.log(`  RootNode.resolve() avg (depth=${depth}, ${rounds} rounds): ${(bddTotal / rounds).toFixed(4)}ms`);
        console.log(`  resolveWithPackedBdd() avg (depth=${depth}, ${rounds} rounds): ${(packedTotal / rounds).toFixed(4)}ms`);

        // Verify correctness: both must return the same values
        for (const key of keys) {
            assert.strictEqual(
                resolveWithPackedBdd(packedBdd, resolvers, key),
                bdd.resolve(resolvers, key)
            );
        }
    });
});
