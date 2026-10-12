/**
 * Open addressing hash map from a pair of non-negative 32 bit integers
 * to a non-negative 32 bit integer. Used in the hot paths of the exact search
 * where a Map with string keys would be far too slow.
 */
export class IntPairMap {
    public size: number = 0;
    private keysA: Int32Array;
    private keysB: Int32Array;
    private values: Int32Array;
    private mask: number;

    constructor(initialCapacity: number = 1024) {
        let capacity = 16;
        while (capacity < initialCapacity) {
            capacity *= 2;
        }
        this.keysA = new Int32Array(capacity).fill(-1);
        this.keysB = new Int32Array(capacity);
        this.values = new Int32Array(capacity);
        this.mask = capacity - 1;
    }

    /**
     * @returns the stored value or -1
     */
    public get(a: number, b: number): number {
        let h = this.hash(a, b);
        while (true) {
            const storedA = this.keysA[h];
            if (storedA === -1) {
                return -1;
            }
            if (storedA === a && this.keysB[h] === b) {
                return this.values[h];
            }
            h = (h + 1) & this.mask;
        }
    }

    public set(a: number, b: number, value: number) {
        if ((this.size + 1) * 2 > this.keysA.length) {
            this.grow();
        }
        let h = this.hash(a, b);
        while (true) {
            const storedA = this.keysA[h];
            if (storedA === -1) {
                this.keysA[h] = a;
                this.keysB[h] = b;
                this.values[h] = value;
                this.size++;
                return;
            }
            if (storedA === a && this.keysB[h] === b) {
                this.values[h] = value;
                return;
            }
            h = (h + 1) & this.mask;
        }
    }

    private hash(a: number, b: number): number {
        let h = (Math.imul(a, 0x9E3779B1) ^ Math.imul(b + 0x7F4A7C15, 0x85EBCA77)) >>> 0;
        h ^= h >>> 15;
        return h & this.mask;
    }

    private grow() {
        const oldA = this.keysA;
        const oldB = this.keysB;
        const oldValues = this.values;
        const capacity = oldA.length * 2;
        this.keysA = new Int32Array(capacity).fill(-1);
        this.keysB = new Int32Array(capacity);
        this.values = new Int32Array(capacity);
        this.mask = capacity - 1;
        this.size = 0;
        for (let i = 0; i < oldA.length; i++) {
            if (oldA[i] !== -1) {
                this.set(oldA[i], oldB[i], oldValues[i]);
            }
        }
    }
}
