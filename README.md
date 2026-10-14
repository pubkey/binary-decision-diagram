# Binary Decision Diagram (BDD) library for JavaScript and TypeScript

[![npm version](https://img.shields.io/npm/v/binary-decision-diagram.svg)](https://www.npmjs.com/package/binary-decision-diagram)
[![npm downloads](https://img.shields.io/npm/dm/binary-decision-diagram.svg)](https://www.npmjs.com/package/binary-decision-diagram)
[![license](https://img.shields.io/npm/l/binary-decision-diagram.svg)](./LICENSE)

**binary-decision-diagram** is a JavaScript and TypeScript library to **create**, **minimize** and **optimize** binary decision diagrams (BDDs).
Build a reduced ordered binary decision diagram (ROBDD) or multi-terminal BDD (MTBDD) from a truth table,
find a good variable ordering, serialize it to a tiny string and resolve values with it in the browser or in Node.js.

## Table of contents

- [What is a binary decision diagram?](#what-is-a-binary-decision-diagram)
- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [API](#api)
- [Use cases](#use-cases)
- [Further reading](#further-reading)

## What is a binary decision diagram?

A binary decision diagram (BDD) is a data structure that represents boolean functions in a compact way.
It is a directed acyclic graph where every internal node tests one boolean variable and every leaf holds a result value.
By merging identical subgraphs and removing redundant tests (the *reduction* and *elimination* rules),
a decision tree with `2^n` leaves often shrinks to a few nodes. This is called a reduced ordered binary decision diagram (ROBDD).

The size of a BDD depends heavily on the **variable ordering**, the order in which the boolean functions are tested.
Finding a good ordering is the main way to make a BDD small, and this library ships a fast deterministic optimizer for it.

This library builds multi-terminal BDDs: the leaves can hold any number, not only `true` and `false`.
That makes it a good fit to compile large truth tables or decision tables into small, fast lookup structures.

## Features

- Create a BDD from a truth table (`Map<string, number>`)
- Minimize it with the reduction and elimination rules (ROBDD)
- Multi-terminal leaves: map every input combination to a number, not only to a boolean
- Deterministic variable ordering optimization, with proven optimal results for small tables
- Optimize for the expected runtime cost of the boolean functions, not only for the node count
- Don't-care values to remove rows that can never occur
- Serialize a BDD to a minimal string and resolve it with a tiny runtime, ideal for small client-side bundles
- Written in TypeScript, ships ESM and CommonJS builds with type definitions

## Installation

```bash
npm install binary-decision-diagram --save
```

## Quick start

```typescript
import {
    createBddFromTruthTable,
    bddToMinimalString,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd,
    type ResolverFunctions
} from 'binary-decision-diagram';

// every key is one combination of the boolean functions, the value is the result
const truthTable = new Map<string, number>();
truthTable.set('00', 1);
truthTable.set('01', 3);
truthTable.set('10', 2);
truthTable.set('11', 1);

const bdd = createBddFromTruthTable(truthTable);
bdd.minimize();

// one boolean function per character of the truth table keys
const resolvers: ResolverFunctions<{ a: boolean; b: boolean }> = {
    0: (input) => input.a,
    1: (input) => input.b
};
bdd.resolve(resolvers, { a: true, b: false }); // 2

// store the BDD as a small string and resolve it without the full library
const minimalString = bddToMinimalString(bdd);
const simpleBdd = minimalStringToSimpleBdd(minimalString);
resolveWithSimpleBdd(simpleBdd, resolvers, { a: true, b: false }); // 2
```

## API

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

Each leaf value is stored as a single character, so the leaf values must be integers from `-40` to `65495`, and the BDD can have at most 99 leaf nodes. Otherwise `bddToMinimalString()` throws an error.

### minimalStringToSimpleBdd()

Parses the minimal string into an `SimpleBdd`. The `SimpleBdd` is very small and can only resolve values.

```typescript
const simpleBdd = minimalStringToSimpleBdd(str);
```

### resolveWithSimpleBdd()

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

## Use cases

- **Compiling decision tables**: turn a large truth table of business rules or query conditions into a small BDD that needs only a few boolean checks per lookup.
- **Small client-side bundles**: precompute and optimize the BDD at build time, ship it as a minimal string and resolve it with `resolveWithSimpleBdd()`.
- **Event reduction in databases**: [event-reduce](https://github.com/pubkey/event-reduce) uses this library to decide how a query result changes on a write event, which powers the realtime queries of [RxDB](https://github.com/pubkey/rxdb).

## Further reading

- [How the variable ordering optimizer works](./docs/variable-ordering.md)
- [Introduction on BDDs](https://web.archive.org/web/20110304135553/http://configit.com/fileadmin/Configit/Documents/bdd-eap.pdf)
- [Presentation on BDDs](https://de.slideshare.net/RajeshYadav49/reduced-ordered-binary-decision-diagram-devi)
- [Implementation of ROBDD](https://pdfs.semanticscholar.org/788d/ed39ca36300753bcb20c43762972b00f9b80.pdf)
- [Binary decision diagram on Wikipedia](https://en.wikipedia.org/wiki/Binary_decision_diagram)
