/**
 * represents the parents of a single node
 */
export class Parents {
    node;
    parents = new Set();
    constructor(node) {
        this.node = node;
    }
    remove(node) {
        this.parents.delete(node);
        if (this.parents.size === 0) {
            this.node.remove();
        }
    }
    getAll() {
        return Array.from(this.parents);
    }
    add(node) {
        if (this.node.level === node.level) {
            throw new Error('a node cannot be parent of a node with the same level');
        }
        this.parents.add(node);
    }
    has(node) {
        return this.parents.has(node);
    }
    toString() {
        const ret = [];
        for (const parent of this.parents) {
            ret.push(parent.id);
        }
        return ret.join(', ');
    }
    get size() {
        return this.parents.size;
    }
}
//# sourceMappingURL=parents.js.map