export declare function positiveInteger(value: number, name: string): number;
/** Map values concurrently while preserving input order in the result. */
export declare function mapConcurrent<T, R>(values: readonly T[], concurrency: number, mapper: (value: T, index: number) => Promise<R>): Promise<R[]>;
