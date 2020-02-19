import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table';
import {
    exampleTruthTable
} from '../helper/test-util';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd';


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
