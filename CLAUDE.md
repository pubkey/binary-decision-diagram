# Notes for Claude

- Performance only matters for the functions that event-reduce-js imports at runtime: `resolveWithPackedBdd()`, `packedBddFromBase64String()` and its helper `base64ToBytes()` (in `src/packed/`). Keep them fast and free of compiler helpers (plain loops, no `for...of`, spread or destructuring).
- Everything else (creating, minimizing and optimizing BDDs, truth tables) is offline tooling. Prefer simple code there over fast code.
- The published code is ES5 (`target: "ES5"` with `downlevelIteration`). `test/unit/es5.test.ts` checks both builds.
