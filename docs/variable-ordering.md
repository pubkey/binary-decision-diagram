# Deterministic variable ordering for binary decision diagrams

The size of a (reduced, ordered) binary decision diagram depends heavily on the
order in which the boolean functions are tested. For the same truth table one
ordering can need ten times as many nodes as another, and finding the best
ordering is NP-complete.

Until version 3 this library only offered `optimizeBruteForce()`, which shuffles
the ordering randomly, builds the whole decision tree, minimizes it and keeps
the best result. That works, but it is slow (every iteration builds a tree with
`2^(n+1)` node objects), it never knows when it is done, and two runs give two
different results.

`optimizeOrdering()` replaces this with a deterministic method. It is
implementation independent: everything it needs is the truth table, so the
same algorithm can be used as a pre-pass by any BDD implementation in any
language. This document describes the method so that it can be ported.

## 1. Evaluate orderings without building a BDD

The central building block is `OrderingEvaluator.evaluate(ordering)`, which
returns the exact number of nodes of the reduced BDD for an ordering in
`O(2^n)` integer operations and without creating a single node object.

The `2^n` rows are the leaves of the decision tree. A *block* on level `k` is
the set of rows that agree on the boolean functions above level `k`; the
reduced BDD is built bottom-up, level by level, by merging the two child
blocks of every block:

```
ids[n] = terminal id of every row
for level k = n-1 down to 0:
    for every block b of level k:
        (lo, hi) = ids[k+1] of the two children of b (function ordering[k] = 0 / 1)
        if lo == DONT_CARE:   id = hi               // don't-care collapse
        elif hi == DONT_CARE: id = lo
        elif lo == hi:        id = lo               // reduction rule
        else:                 id = hashcons(lo, hi) // elimination rule
        ids[k][b] = id
    nodes[k] = number of ids created by hashcons on this level
```

Blocks are indexed by the assignment to the functions above them in their
natural (index) order, not in level order. The blocks of a level therefore only
depend on the *set* of functions above it, which is the key to the cheap local
search below.

`hashcons` returns the same id for the same `(lo, hi)` pair, so isomorphic
sub-diagrams share one node. Equal children are not represented by a node at
all. Therefore the number of ids created on a level is exactly the number of
nodes of the reduced BDD that test the boolean function of that level, and
their sum (plus the root and the leaves) is what `RootNode.countNodes()`
returns after `minimize()`. The test suite checks this equality against the
library's own pipeline on random tables.

Don't-care rows (rows that can never occur at runtime, see
`removeIrrelevantLeafNodes()`) are handled in the same pass: a branch that is
entirely don't-care takes over its sibling branch, exactly what
`removeIrrelevantLeafNodes()` does on the node structure. It can be shown by
induction that every partially defined block becomes either fully don't-care
or fully defined this way, so the resulting completion is unique for an
ordering and `complete(ordering)` returns the truth table with the don't-care
rows resolved. The optimizer returns this completed table together with the
BDD.

`OrderingCursor` keeps the `ids[k]` arrays of an ordering. When the functions
of two levels are swapped, the levels below the lower one keep their blocks and
ids (same sets of functions above them), only the levels from the lower one up
to the root are recomputed. Moving a function from the top to the bottom with
adjacent swaps therefore costs `O(2^n)` in total instead of `O(n * 2^n)`. For
the 17 variable table of the test suite a full evaluation takes about two
milliseconds and a whole sifting round well under a second; the old approach
needs seconds per ordering.

## 2. Deterministic local search

With evaluations this cheap, classic dynamic reordering techniques can be run
directly on the truth table:

1. **Seeds.** Four deterministic start orderings: the natural order, the
   reversed order, a greedy top-down construction (at each level pick the
   boolean function that gives the smallest BDD with the remaining functions
   in index order) and the analogous greedy bottom-up construction. Users can
   add their own via `initialOrderings`.
2. **Sifting** (Rudell, 1993). Each boolean function, largest level first, is
   moved through all positions with adjacent swaps and is placed where the BDD
   is smallest. Only strict improvements are accepted, so the procedure always
   terminates.
3. **Window permutation.** All permutations of every window of three adjacent
   levels are tried.

Sifting and window permutation alternate until a full round does not improve
anything. Ties are broken by index, no randomness is involved anywhere, so the
same truth table always gives the same ordering.

## 3. Exact search in the subset lattice

The number of nodes on a level of a reduced BDD depends only on the *set* of
boolean functions above that level, not on their order: it is the number of
distinct cofactors with respect to that set which still depend on the level's
function (Friedman and Supowit, 1990). Hence

```
size(ordering) = sum over levels k of  cost(S_k, x_k)
```

where `S_k` is the set of functions above level `k` and `x_k` the function on
level `k`. The optimal ordering is a shortest path from the empty set to the
full set through the lattice of variable subsets, where the edge `S -> S + {x}`
costs `cost(S, x)`.

`ExactOrderingSearch` finds that shortest path with an A* search:

- Every subset `S` is represented by the set of its distinct non-constant
  cofactors. All cofactors are nodes of one shared, hash-consed diagram in the
  natural variable order, so two cofactors are the same function if and only
  if they have the same id. Going from `S` to `S + {x}` restricts every
  cofactor on `x = 0` and `x = 1` and removes duplicates.
- `cost(S, x)` is the number of cofactors of `S` whose support contains `x`
  (support masks are stored per node).
- The estimate for the remaining cost of a subset is the number of its distinct
  non-constant cofactors (each needs its own node below) or the number of
  remaining relevant functions, whichever is larger. Both are lower bounds, so
  the first time the full set is taken from the queue its cost is optimal.
- The best ordering of the local search is an upper bound: subsets that cannot
  beat it are never queued. With a tight bound the search visits a small
  fraction of the `2^n` subsets. For the 17 variable test table it expands
  about 10 000 of 131 072 subsets in a third of a second and proves that the
  77 node ordering found by the local search (1.7 s) is optimal.
- Budgets make the search give up gracefully, the result then says
  `optimal: false`: a limit on expanded subsets, on stored cofactor sets and
  on the nodes of the shared diagram (`restrict` creates nodes for the
  restricted functions, which adds up on unstructured functions).
- By default the exact search only runs when the local search found a BDD with
  at most 5000 internal nodes. Unstructured functions have big BDDs, every
  ordering is about equally bad for them, and the lower bound prunes almost
  nothing, so the search would be slow for no gain. `exact: true` forces it.

Don't-care rows make the function depend on the ordering, so the exact search
runs on completed tables: the completion of the best ordering and the
completions the local search came across are candidates, and whenever an exact
run finds a better ordering, the completion of that ordering becomes a new
candidate. `optimal: true` means: for the returned (completed) truth table no
ordering gives fewer nodes.

## 4. Cheapest resolve() calls instead of fewest nodes

The boolean functions behind a BDD rarely cost the same to call: one reads a
flag, another sorts a result set. What matters at runtime is then not the
amount of nodes but the cost of the functions that are actually called on the
way from the root to the leaf. With `functionCosts` the optimizer minimizes
that:

```
expectedCost(ordering) = sum over levels k of  cost(x_k) * P_k
```

where `P_k` is the share of the (weighted) rows whose path visits a node on
level `k`. A row visits a node on level `k` exactly when its cofactor with
respect to the functions above still depends on `x_k`; the root node always
calls its function. The bottom-up pass of section 1 computes `P_k` for free by
carrying the row weights along: whenever a pair of children becomes a node, the
weight of its block is added to the level. By default every row that is not a
don't-care row counts the same, `rowWeight` gives rows individual frequencies.

The local search of section 2 works unchanged with the new objective (fewer
nodes only break ties). The exact search of section 3 works too, because the
expected cost decomposes over the subset lattice the same way: the edge
`S -> S + {x}` costs `cost(x)` times the weight of the rows whose cofactor with
respect to `S` depends on `x`. A state of `ExactCostOrderingSearch` keeps the
rows with positive weight grouped by cofactor (rows whose cofactor became
constant are dropped), the admissible estimate for the rest of the path is,
for every function not yet placed, its cost times the weight of the rows that
are sensitive to it, because those rows pay for it in every ordering.

On the 17 variable test table with sample costs (fourteen cheap functions,
three expensive ones costing 20, 50 and 100):

| ordering | nodes | expected cost per resolve() |
| --- | --- | --- |
| natural order | 187 | 122.6 |
| fewest nodes (`optimizeOrdering` without costs) | 77 | 112.5 |
| cheapest calls (`optimizeOrdering` with `functionCosts`) | 154 | **38.3**, proven optimal |

The expensive functions move to the bottom where only the rows that really
need them pay for them. The cost reported by the optimizer equals the cost
measured by calling `resolve()` with counting resolver functions on every row.

## 5. Building the BDD

The best ordering is turned into the library's node structure directly from the
reduced diagram (`createBddWithOrdering()`), so the unreduced tree with
`2^(n+1)` nodes is never built and no `minimize()` call is needed. The result
has the same shape as the BDDs of `optimizeBruteForce()`: the level of a node
is the index of the boolean function it tests, and `bddToMinimalString()`
works as before.

## 6. Results

Numbers from an ordinary laptop, `npm run build` of this repository.
"Brute force" is `optimizeBruteForce()` with the given number of iterations,
"deterministic" is `optimizeOrdering()` with default options.

| truth table | variables | natural order | brute force | deterministic |
| --- | --- | --- | --- | --- |
| event-reduce table from the test suite (576 defined rows, rest don't-care) | 17 | 187 nodes | 112 nodes, 150 iterations, 351 s | **77 nodes, proven optimal, 4 s** |
| structured, 50 % don't-care | 8 | 60 | 36 (100 iterations, 1.5 s) | **30, proven optimal, 0.04 s** |
| structured, 50 % don't-care | 10 | 156 | 33 (60 iterations, 7.4 s) | **31, proven optimal, 0.07 s** |
| structured, 70 % don't-care | 12 | 344 | 78 (25 iterations, 16.8 s) | **30, proven optimal, 0.16 s** |
| uniformly random values | 8 | 263 | 263 (100 iterations, 2.7 s) | 263, proven optimal, 0.01 s |
| uniformly random values | 10 | 1023 | 1023 (60 iterations, 25 s) | 1023, proven optimal, 0.09 s |

Uniformly random functions have no structure to exploit, every ordering is
equally bad; the exact search proves that in milliseconds instead of leaving
the brute force running forever.

## 7. Porting the method to another BDD implementation

Only `evaluate()` (section 1) and `restrict`/`cost` (section 3) touch the
function representation, and both only need the truth table. Everything else
is plain integer arithmetic. A port needs:

1. the truth table as a flat array indexed by the row bits,
2. the bottom-up hash-consing pass of section 1 with one id array per level
   (plus one weight array per level for the cost objective of section 4),
3. level swaps that recompute only the levels above the swapped ones,
4. the local search of section 2,
5. optionally the A* searches of sections 3 and 4, which need a hash-consed
   diagram with `restrict` and per-node support masks.

The code in `src/ordering/` is written to be read in that order.

## 8. Limitations and further work

- The truth table must be complete (`2^n` rows), so the method is for
  functions with up to roughly 24 boolean functions. Dynamic reordering inside
  a BDD package stays the tool for larger functions.
- Don't-care rows are resolved greedily (a don't-care branch takes its sibling
  branch, as `removeIrrelevantLeafNodes()` does). Choosing the completion that
  gives the globally smallest BDD is itself NP-hard; the alternation between
  completion and exact ordering search is a heuristic for it.
- Symmetric variables could be grouped to shrink the search space further.
