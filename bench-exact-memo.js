'use strict';
// experiment: does clearing restrictMemo per cofactorsAfter() call hurt time? how much memory does it save?
const lib = require('/home/user/binary-decision-diagram/dist/cjs/src/index.js');
const { IntPairMap } = require('/home/user/binary-decision-diagram/dist/cjs/src/ordering/int-pair-map.js');
const { performance } = require('perf_hooks');
const n = Number(process.argv[2] || 14);
const clearMemo = process.argv[3] === 'clear';
function makeDense(n, seed) {
    const rowCount = 2 ** n; const ids = new Int32Array(rowCount); let s = seed >>> 0;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; };
    for (let i = 0; i < rowCount; i++) ids[i] = rnd() < 0.25 ? 0 : 1;
    return { variableCount: n, rowCount, terminalIds: ids, terminalValues: [1, 2], dontCareTerminal: -1, leafCount: 2 };
}
const table = makeDense(n, 777 + n);
const ev = new lib.OrderingEvaluator(table);
const natural = lib.naturalOrdering(n);
const nat = ev.evaluate(natural);
const search = new lib.ExactOrderingSearch(table);
let calls = 0, maxMemo = 0;
if (clearMemo) {
    const orig = search.cofactorsAfter;
    search.cofactorsAfter = function (set, variable) {
        calls++;
        if (this.restrictMemo.size > maxMemo) maxMemo = this.restrictMemo.size;
        this.restrictMemo = new IntPairMap(1 << 16);
        return orig.call(this, set, variable);
    };
}
const start = performance.now();
const result = search.run({ upperBoundOrdering: natural, upperBound: nat.internalNodeCount, log: () => null });
const ms = performance.now() - start;
const m = process.memoryUsage();
console.log(`n=${n} clearMemo=${clearMemo}: solved=${result.solved} internal=${result.internalNodeCount} expansions=${result.expansions} time=${(ms / 1000).toFixed(1)}s diagramNodes=${search.nodeCount} memoSize=${search.restrictMemo.size} maxMemoPerEdge=${maxMemo} arrayBuffers=${(m.arrayBuffers / 1048576).toFixed(0)}MB rss=${(m.rss / 1048576).toFixed(0)}MB`);
