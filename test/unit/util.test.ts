import * as assert from 'assert';
import {
    decimalToPaddedBinary,
    getNextStateSet
} from '../../src/index.js';

describe('util.test.ts', () => {
    describe('decimalToPaddedBinary()', () => {
        it('should not truncate numbers that need more than 32 bits', () => {
            assert.strictEqual(
                decimalToPaddedBinary(Math.pow(2, 32), 33),
                '1' + '0'.repeat(32)
            );
            assert.strictEqual(
                decimalToPaddedBinary(Math.pow(2, 40) + 5, 41),
                '1' + '0'.repeat(37) + '101'
            );
        });
    });
    describe('getNextStateSet()', () => {
        it('should return the next state set for keys with more than 32 characters', () => {
            assert.strictEqual(
                getNextStateSet('0' + '1'.repeat(32)),
                '1' + '0'.repeat(32)
            );
            assert.strictEqual(
                getNextStateSet('1'.repeat(33) + '0'),
                '1'.repeat(34)
            );
        });
        it('should return the next state set for keys with more than 53 characters', () => {
            assert.strictEqual(
                getNextStateSet('1' + '0'.repeat(59)),
                '1' + '0'.repeat(58) + '1'
            );
        });
    });
});
