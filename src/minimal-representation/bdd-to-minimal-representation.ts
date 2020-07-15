import type { AbstractNode } from '../abstract-node';
import type { MinimalRepresentation, BooleanString, NonLeafNode } from '../types';
import type { RootNode } from '../root-node';
import { lastOfArray } from '../util';

export function bddToMinimalRepresentation(bdd: RootNode): MinimalRepresentation {
    const maxLevel = lastOfArray(bdd.getLevels());
    const maxValue = lastOfArray(
        bdd.getLeafNodes()
            .map(node => node.value)
            .sort((a, b) => a - b)
    );

    const indexAdd = maxValue + maxLevel;

    const indexOfNode: Map<AbstractNode, number> = new Map();
    const ret: MinimalRepresentation = [];

    bdd.log();

    const levelsHighestFirst = bdd.levels.slice().reverse();
    let entrypoint = 0;
    levelsHighestFirst.forEach(level => {
        const nodes = bdd.getNodesOfLevel(level);
        nodes.forEach(node => {

            const index = ret.length + indexAdd;
            indexOfNode.set(node, index);

            if (node.type === 'LeafNode') {
                // skip leaf nodes because their values are represented as numbers
                return;
            }
            if (node.type === 'RootNode') {
                // found entrypoint
                entrypoint = index;
            }

            console.log('push level ' + node.level);
            ret.push(node.level);

            ['0', '1'].forEach((branchKey) => {
                const branch = (node as NonLeafNode).branches.getBranch(branchKey as BooleanString);
                if (branch.type === 'LeafNode') {
                    console.log('push value ' + branch.asLeafNode().value);
                    ret.push(branch.asLeafNode().value + maxLevel);
                } else {
                    const branchIndex = indexOfNode.get(branch);
                    console.log('push index ' + ((branchIndex as any) - indexAdd));
                    ret.push(branchIndex as number);
                }
            });
        });
    });


    // add indicators to the end
    ret.push(maxLevel);
    ret.push(maxValue);
    ret.push(entrypoint);

    return ret;
}
