import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import {
    exampleTruthTable, allEqualTable, randomTable, UNKNOWN, randomUnknownTable
} from '../helper/test-util';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd';
import { InternalNode, NonRootNode, LeafNode } from '../../src';
import { optimizeBruteForce } from '../../src/optimize-brute-force';

describe('optimize-brute-force.test.ts', () => {
    it('should return the same values when the order changed', () => {
        const depth = 5;
        const table = randomTable(depth);
        const bdd = createBddFromTruthTable(table);
        const resortedBdd = optimizeBruteForce({

        });
    });
});
