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
/**
 * represents the parents of a single node
 */
var Parents = /** @class */ (function () {
    function Parents(node) {
        this.node = node;
        this.parents = new Set();
    }
    Parents.prototype.remove = function (node) {
        this.parents.delete(node);
        if (this.parents.size === 0) {
            this.node.remove();
        }
    };
    Parents.prototype.getAll = function () {
        return Array.from(this.parents);
    };
    Parents.prototype.add = function (node) {
        if (this.node.level === node.level) {
            throw new Error('a node cannot be parent of a node with the same level');
        }
        this.parents.add(node);
    };
    Parents.prototype.has = function (node) {
        return this.parents.has(node);
    };
    Parents.prototype.toString = function () {
        var e_1, _a;
        var ret = [];
        try {
            for (var _b = __values(this.parents), _c = _b.next(); !_c.done; _c = _b.next()) {
                var parent_1 = _c.value;
                ret.push(parent_1.id);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return ret.join(', ');
    };
    Object.defineProperty(Parents.prototype, "size", {
        get: function () {
            return this.parents.size;
        },
        enumerable: true,
        configurable: true
    });
    return Parents;
}());
export { Parents };
//# sourceMappingURL=parents.js.map