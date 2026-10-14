# Changelog

## Unreleased

- FIX `decimalToPaddedBinary()` cut off all bits above 32, so `decimalToPaddedBinary(2 ** 32, 33)` returned only zeros.
- FIX `getNextStateSet()` returned wrong state sets for keys with more than 32 characters and lost precision for keys with more than 53 characters.
- FIX `removeIrrelevantLeafNodes()` deleted the only leaf when all rows had the irrelevant value, so the root node pointed to a deleted node, `countNodes()` and `getLeafNodes()` missed it and `ensureCorrectBdd()` threw.
