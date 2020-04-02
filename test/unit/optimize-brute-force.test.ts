import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import {
    exampleTruthTable, allEqualTable, randomTable, UNKNOWN, randomUnknownTable, getResolverFunctions
} from '../helper/test-util';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd';
import { InternalNode, NonRootNode, LeafNode, bddToMinimalString, minimalStringToSimpleBdd, resolveWithSimpleBdd } from '../../src';
import { optimizeBruteForce, CompareResultsFunction } from '../../src/optimize-brute-force';
import { bddToSimpleBdd } from '../../src/minimal-string/bdd-to-simple-bdd';

describe('optimize-brute-force.test.ts', () => {
    it('should return the same values when the order changed', async () => {
        const depth = 8;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        const minimizedBdd = createBddFromTruthTable(truthTable);
        minimizedBdd.minimize();

        // run optimisation until a better bdd is found
        let resortedBdd = minimizedBdd;
        while (resortedBdd.countNodes() === minimizedBdd.countNodes()) {
            const optimizedResult = await optimizeBruteForce({
                truthTable,
                iterations: 1
            });
            resortedBdd = optimizedResult.bdd;
        }
        // console.log(minimizedBdd.countNodes() + '  -  ' + resortedBdd.countNodes());
        const resolvers = getResolverFunctions(depth, false);

        for (const [key, value] of truthTable.entries()) {
            const bddValue = bdd.resolve(resolvers, key);
            const resortedBddValue = resortedBdd.resolve(resolvers, key);
            const minimizedBddValue = minimizedBdd.resolve(resolvers, key);

            if (
                bddValue !== resortedBddValue ||
                bddValue !== value ||
                bddValue !== minimizedBddValue
            ) {
                console.log('value: ' + value);
                console.log('minimizedBdd: ' + minimizedBddValue);
                console.log('resortedBddValue: ' + resortedBddValue);
                console.log('bddValue: ' + bddValue);
                throw new Error('values not equal');
            }
        }
    });
    it('resorted bdds should work with simple bdd', async () => {
        const depth = 7;
        const truthTable = randomTable(depth);
        const bdd = createBddFromTruthTable(truthTable);
        const minimizedBdd = createBddFromTruthTable(truthTable);
        minimizedBdd.minimize();

        // run optimisation until a better bdd is found
        let resortedBdd = minimizedBdd;
        while (resortedBdd.countNodes() === minimizedBdd.countNodes()) {
            const optimizedResult = await optimizeBruteForce({
                truthTable,
                iterations: 1
            });
            resortedBdd = optimizedResult.bdd;
        }

        const simpleBdd = bddToSimpleBdd(resortedBdd);
        const minimalString = bddToMinimalString(resortedBdd);
        const simpleBddFromMinimalString = minimalStringToSimpleBdd(minimalString);

        assert.deepStrictEqual(
            simpleBdd,
            simpleBddFromMinimalString
        );

        const resolvers = getResolverFunctions(depth, false);
        for (const [key, value] of truthTable.entries()) {
            const bddValue = bdd.resolve(resolvers, key);
            const minimizedBddValue = minimizedBdd.resolve(resolvers, key);
            const resortedBddValue = resortedBdd.resolve(resolvers, key);
            const simpleBddValue = resolveWithSimpleBdd(simpleBdd, resolvers, key);

            if (
                bddValue !== simpleBddValue ||
                bddValue !== resortedBddValue ||
                bddValue !== value ||
                bddValue !== minimizedBddValue
            ) {
                console.log('value: ' + value);
                console.log('simpleBddValue: ' + simpleBddValue);
                console.log('minimizedBdd: ' + minimizedBddValue);
                console.log('resortedBddValue: ' + resortedBddValue);
                console.log('bddValue: ' + bddValue);
                throw new Error('values not equal');
            }
        }
    });
    it('compareResults function could be async', async () => {
        const depth = 5;
        const truthTable = randomTable(depth);
        const minimizedBdd = createBddFromTruthTable(truthTable);
        minimizedBdd.minimize();

        const compareResults: CompareResultsFunction = (a, b) => {
            return Promise.resolve(a);
        };

        const optimizedResult = await optimizeBruteForce({
            truthTable,
            iterations: 5,
            compareResults
        });
        assert.ok(optimizedResult.bdd);
    });
});
