import * as assert from 'assert';
import {
    TruthTable,
    ResolverFunctions,
    RootNode,
    createBddFromTruthTable,
    bddToMinimalString,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from '../../src/index.js';

/**
 * The minimal string stores each leaf value as a single character.
 * Values that do not fit into one character were written anyway and
 * came back as a different number after parsing the string.
 */
describe('minimal-string-values.test.ts', () => {
    const resolvers: ResolverFunctions<string> = {
        0: (key) => key === '1'
    };
    function createBdd(value: number): RootNode {
        const truthTable: TruthTable = new Map([
            ['0', 7],
            ['1', value]
        ]);
        const bdd = createBddFromTruthTable(truthTable);
        bdd.minimize();
        return bdd;
    }

    it('should keep the leaf values it can encode', () => {
        for (const value of [-40, -1, 0, 1, 100, 65495]) {
            const simpleBdd = minimalStringToSimpleBdd(bddToMinimalString(createBdd(value)));
            assert.strictEqual(resolveWithSimpleBdd(simpleBdd, resolvers, '0'), 7);
            assert.strictEqual(resolveWithSimpleBdd(simpleBdd, resolvers, '1'), value);
        }
    });
    it('should not silently change the leaf values it cannot encode', () => {
        for (const value of [-41, -1000, 0.5, 65496, 100000]) {
            const bdd = createBdd(value);
            let minimalString: string;
            try {
                minimalString = bddToMinimalString(bdd);
            } catch (err) {
                // refusing to encode the value is fine, changing it is not
                assert.ok((err as Error).message.includes('leaf value'), (err as Error).message);
                continue;
            }
            const simpleBdd = minimalStringToSimpleBdd(minimalString);
            assert.strictEqual(resolveWithSimpleBdd(simpleBdd, resolvers, '1'), value);
        }
    });
});
