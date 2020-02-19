import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import {
    exampleTruthTable, allEqualTable, randomTable, UNKNOWN, randomUnknownTable
} from '../helper/test-util';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd';
import { InternalNode, NonRootNode, LeafNode } from '../../src';

describe('minimize.test.ts', () => {
    describe('applyReductionRule()', () => {
        it('should remove itself', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes: NonRootNode[] = bdd.getNodesOfLevel(2);
            const first: InternalNode = nodes[0] as InternalNode;
            ensureCorrectBdd(bdd);
            first.applyReductionRule();
            ensureCorrectBdd(bdd);
            assert.ok(
                (bdd as any).branches.getBranch('0').branches.getBranch('0').isLeafNode()
            );
            const second: InternalNode = nodes[1] as InternalNode;
            second.applyReductionRule();
            assert.ok(
                (bdd as any).branches.getBranch('0').branches.getBranch('1').isLeafNode()
            );
            ensureCorrectBdd(bdd);
        });
        it('should work on deeper bdd itself', () => {
            const table = allEqualTable(4);
            const bdd = createBddFromTruthTable(table);
            const nodes: NonRootNode[] = bdd.getNodesOfLevel(2);
            const first: InternalNode = nodes[0] as InternalNode;
            ensureCorrectBdd(bdd);
            first.applyReductionRule();
            ensureCorrectBdd(bdd);
            assert.ok(
                (bdd as any)
                    .branches.getBranch('0')
                    .branches.getBranch('0')
                    .branches.getBranch('0').isLeafNode()
            );
        });
    });
    describe('applyEliminationRule()', () => {
        it('should remove the found one', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            let nodes: NonRootNode[] = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes[0] as InternalNode;
            first.applyEliminationRule();
            ensureCorrectBdd(bdd);
            assert.strictEqual(
                bdd.branches.getBranch('0').id,
                bdd.branches.getBranch('1').id
            );

            nodes = bdd.getNodesOfLevel(1);
            const second: InternalNode = nodes[0] as InternalNode;
            second.applyEliminationRule();
            ensureCorrectBdd(bdd);
        });
    });
    describe('minimize()', () => {
        it('should return a minimized version', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            bdd.minimize(false);
            assert.ok((bdd as any).branches.getBranch('0').isLeafNode());
            assert.ok((bdd as any).branches.getBranch('1').isLeafNode());
            ensureCorrectBdd(bdd);
        });
        it('should not crash on random table', () => {
            const table = exampleTruthTable();
            table.set('000', 1);
            table.set('001', 1);
            table.set('010', 1);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            assert.ok((bdd as any).branches.getBranch('0').branches.getBranch('0').isLeafNode());
            ensureCorrectBdd(bdd);
        });
        it('should not crash on a really big table', () => {
            const depth = 11;
            const table = randomTable(depth);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            ensureCorrectBdd(bdd);
        });
        it('random table should not have two equal branches', () => {
            const depth = 9;
            const table = randomTable(depth);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            ensureCorrectBdd(bdd);
            const leafNodes: LeafNode[] = bdd.getNodesOfLevel(depth) as LeafNode[];
            leafNodes.forEach(leaf => {
                const parents = leaf.parents.getAll();
                parents.forEach(parent => {
                    assert.notStrictEqual(
                        (parent.branches.getBranch('0') as LeafNode).value,
                        (parent.branches.getBranch('1') as LeafNode).value
                    );
                });
            });
        });
    });
    describe('countNodes()', () => {
        it('should be smaller after minimize', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const before = bdd.countNodes();
            bdd.minimize();
            const after = bdd.countNodes();
            assert.ok(before > after);
        });
    });
    describe('.removeIrrelevantLeafNodes()', () => {
        it('should remove all irrelevant nodes', () => {
            const table = exampleTruthTable(5);
            table.set('00001', UNKNOWN);
            table.set('00000', UNKNOWN);
            table.set('00101', UNKNOWN);
            const bdd = createBddFromTruthTable(table);
            bdd.removeIrrelevantLeafNodes(UNKNOWN);
            bdd.getLeafNodes().forEach(node => {
                assert.notStrictEqual(
                    UNKNOWN,
                    node.value
                );
            });
        });
        it('should work on a big table', () => {
            const table = randomUnknownTable(6);
            const bdd = createBddFromTruthTable(table);
            bdd.removeIrrelevantLeafNodes(UNKNOWN);
            bdd.getLeafNodes().forEach(node => {
                assert.notStrictEqual(
                    UNKNOWN,
                    node.value
                );
            });
        });
    });
});
