import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import {
    exampleTruthTable, allEqualTable
} from '../helper/test-util';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd';
import { InternalNode } from '../../src';
import { findSimilarNode } from '../../src/find-similar-node';


describe('find-similar-node.test.ts', () => {
    it('should be equal to equal node of other bdd', () => {
        const table = allEqualTable();
        const bdd = createBddFromTruthTable(table);
        const nodes = bdd.getNodesOfLevel(1);
        const first: InternalNode = nodes.values().next().value;

        const bdd2 = createBddFromTruthTable(table);
        const nodes2 = bdd2.getNodesOfLevel(1);
        const first2: InternalNode = nodes2.values().next().value;

        const found = findSimilarNode(
            first,
            [first2]
        );
        assert.ok(found);
    });
    it('should not find itself', () => {
        const table = allEqualTable();
        const bdd = createBddFromTruthTable(table);
        const nodes = bdd.getNodesOfLevel(1);
        const first: InternalNode = nodes.values().next().value;

        const found = findSimilarNode(
            first,
            [first]
        );
        assert.strictEqual(found, null);
    });

    it('should be not be equal to root node', () => {
        const table = allEqualTable();
        const bdd = createBddFromTruthTable(table);
        const nodes = bdd.getNodesOfLevel(1);
        const first: InternalNode = nodes.values().next().value;

        const found = findSimilarNode(
            first,
            [bdd as any]
        );
        assert.strictEqual(found, null);
    });
});
