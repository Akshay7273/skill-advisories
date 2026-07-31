import { describe, expect, it } from "vitest"
import { mapConcurrent } from "../src/concurrency.js"

describe("bounded concurrency", () => {
  it("preserves input order while limiting active work", async () => {
    let active = 0
    let peak = 0
    const values = Array.from({ length: 12 }, (_, index) => index)
    const result = await mapConcurrent(values, 3, async (value) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, (value % 3) + 1))
      active--
      return value * 2
    })
    expect(result).toEqual(values.map((value) => value * 2))
    expect(peak).toBeLessThanOrEqual(3)
  })

  it("rejects invalid concurrency instead of silently running unbounded", async () => {
    await expect(mapConcurrent([1], 0, async (value) => value)).rejects.toThrow(
      "positive integer",
    )
  })
})
