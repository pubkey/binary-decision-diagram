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
truthTable.add('00', 1);
truthTable.add('01', 3);
truthTable.add('10', 2);
truthTable.add('11', 1);

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

### optimizeBruteForce()

Optimizes the sorting of the boolean functions to get an optimal BDD. Returns a promise with the best found BDD.

```typescript
const optimizedResult = await optimizeBruteForce({
    truthTable,
    iterations: 10000,
    // hook that runs whenever a bdd is created (optional)
    afterBddCreation: (bdd: RootNode) => {
        bdd.removeIrrelevantLeafNodes(unknownValueActionId);
    },
    // hook that is triggered whenever a better bdd was found (optional)
    onBetterBdd: (res: OptimisationResult) => {
        const bddMinimalString = bddToMinimalString(res.bdd);
        console.log('new string: ' + bddMinimalString);
        console.log('value mapping:');
        console.dir(res.mapping);
    },
    // (optional) start with this BDD to optimize. If not set, will create an own one.
    initialBdd: myBdd
});
```
