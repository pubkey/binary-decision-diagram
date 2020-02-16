import { RootNode } from './root-node';
import { lastChar } from './util';
import { InternalNode } from './internal-node';
import { LeafNode } from './leaf-node';
export function createBddFromTruthTable(truthTable) {
    const root = new RootNode();
    for (const [stateSet, value] of truthTable) {
        let lastNode = root;
        // itterate over each char of the state
        for (let i = 0; i < (stateSet.length - 1); i++) {
            const level = i + 1;
            const state = stateSet.charAt(i);
            // if node for this state-char not exists, add new one
            if (!lastNode.branches.getBranch(state)) {
                lastNode.branches.setBranch(state, new InternalNode(level, root, lastNode));
            }
            lastNode = lastNode.branches.getBranch(state);
        }
        // last node is leaf-node
        const lastState = lastChar(stateSet);
        if (lastNode.branches.getBranch(lastState)) {
            throw new Error('leafNode already exists, this should not happen');
        }
        lastNode.branches.setBranch(lastState, new LeafNode(stateSet.length, root, value, lastNode));
    }
    return root;
}
//# sourceMappingURL=create-bdd-from-truth-table.js.map