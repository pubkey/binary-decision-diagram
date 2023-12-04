import type { TruthTable } from './types.js';
import { RootNode } from './root-node.js';
/**
 * a function that is called each time
 * a 'better' bdd was found
 */
export type OptmisiationCallback = (bdd: OptimisationResult) => void;
export interface OptimisationResult {
    bdd: RootNode;
    truthTable: TruthTable;
}
export type CompareResultsFunction = (a: RootNode, b: RootNode) => RootNode | Promise<RootNode>;
/**
 * returns the bdd with less nodes
 */
export declare const defaultCompareResults: CompareResultsFunction;
export interface OptimizeBruteForceInput {
    truthTable: TruthTable;
    iterations?: number;
    onBetterBdd?: OptmisiationCallback;
    compareResults?: CompareResultsFunction;
    afterBddCreation?: (bdd: RootNode) => void;
    initialBdd?: RootNode;
    log?: boolean;
}
/**
 * optimises the ordering of the boolean functions
 * by randomly sorting the array
 * and checking the resulting bdd
 */
export declare function optimizeBruteForce({ truthTable, iterations, onBetterBdd, compareResults, afterBddCreation, initialBdd, log }: OptimizeBruteForceInput): Promise<OptimisationResult>;
export type BooleanFunctionReorderMapping = {
    [indexAfter: number]: number;
};
export type BooleanFunctionReorderMappingReverse = {
    [indexBefore: number]: number;
};
export declare function shuffleBooleanOrdering(truthTable: TruthTable): {
    newTable: TruthTable;
    mapping: BooleanFunctionReorderMapping;
    mappingBeforeToAfter: BooleanFunctionReorderMappingReverse;
};
export declare function changeKeyOrder(oldKey: string, mappingBeforeToAfter: BooleanFunctionReorderMapping): string;
export declare function getArrayWithIndexes(size: number): number[];
