# minimal representation

To efficiently store a BDD in client side applications, there is the minimal representation.
It is basically an array of numbers and to resolve values you go forth and back like on a turing tape.


## Example

```ts

const minimalRepresentation = [


    // each node is represented by three numbers
    0, // level of the node
    8, // either a value or the index of the false-node
    16, // either a value or the index of the true-node

    // each node is represented by three numbers
    4, // level of the node
    19, // either a value or the index of the false-node
    42, // either a value or the index of the true-node


    /**
     * last-2 number in the array is the max-level
     * used to determine if a number is level or something else
     * const MAX_LEVEL = minimalRepresentation[minimalRepresentation.length-3]
     */
    3,
    /**
     * last-1 number in the array is the max-value
     * used to determine if a number is value or something else
     * const MAX_VALUE = minimalRepresentation[minimalRepresentation.length-2]
     */
    4,
    /**
     * last number is the index of the entrypoint
     * const ENTRYPOINT = minimalRepresentation[minimalRepresentation.length-1];
     */
    0
]
```

## resolving values

1. Parse `MAX_LEVEL` and `MAX_VALUE` and `ENTRYPOINT`
2. Start with the number at `ENTRYPOINT` and resolve the boolean function for that level
3. Depending on true or false, use the next or 2nd-next number as `NEXT_NR`
4. if `NEXT_NR` <= `MAX_VALUE + MAX_LEVEL` you have reached the end, resolved value is `NEXT_NR - MAX_LEVEL`
5. else go to `minimalRepresentation[NEXT_NR - (MAX_VALUE + MAX_LEVEL)]` and repeat `2.`
