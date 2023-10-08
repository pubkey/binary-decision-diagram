"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBddFromTruthTable = void 0;
const root_node_js_1 = require("./root-node.js");
const util_js_1 = require("./util.js");
const internal_node_js_1 = require("./internal-node.js");
const leaf_node_js_1 = require("./leaf-node.js");
function createBddFromTruthTable(truthTable) {
    const root = new root_node_js_1.RootNode();
    const firstKey = truthTable.keys().next().value;
    const keyLength = firstKey.length;
    const mustBeSize = Math.pow(2, keyLength);
    if (truthTable.size !== mustBeSize) {
        throw new Error('truth table has missing entries');
    }
    for (const [stateSet, value] of truthTable) {
        let lastNode = root;
        // itterate over each char of the state
        for (let i = 0; i < (stateSet.length - 1); i++) {
            const level = i + 1;
            const state = stateSet.charAt(i);
            // if node for this state-char not exists, add new one
            if (!lastNode.branches.getBranch(state)) {
                lastNode.branches.setBranch(state, new internal_node_js_1.InternalNode(level, root, lastNode));
            }
            lastNode = lastNode.branches.getBranch(state);
        }
        // last node is leaf-node
        const lastState = (0, util_js_1.lastChar)(stateSet);
        if (lastNode.branches.getBranch(lastState)) {
            throw new Error('leafNode already exists, this should not happen');
        }
        lastNode.branches.setBranch(lastState, new leaf_node_js_1.LeafNode(stateSet.length, root, value, lastNode));
    }
    return root;
}
exports.createBddFromTruthTable = createBddFromTruthTable;
//# sourceMappingURL=create-bdd-from-truth-table.js.map