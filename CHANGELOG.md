# Changelog

## Unreleased

- FIX `bddToMinimalString()` silently changed leaf values that do not fit into one character of the minimal string. A leaf value of `-41` was resolved as `65495`, and `0.5` as `0`. It now throws an error for leaf values that are not integers from `-40` to `65495`.
