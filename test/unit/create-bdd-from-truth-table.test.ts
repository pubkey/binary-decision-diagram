import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table.js';
import {
    exampleTruthTable
} from '../helper/test-util.js';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd.js';


describe('create-bdd-from-truth-table.test.ts', () => {
    it('should create a bdd', () => {
        const bdd = createBddFromTruthTable(
            exampleTruthTable()
        );
        assert.ok(bdd);
        ensureCorrectBdd(bdd);
    });
    it('should create a big bdd', () => {
        const bdd = createBddFromTruthTable(
            exampleTruthTable(5)
        );
        assert.ok(bdd);
        ensureCorrectBdd(bdd);
    });
});
