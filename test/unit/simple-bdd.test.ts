import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import { bddToSimpleBdd } from '../../src/minimal-string/bdd-to-simple-bdd';
import {
    exampleTruthTable,
    randomTable,
    UNKNOWN,
    getResolverFunctions,
    getBigTruthTable
} from '../helper/test-util';
import {
    ResolverFunctions,
    minimalStringToSimpleBdd,
    bddToMinimalString,
    resolveWithSimpleBdd,
    SimpleBdd
} from '../../src';

describe('simple-bdd.test.ts', () => {
    describe('.bddToSimpleBdd()', () => {
        it('should create a correct simple bdd', () => {
            const table = randomTable(3);
            const bdd = createBddFromTruthTable(table);
            const simpleBdd = bddToSimpleBdd(bdd);
            const v1 = bdd
                .branches.getBranch('0').asInternalNode()
                .branches.getBranch('0').asInternalNode()
                .branches.getBranch('0').asLeafNode().value;
            const v2: any = (simpleBdd as any)[0][0][0];
            assert.strictEqual(
                v1, v2
            );
        });
    });
    describe('RootNode.toSimpleBdd()', () => {
        const table = randomTable(3);
        const bdd = createBddFromTruthTable(table);
        const simpleBdd = bdd.toSimpleBdd();
        const v1 = bdd
            .branches.getBranch('0').asInternalNode()
            .branches.getBranch('0').asInternalNode()
            .branches.getBranch('0').asLeafNode().value;
        const v2 = (simpleBdd as any)[0][0][0];
        assert.strictEqual(
            v1, v2
        );
    });
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
                (minimalBdd as any)[0][0][0][0], 0
            );
            assert.strictEqual(
                (minimalBdd as any)[0][0][0][1], 1
            );
            assert.strictEqual(
                (minimalBdd as any)[0][0][0].l, 3
            );
        });
        it('should be equal to the generated simple bdd', () => {
            const table = randomTable(6);
            const bdd = createBddFromTruthTable(table);
            const str = bddToMinimalString(bdd);
            const minimalBdd = minimalStringToSimpleBdd(str);
            const simpleBdd = bddToSimpleBdd(bdd);
            assert.deepStrictEqual(
                minimalBdd,
                simpleBdd
            );
        });
    });
    describe('.resolveWithSimpleBdd()', () => {
        it('should resolve a value', () => {
            const size = 5;
            const table = randomTable(size);
            const bdd = createBddFromTruthTable(table);
            const str = bddToMinimalString(bdd);
            const minimalBdd = minimalStringToSimpleBdd(str);
            const resolvers: ResolverFunctions = getResolverFunctions(size);

            const result = resolveWithSimpleBdd(
                minimalBdd,
                resolvers,
                table.keys().next().value
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
