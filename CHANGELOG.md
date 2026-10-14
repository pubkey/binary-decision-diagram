# Changelog

## Unreleased

- IMPROVE performance of `RootNode.resolve()` by about 30-40%. The BDD is compiled into a flat `Int32Array` on the first `resolve()` call and walked without following node objects. The compiled data is cached and rebuilt automatically when a branch of the BDD changes.
- FIX `decimalToPaddedBinary()` cut off all bits above 32, so `decimalToPaddedBinary(2 ** 32, 33)` returned only zeros.
- FIX `getNextStateSet()` returned wrong state sets for keys with more than 32 characters and lost precision for keys with more than 53 characters.
