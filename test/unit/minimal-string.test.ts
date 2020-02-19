import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import {
    exampleTruthTable, allEqualTable, randomTable, UNKNOWN,
    randomUnknownTable, getResolverFunctions, getBigTruthTable
} from '../helper/test-util';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd';
import {
    ResolverFunctions, minimalStringToSimpleBdd,
    bddToMinimalString, resolveWithSimpleBdd,
    SimpleBddInternalNode
} from '../../src';

describe('minimal-string.test.ts', () => {
    describe('.bddToMinimalString()', () => {
        it('should create a string', () => {
            const table = exampleTruthTable();
            const bdd = createBddFromTruthTable(table);
            const str = bddToMinimalString(bdd);
            assert.ok(str.length > 4);
            assert.ok(str.length < 300);
        });
        it('should create the same each time', () => {
            const table = exampleTruthTable();
            const bdd = createBddFromTruthTable(table);
            const str = bddToMinimalString(bdd);
            const str2 = bddToMinimalString(bdd);
            assert.strictEqual(str, str2);
        });
    });
    describe('.minimalStringToSimpleBdd()', () => {
        it('parse the string', () => {
            const table = exampleTruthTable(4);
            const bdd = createBddFromTruthTable(table);
            const str = bddToMinimalString(bdd);
            const minimalBdd = minimalStringToSimpleBdd(str);
            assert.strictEqual(
                minimalBdd[0][0][0][0], 0
            );
            assert.strictEqual(
                minimalBdd[0][0][0][1], 1
            );
            assert.strictEqual(
                (minimalBdd[0][0][0] as SimpleBddInternalNode).l, 3
            );
        });
    });
    describe('.resolveWithSimpleBdd()', () => {
        it('should resolve a value', () => {
            const size = 4;
            const table = exampleTruthTable(size);
            const bdd = createBddFromTruthTable(table);
            const str = bddToMinimalString(bdd);
            const minimalBdd = minimalStringToSimpleBdd(str);
            const resolvers: ResolverFunctions = getResolverFunctions(size);
            const result = resolveWithSimpleBdd(
                minimalBdd,
                resolvers,
                {}
            );
            assert.strictEqual(typeof result, 'number');
        });
        it('should have the same values as the truth table', () => {
            const size = 5;
            const table = exampleTruthTable(size);

            const bigBdd = createBddFromTruthTable(table);
            const minimizedBdd = createBddFromTruthTable(table);
            minimizedBdd.removeIrrelevantLeafNodes(UNKNOWN);

            const str = bddToMinimalString(minimizedBdd);
            const minimalBdd = minimalStringToSimpleBdd(str);
            const resolvers: ResolverFunctions = getResolverFunctions(size);

            for (const [key, value] of table.entries()) {
                if (value === UNKNOWN) {
                    break;
                }
                const simpleBddValue = resolveWithSimpleBdd(
                    minimalBdd,
                    resolvers,
                    key
                );
                const minimalBddValue = minimizedBdd.resolve(resolvers, key);
                const bigBddValue = bigBdd.resolve(resolvers, key);
                if (
                    value !== simpleBddValue ||
                    value !== minimalBddValue ||
                    value !== bigBddValue
                ) {
                    console.log('value: ' + value);
                    console.log('simpleBddValue: ' + simpleBddValue);

                    console.log('minimalBddValue: ' + minimalBddValue);
                    console.log('bigBddValue: ' + bigBddValue);

                    throw new Error('values not equal');
                }
            }
        });
        it('should have the same values with a big truth table', () => {
            const table = getBigTruthTable();
            const bigBdd = createBddFromTruthTable(table);
            const minimizedBdd = createBddFromTruthTable(table);
            minimizedBdd.removeIrrelevantLeafNodes(UNKNOWN);

            const str = bddToMinimalString(minimizedBdd);
            const minimalBdd = minimalStringToSimpleBdd(str);
            const resolvers: ResolverFunctions = getResolverFunctions(17);
            for (const [key, value] of table.entries()) {
                if (value === UNKNOWN) {
                    break;
                }
                const simpleBddValue = resolveWithSimpleBdd(
                    minimalBdd,
                    resolvers,
                    key
                );
                const minimalBddValue = minimizedBdd.resolve(resolvers, key);
                const bigBddValue = bigBdd.resolve(resolvers, key);
                if (
                    value !== simpleBddValue ||
                    value !== minimalBddValue ||
                    value !== bigBddValue
                ) {
                    console.log('key: ' + key);
                    console.log('value: ' + value);
                    console.log('simpleBddValue: ' + simpleBddValue);

                    console.log('minimalBddValue: ' + minimalBddValue);
                    console.log('bigBddValue: ' + bigBddValue);

                    minimizedBdd.log();

                    throw new Error('values not equal');
                }
            }
        });
    });
});
