export function positiveInteger(value, name) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new RangeError(`${name} must be a positive integer`);
    }
    return value;
}
/** Map values concurrently while preserving input order in the result. */
export async function mapConcurrent(values, concurrency, mapper) {
    positiveInteger(concurrency, "concurrency");
    const results = new Array(values.length);
    let nextIndex = 0;
    async function worker() {
        while (true) {
            const index = nextIndex++;
            if (index >= values.length)
                return;
            results[index] = await mapper(values[index], index);
        }
    }
    const workerCount = Math.min(concurrency, values.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}
