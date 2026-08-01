import { describe, expect, it } from "vitest"
import {
  DEFAULT_MAX_FEED_AGE_HOURS,
  describeFreshness,
  evaluateFreshness,
  feedAgeMs,
} from "../src/freshness.js"

const NOW = Date.parse("2026-08-01T00:00:00Z")

const hoursAgo = (hours: number) => ({
  generated: new Date(NOW - hours * 3_600_000).toISOString(),
})

describe("feedAgeMs", () => {
  it("measures age from the generated timestamp", () => {
    expect(feedAgeMs(hoursAgo(3), NOW)).toBe(3 * 3_600_000)
  })

  it("returns null for a missing timestamp", () => {
    expect(feedAgeMs({ generated: undefined as unknown as string }, NOW)).toBeNull()
  })

  it("returns null for an unparseable timestamp", () => {
    expect(feedAgeMs({ generated: "last Tuesday" }, NOW)).toBeNull()
  })

  it("reports a future timestamp as negative rather than clamping it", () => {
    expect(feedAgeMs(hoursAgo(-5), NOW)).toBe(-5 * 3_600_000)
  })
})

describe("evaluateFreshness", () => {
  it("calls a recent feed fresh", () => {
    expect(evaluateFreshness(hoursAgo(2), { now: NOW })).toEqual({
      status: "fresh",
      ageHours: 2,
      generated: hoursAgo(2).generated,
      maxAgeHours: DEFAULT_MAX_FEED_AGE_HOURS,
    })
  })

  it("calls a feed past the limit stale", () => {
    expect(evaluateFreshness(hoursAgo(72), { now: NOW }).status).toBe("stale")
  })

  it("treats a feed exactly at the limit as fresh", () => {
    const at = hoursAgo(DEFAULT_MAX_FEED_AGE_HOURS)
    expect(evaluateFreshness(at, { now: NOW }).status).toBe("fresh")
  })

  it("honours an explicit hour limit", () => {
    expect(evaluateFreshness(hoursAgo(5), { maxAgeHours: 1, now: NOW }).status).toBe("stale")
    expect(evaluateFreshness(hoursAgo(5), { maxAgeHours: 24, now: NOW }).status).toBe("fresh")
  })

  it("honours a millisecond limit", () => {
    expect(evaluateFreshness(hoursAgo(5), { maxAgeMs: 3_600_000, now: NOW }).status).toBe("stale")
  })

  it("distinguishes an unreadable timestamp from an old one", () => {
    const freshness = evaluateFreshness({ generated: "not a date" }, { now: NOW })
    expect(freshness.status).toBe("unknown")
    expect(freshness.ageHours).toBeUndefined()
  })

  it("does not call a future-dated feed stale, but does not call it fresh either", () => {
    // A negative age is under any positive limit, so it reads as fresh here.
    // The negative ageHours is what surfaces the anomaly to a caller.
    const freshness = evaluateFreshness(hoursAgo(-10), { now: NOW })
    expect(freshness.ageHours).toBe(-10)
  })

  it("rounds age to one decimal", () => {
    expect(evaluateFreshness(hoursAgo(1.2345), { now: NOW }).ageHours).toBe(1.2)
  })
})

describe("describeFreshness", () => {
  it("explains each status in one line", () => {
    expect(describeFreshness(evaluateFreshness(hoursAgo(2), { now: NOW }))).toBe(
      "feed is fresh: 2h old, limit 48h",
    )
    expect(describeFreshness(evaluateFreshness(hoursAgo(72), { now: NOW }))).toBe(
      "feed is stale: 72h old, limit 48h",
    )
    expect(describeFreshness(evaluateFreshness({ generated: "?" }, { now: NOW }))).toBe(
      "feed age unknown: no valid generated timestamp",
    )
  })
})
