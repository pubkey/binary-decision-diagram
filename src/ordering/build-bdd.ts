import { RootNode } from '../root-node.js';
import { InternalNode } from '../internal-node.js';
import { LeafNode } from '../leaf-node.js';
import type { BooleanString, NonLeafNode } from '../types.js';
import type { DenseTruthTable } from './dense-truth-table.js';
import type { ReducedDiagram } from './ordering-evaluator.js';

/**
 * Creates the RootNode based BDD out of a reduced diagram.
 * The result is already minimal, so no minimize() call is needed.
 *
 * Like the BDDs returned by optimizeBruteForce(), the level of each node
 * is the index of the boolean function it tests (so resolve() works
 * with the original resolver functions) and RootNode.levels lists the
 * levels from top to bottom, followed by the leaf level.
 */
export function buildBddFromDiagram(
    diagram: ReducedDiagram,
    table: DenseTruthTable
): RootNode {
    const n = diagram.variableCount;
    const ordering = diagram.ordering;
    const terminalCount = diagram.terminalCount;
    const leafLevel = n;

    const root = new RootNode();
    root.level = ordering[0];
    root.levels = ordering.slice();
    root.levels.push(leafLevel);
    root.nodesByLevel = new Map();
    root.levels.forEach(level => root.nodesByLevel.set(level, new Set()));
    (root.nodesByLevel.get(root.level) as Set<RootNode>).add(root);

    const internalById: Map<number, InternalNode> = new Map();
    const leafById: Map<number, LeafNode> = new Map();

    const attach = (parent: NonLeafNode, branch: BooleanString, id: number) => {
        if (id < terminalCount) {
            let leaf = leafById.get(id);
            if (!leaf) {
                leaf = new LeafNode(leafLevel, root, table.terminalValues[id], parent);
                leafById.set(id, leaf);
            }
            parent.branches.setBranch(branch, leaf);
            return;
        }
        const existing = internalById.get(id);
        if (existing) {
            parent.branches.setBranch(branch, existing);
            return;
        }
        const index = id - terminalCount;
        const node = new InternalNode(ordering[diagram.nodeLevel[index]], root, parent);
        internalById.set(id, node);
        parent.branches.setBranch(branch, node);
        attach(node, '0', diagram.nodeLo[index]);
        attach(node, '1', diagram.nodeHi[index]);
    };

    const rootId = diagram.root;
    if (rootId >= terminalCount && diagram.nodeLevel[rootId - terminalCount] === 0) {
        attach(root, '0', diagram.nodeLo[rootId - terminalCount]);
        attach(root, '1', diagram.nodeHi[rootId - terminalCount]);
    } else {
        // the top level variable is irrelevant, the root node points to the same node twice
        attach(root, '0', rootId);
        attach(root, '1', rootId);
    }
    return root;
}
