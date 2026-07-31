export function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return value
}

/** Map values concurrently while preserving input order in the result. */
export async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  positiveInteger(concurrency, "concurrency")
  const results = new Array<R>(values.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++
      if (index >= values.length) return
      results[index] = await mapper(values[index], index)
    }
  }

  const workerCount = Math.min(concurrency, values.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
