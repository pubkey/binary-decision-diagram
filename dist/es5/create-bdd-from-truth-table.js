"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var root_node_1 = require("./root-node");
var util_1 = require("./util");
var internal_node_1 = require("./internal-node");
var leaf_node_1 = require("./leaf-node");
function createBddFromTruthTable(truthTable) {
    var e_1, _a;
    var root = new root_node_1.RootNode();
    var firstKey = truthTable.keys().next().value;
    var keyLength = firstKey.length;
    var mustBeSize = Math.pow(2, keyLength);
    if (truthTable.size !== mustBeSize) {
        throw new Error('truth table has missing entries');
    }
    try {
        for (var truthTable_1 = __values(truthTable), truthTable_1_1 = truthTable_1.next(); !truthTable_1_1.done; truthTable_1_1 = truthTable_1.next()) {
            var _b = __read(truthTable_1_1.value, 2), stateSet = _b[0], value = _b[1];
            var lastNode = root;
            // itterate over each char of the state
            for (var i = 0; i < (stateSet.length - 1); i++) {
                var level = i + 1;
                var state = stateSet.charAt(i);
                // if node for this state-char not exists, add new one
                if (!lastNode.branches.getBranch(state)) {
                    lastNode.branches.setBranch(state, new internal_node_1.InternalNode(level, root, lastNode));
                }
                lastNode = lastNode.branches.getBranch(state);
            }
            // last node is leaf-node
            var lastState = util_1.lastChar(stateSet);
            if (lastNode.branches.getBranch(lastState)) {
                throw new Error('leafNode already exists, this should not happen');
            }
            lastNode.branches.setBranch(lastState, new leaf_node_1.LeafNode(stateSet.length, root, value, lastNode));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (truthTable_1_1 && !truthTable_1_1.done && (_a = truthTable_1.return)) _a.call(truthTable_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return root;
}
exports.createBddFromTruthTable = createBddFromTruthTable;
//# sourceMappingURL=create-bdd-from-truth-table.js.map