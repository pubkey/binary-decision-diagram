import * as assert from 'assert';
import { createBddFromTruthTable } from '../../src/create-bdd-from-truth-table.js';
import { getResolverFunctions } from '../helper/test-util.js';
import { ensureCorrectBdd } from '../../src/ensure-correct-bdd.js';
import { RootNode, TruthTable } from '../../src/index.js';

/**
 * Builds the bdd of a 2-function table with boolean function 1 on top and
 * boolean function 0 below it, like optimizeBruteForce() does it for the
 * ordering [1, 0]: the two characters of each key are swapped before the
 * bdd is built, and the levels of the nodes are then named after the
 * boolean function they test. So the root has the level 1 and the nodes
 * below it have the level 0.
 */
function createBddWithFunction1OnTop(truthTable: TruthTable): RootNode {
    const swapped: TruthTable = new Map();
    for (const [key, value] of Array.from(truthTable.entries())) {
        swapped.set(key[1] + key[0], value);
    }
    const bdd = createBddFromTruthTable(swapped);

    const rootLevelNodes = bdd.nodesByLevel.get(0) as Set<any>;
    const nodesBelowRoot = bdd.nodesByLevel.get(1) as Set<any>;
    bdd.level = 1;
    nodesBelowRoot.forEach(node => node.level = 0);
    bdd.nodesByLevel.set(1, rootLevelNodes);
    bdd.nodesByLevel.set(0, nodesBelowRoot);
    bdd.levels = [1, 0, 2];
    return bdd;
}

/**
 * minimize() skipped the level 0 because it assumed that only the root
 * node lives there. After optimizeBruteForce() renamed the levels this is
 * not the case anymore.
 */
describe('minimize-level-zero.test.ts', () => {
    it('should merge equal nodes on level 0', () => {
        // the value only depends on boolean function 0 (the lower one),
        // so the two nodes below the root are equal and must be merged into one
        const truthTable: TruthTable = new Map([
            ['00', 1],
            ['01', 1],
            ['10', 2],
            ['11', 2]
        ]);
        const bdd = createBddWithFunction1OnTop(truthTable);
        bdd.minimize();
        ensureCorrectBdd(bdd);
        // root, one node for boolean function 0, two leaves
        assert.strictEqual(bdd.countNodes(), 4);
        const resolvers = getResolverFunctions(2);
        for (const [key, value] of Array.from(truthTable.entries())) {
            assert.strictEqual(bdd.resolve(resolvers, key), value);
        }
    });
});
