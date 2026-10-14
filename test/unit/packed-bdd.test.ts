import * as assert from 'assert';
import {
    exampleTruthTable,
    randomTable,
    getResolverFunctions,
    getBigTruthTable,
    UNKNOWN
} from '../helper/test-util.js';
import {
    createBddFromTruthTable,
    bddToPackedBdd,
    resolveWithPackedBdd,
    packedBddToString,
    packedBddFromString,
    PackedBdd,
    TruthTable,
    RootNode
} from '../../src/index.js';

function assertResolvesTable(packedBdd: ArrayLike<number>, table: TruthTable) {
    const keyLength = (table.keys().next().value as string).length;
    const resolvers = getResolverFunctions(keyLength);
    for (const [key, value] of table.entries()) {
        if (value === UNKNOWN) {
            // replaced by removeIrrelevantLeafNodes()
            continue;
        }
        assert.strictEqual(resolveWithPackedBdd(packedBdd, resolvers, key), value, key);
    }
}

describe('packed-bdd.test.ts', () => {
    let bigTable: TruthTable;
    let bigBdd: RootNode;
    before(() => {
        bigTable = getBigTruthTable();
        bigBdd = createBddFromTruthTable(bigTable);
        bigBdd.removeIrrelevantLeafNodes(UNKNOWN);
    });
    describe('.bddToPackedBdd()', () => {
        it('should resolve the same values as the truth table', () => {
            const table = exampleTruthTable(5);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            assertResolvesTable(bddToPackedBdd(bdd), table);
        });
        it('should work with a not minimized bdd', () => {
            const table = randomTable(6);
            const bdd = createBddFromTruthTable(table);
            const packed = bddToPackedBdd(bdd);
            assert.strictEqual(packed.length / 3, bdd.countNodes() - bdd.getLeafNodes().length);
            assertResolvesTable(packed, table);
        });
        it('should work with the big truth table', () => {
            const table = bigTable;
            const bdd = bigBdd;
            const packed = bddToPackedBdd(bdd);
            assertResolvesTable(packed, table);
        });
        it('should use wider arrays when needed', () => {
            const table = exampleTruthTable(5);
            for (const key of table.keys()) {
                table.set(key, table.get(key) as number + 1000);
            }
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            const packed = bddToPackedBdd(bdd);
            assert.ok(packed instanceof Uint16Array);
            assertResolvesTable(packed, table);

            for (const key of table.keys()) {
                table.set(key, table.get(key) as number + 100000);
            }
            const bdd32 = createBddFromTruthTable(table);
            bdd32.minimize();
            const packed32 = bddToPackedBdd(bdd32);
            assert.ok(packed32 instanceof Uint32Array);
            assertResolvesTable(packed32, table);
        });
        it('should be deterministic', () => {
            const table = randomTable(8);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            assert.deepStrictEqual(bddToPackedBdd(bdd), bddToPackedBdd(bdd));
        });
        it('should throw on non-integer leaf values', () => {
            const table = exampleTruthTable(2);
            table.set('00', -1);
            const bdd = createBddFromTruthTable(table);
            assert.throws(() => bddToPackedBdd(bdd));
        });
    });
    describe('.packedBddToString() / .packedBddFromString()', () => {
        it('should round-trip all array widths and lengths', () => {
            const arrays: PackedBdd[] = [];
            for (let length = 3; length <= 12; length += 3) {
                const values = new Array(length).fill(0).map((_x, i) => i * 37 + length);
                arrays.push(Uint8Array.from(values.map(v => v & 0xFF)));
                arrays.push(Uint16Array.from(values.map(v => v * 251)));
                arrays.push(Uint32Array.from(values.map(v => v * 16777259 >>> 0)));
            }
            arrays.push(Uint32Array.from([0xFFFFFFFF, 0, 0x80000000]));
            arrays.forEach(arr => {
                const str = packedBddToString(arr);
                assert.ok(/^[124][A-Za-z0-9+/]*$/.test(str), str);
                const back = packedBddFromString(str);
                assert.strictEqual(back.constructor, arr.constructor);
                assert.deepStrictEqual(Array.from(back), Array.from(arr));
            });
        });
        it('should resolve correctly after the round-trip', () => {
            const table = bigTable;
            const bdd = bigBdd;
            const str = packedBddToString(bddToPackedBdd(bdd));
            assertResolvesTable(packedBddFromString(str), table);
        });
        it('should throw on invalid strings', () => {
            assert.throws(() => packedBddFromString('3AAAA'));
        });
    });
});
