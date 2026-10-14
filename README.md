# binary decision diagram

A library to **create**, **minimize** and **optimize** binary decision diagrams in JavaScript.



A binary decision diagram is a data structure that represents a set of boolean function in an efficient way. To learn more about it, follow these links:

- [Introduction on BDDs](https://web.archive.org/web/20110304135553/http://configit.com/fileadmin/Configit/Documents/bdd-eap.pdf)
- [Presentation on BDDs](https://de.slideshare.net/RajeshYadav49/reduced-ordered-binary-decision-diagram-devi)
- [Implementation of ROBDD](https://pdfs.semanticscholar.org/788d/ed39ca36300753bcb20c43762972b00f9b80.pdf)


### Installation

```bash
npm install binary-decision-diagram --save
```

### createBddFromTruthTable()

Creates a BDD from a truth table.
The Truth-Table is a `Map<string, number>` where the string is a truth-set like `1101` and the number is the value.

```typescript
const truthTable = new Map();
truthTable.set('00', 1);
truthTable.set('01', 3);
truthTable.set('10', 2);
truthTable.set('11', 1);

const bdd = createBddFromTruthTable(
    truthTable
);
```

### minimize()

Reduces the nodes of a BDD by applying the reduction- and elimination rules.

```typescript
bdd.minimize(
    false // if true, logs stuff (optional)
);
```

### countNodes()

Returns the amount of nodes of the BDD.

```typescript
bdd.countNodes(); // returns a number
```

### removeIrrelevantLeafNodes()

Removes all irrelevant leaf-nodes with the given value.

```typescript
// this will remove all leaf-nodes with the value of 5
bdd.removeIrrelevantLeafNodes(5);
```


### resolve()

Resolves a state by calling the boolean functions through the nodes.

The resolve-functions is an object with the truth-table-value as key and a boolean function as value.

```typescript
const resolvers: ResolverFunctions = {
    1: (i) => true,
    2: (i) => true,
    3: (i) => false
};
```

```typescript
const bddValue = bdd.resolve(
    resolvers, 
    i // input that is passed to the resolvers
); // returns a value from the truth table
```

### bddToMinimalString()

Returns a string-representation of the BDD which can be used in the client side to have a small javascript-bundle.
BDDs can be very big so an effective storage format was needed.

```typescript
const minimalString = bddToMinimalString(bdd)
```

### minimalStringToSimpleBdd()

Parses the minimal string into an `SimpleBdd`. The `SimpleBdd` very small and only can resolve stuff.

```typescript
const simpleBdd = minimalStringToSimpleBdd(str);
```

### resolveWithMinimalBdd()

Resolves a value with the `SimpleBdd` and the `ResolverFunctions`.

```typescript
resolveWithSimpleBdd(
    simpleBdd,
    resolvers,
    key
);
```

### optimizeOrdering()

Deterministically finds a variable ordering (the order in which the boolean functions are tested) that gives a small BDD and returns the minimized BDD for it.
Unlike `optimizeBruteForce()` it does not shuffle randomly: the same truth table always gives the same result,
it needs seconds instead of hours, and for small enough tables it proves that no better ordering exists.
How it works is described in [docs/variable-ordering.md](./docs/variable-ordering.md).

The truth table must contain all `2^n` rows (`n` = length of the keys, at most 30).
Fill the rows that can never occur with a don't-care value first.
Time and memory grow with `2^n`: tables with 17 or 18 boolean functions take a few seconds
(up to about 10 seconds with `functionCosts`), 21 functions take about half a minute and 0.5 GB.
The computation runs synchronously and blocks the event loop while it runs.

```typescript
const dontCareValue = 42; // value of the rows that can never occur at runtime
const truthTable: TruthTable = new Map();
truthTable.set('00000', 1);
// ... the known rows
fillTruthTable(truthTable, 5, dontCareValue);

const result = await optimizeOrdering({
    truthTable,
    // (optional) the don't-care rows are resolved like removeIrrelevantLeafNodes() does it:
    // a branch that only leads to don't-care rows is replaced by its sibling
    dontCareValue,
    // (optional) orderings to start from, for example the result of a previous run
    initialOrderings: [[3, 0, 1, 2, 4]],
    // (optional) 'auto' (default) runs the exact search when there are at most 20 boolean functions
    // and the BDD found by the local search has at most 5000 nodes, true always runs it, false never
    exact: 'auto',
    // (optional) called whenever a better ordering was found
    onImprovement: ({ nodeCount, phase }) => console.log(phase + ': ' + nodeCount + ' nodes')
});

result.bdd;        // the minimized BDD, ready for bddToMinimalString()
result.ordering;   // ordering[level] = index of the boolean function tested on that level
result.nodeCount;  // result.bdd.countNodes()
result.optimal;    // true when it is proven that no ordering gives fewer nodes for result.truthTable
result.truthTable; // the truth table with the don't-care rows resolved, same keys as the input, in row order
```

With don't-care rows, `optimal` refers to the way the don't-care rows were resolved in `result.truthTable`.
Which values the don't-care rows get is decided by a heuristic, so another ordering can occasionally reach a smaller BDD
by resolving them differently. For the same reason, rebuild the BDD from `result.truthTable`,
not from the input table: `createBddWithOrdering(result.truthTable, result.ordering)`.

When the boolean functions have different runtime costs, pass them and the optimizer
minimizes the expected cost of one `resolve()` call (the costs of the functions that are
actually called on the way from the root to the leaf, averaged over the rows) instead of the amount of nodes.
Expensive functions then end up on the levels where they are needed least often.

```typescript
const result = await optimizeOrdering({
    truthTable,
    dontCareValue,
    // cost of calling each boolean function, one entry per character of the truth table keys
    functionCosts: [1, 1, 50, 1, 20],
    // (optional) how often a row occurs at runtime, default: every row that is not a don't-care row equally often
    rowWeight: (key, value) => key.startsWith('1') ? 10 : 1
});

result.expectedCost; // expected cost of one resolve() call
result.optimal;      // true when it is proven that no ordering has a lower expected cost for result.truthTable
```

Among orderings with the same expected cost, fewer nodes are preferred, but this tie-break is not part of the proof.

Coming from `optimizeBruteForce()`: instead of `afterBddCreation: bdd => bdd.removeIrrelevantLeafNodes(x)`,
pass `dontCareValue: x`. The optimizer can only make use of the don't-care rows when it knows about them.

Use `findOrdering()` with the same options when you only need the ordering and not the BDD,
and `createBddWithOrdering(truthTable, ordering, dontCareValue)` to build the minimized BDD for a known ordering
without going through the full decision tree.

### optimizeBruteForce()

Optimizes the sorting of the boolean functions by shuffling randomly. Prefer `optimizeOrdering()`, which is deterministic and much faster.
Returns a promise with the best found BDD.

```typescript
const optimizedResult = await optimizeBruteForce({
    truthTable,
    iterations: 10000,
    // hook that runs whenever a bdd is created (optional)
    afterBddCreation: (bdd: RootNode) => {
        bdd.removeIrrelevantLeafNodes(dontCareValue);
    },
    // hook that is triggered whenever a better bdd was found (optional)
    onBetterBdd: (res: OptimisationResult) => {
        const bddMinimalString = bddToMinimalString(res.bdd);
        console.log('new string: ' + bddMinimalString);
    },
    // (optional) start with this BDD to optimize. If not set, will create an own one.
    initialBdd: myBdd
});
```
