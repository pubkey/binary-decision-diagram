import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import { bddToMinimalRepresentation, resolveWithMinimalRepresentation } from '../../src/minimal-representation';
import {
    exampleTruthTable,
    randomTable,
    UNKNOWN,
    getResolverFunctions,
    getBigTruthTable
} from '../helper/test-util';
import {
    ResolverFunctions
} from '../../src';

describe('minimal-representation.test.ts', () => {
    describe('.bddToMinimalRepresentation()', () => {
        it('should create a correct representation', () => {
            const table = randomTable(3);
            const bdd = createBddFromTruthTable(table);
            const minimal = bddToMinimalRepresentation(bdd);

            assert.ok(minimal);
            assert.ok(minimal.length > 5);
            minimal.forEach(nr => {
                assert.strictEqual(typeof nr, 'number');
            });

            const entrypoint = minimal.pop() as number;
            /* const maxValue = */ minimal.pop();
            const maxLevel = minimal.pop() as number;

            assert.ok(entrypoint > 0);
            assert.strictEqual(maxLevel, 3);
        });
    });
    describe('RootNode.toMinimalRepresentation()', () => {
        const table = randomTable(3);
        const bdd = createBddFromTruthTable(table);
        const minimal = bdd.toMinimalRepresentation();
        assert.ok(minimal);
    });
    describe('.resolveWithMinimalRepresentation()', () => {
        it('should resolve a value', () => {
            const size = 3;
            const table = randomTable(size);
            const bdd = createBddFromTruthTable(table);
            const minimal = bddToMinimalRepresentation(bdd);
            const resolvers: ResolverFunctions = getResolverFunctions(size, true);

            const result = resolveWithMinimalRepresentation(
                minimal,
                resolvers,
                table.keys().next().value
            );
            assert.strictEqual(typeof result, 'number');
        });
        it('should have the same values as the truth table', () => {
            const size = 3;
            const table = exampleTruthTable(size);

            const bigBdd = createBddFromTruthTable(table);
            const minimizedBdd = createBddFromTruthTable(table);
            minimizedBdd.removeIrrelevantLeafNodes(UNKNOWN);

            const minimal = bddToMinimalRepresentation(bigBdd);
            const resolvers: ResolverFunctions = getResolverFunctions(size);

            for (const [key, value] of table.entries()) {
                if (value === UNKNOWN) {
                    break;
                }
                const minimalRepresentationValue = resolveWithMinimalRepresentation(
                    minimal,
                    resolvers,
                    key
                );
                const minimizedBddValue = minimizedBdd.resolve(resolvers, key);
                const bigBddValue = bigBdd.resolve(resolvers, key);
                if (
                    value !== minimalRepresentationValue ||
                    value !== minimizedBddValue ||
                    value !== bigBddValue
                ) {
                    console.error('#'.repeat(30));
                    console.log('value: ' + value);
                    console.log('minimalRepresentationValue: ' + minimalRepresentationValue);

                    console.log('minimalBddValue: ' + minimizedBddValue);
                    console.log('bigBddValue: ' + bigBddValue);

                    throw new Error('values not equal');
                }
            }
        });
        /*
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
        });    */
    });
});
