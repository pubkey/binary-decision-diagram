# Changelog

## Unreleased

- FIX the ES module build (`dist/esm`) of 6.0.0 was compiled as CommonJS, so importing it as an ES module failed with `exports is not defined` and bundlers did not find its exports. A test now imports both builds.

## 6.0.0

- CHANGE the published code (`dist/esm` and `dist/cjs`) is now ES5, so bundles that must stay ES5 can include the library without transpiling it. The ES module build keeps `import`/`export`. A test checks that both builds only contain ES5 syntax.
- FIX `instanceof DiagramBudgetExceededError` did not work when the library is compiled to ES5.
- FIX `decimalToPaddedBinary()` cut off all bits above 32, so `decimalToPaddedBinary(2 ** 32, 33)` returned only zeros.
- FIX `getNextStateSet()` returned wrong state sets for keys with more than 32 characters and lost precision for keys with more than 53 characters.
