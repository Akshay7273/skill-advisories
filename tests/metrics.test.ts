import { describe, expect, it } from "vitest"
import {
  EMPTY_METRICS,
  type MetricsEntry,
  appendMetrics,
  latestMetrics,
  parseMetricsHistory,
  verifyMetricsChain,
} from "../src/metrics.js"

function collection(collected: string, downloads: number | null = 823): MetricsEntry {
  return {
    collected,
    source_commit: "6205aef",
    signals: {
      npm_downloads_last_month: {
        value: downloads,
        source: "https://api.npmjs.org/downloads/point/last-month/@akshay7273/skill-advisories",
      },
      registry_dependents: {
        value: 0,
        source: "https://registry.npmjs.org/-/v1/search",
      },
    },
  }
}

const collect = (history = EMPTY_METRICS, ...entries: MetricsEntry[]) =>
  entries.reduce(appendMetrics, history)

describe("readiness metrics", () => {
  it("appends each collection in order", () => {
    const history = collect(
      EMPTY_METRICS,
      collection("2026-07-01T00:00:00.000Z"),
      collection("2026-08-01T00:00:00.000Z"),
    )
    expect(history.entries).toHaveLength(2)
    expect(latestMetrics(history)?.collected).toBe("2026-08-01T00:00:00.000Z")
    expect(parseMetricsHistory(history)).toEqual(history)
  })

  it("replaces a collection taken the same day rather than duplicating it", () => {
    // The realistic case: the first run of the day hit a rate limit and
    // recorded null, and the re-run got the number.
    const history = collect(
      EMPTY_METRICS,
      collection("2026-08-01T02:00:00.000Z", null),
      collection("2026-08-01T09:30:00.000Z", 823),
    )
    expect(history.entries).toHaveLength(1)
    expect(latestMetrics(history)?.signals.npm_downloads_last_month?.value).toBe(823)
    expect(latestMetrics(history)?.collected).toBe("2026-08-01T09:30:00.000Z")
  })

  it("rejects a collection that predates the last one", () => {
    const history = collect(EMPTY_METRICS, collection("2026-08-01T00:00:00.000Z"))
    expect(() => appendMetrics(history, collection("2026-07-01T00:00:00.000Z"))).toThrow(
      "predates the last collection",
    )
  })

  it("distinguishes an unreachable source from a measured zero", () => {
    const history = collect(EMPTY_METRICS, collection("2026-08-01T00:00:00.000Z", null))
    const signals = latestMetrics(history)!.signals
    expect(signals.npm_downloads_last_month?.value).toBeNull()
    expect(signals.registry_dependents?.value).toBe(0)
  })

  it("accepts an internally consistent log", () => {
    const history = collect(
      EMPTY_METRICS,
      collection("2026-06-01T00:00:00.000Z"),
      collection("2026-07-01T00:00:00.000Z"),
    )
    expect(verifyMetricsChain(history)).toEqual([])
    expect(verifyMetricsChain(EMPTY_METRICS)).toEqual([])
  })

  it("detects a log reordered into the past", () => {
    const problems = verifyMetricsChain({
      schema_version: "1",
      entries: [collection("2026-08-01T00:00:00.000Z"), collection("2026-07-01T00:00:00.000Z")],
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("predates entry 0")
  })

  it("detects two collections claiming the same day", () => {
    // appendMetrics cannot produce this, but an edited file can, and a day
    // recorded twice is a day whose value nobody can look up.
    const problems = verifyMetricsChain({
      schema_version: "1",
      entries: [collection("2026-08-01T00:00:00.000Z"), collection("2026-08-01T12:00:00.000Z")],
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("a collection for 2026-08-01 already exists")
  })

  it("detects an unparseable timestamp", () => {
    const problems = verifyMetricsChain({
      schema_version: "1",
      entries: [collection("not-a-date")],
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("is not a valid timestamp")
  })

  it("rejects a malformed log", () => {
    expect(() => parseMetricsHistory({ schema_version: "2", entries: [] })).toThrow()
    expect(() => parseMetricsHistory({ schema_version: "1" })).toThrow()
    // A signal without its source is a number nobody can re-derive.
    expect(() =>
      parseMetricsHistory({
        schema_version: "1",
        entries: [
          {
            collected: "2026-08-01T00:00:00.000Z",
            source_commit: "6205aef",
            signals: { npm_downloads_last_month: { value: 823 } },
          },
        ],
      }),
    ).toThrow()
    // A missing value must be an explicit null, not an absent key.
    expect(() =>
      parseMetricsHistory({
        schema_version: "1",
        entries: [
          {
            collected: "2026-08-01T00:00:00.000Z",
            source_commit: "6205aef",
            signals: { npm_downloads_last_month: { source: "https://example.test" } },
          },
        ],
      }),
    ).toThrow()
  })

  it("returns nothing as the latest collection of an empty log", () => {
    expect(latestMetrics(EMPTY_METRICS)).toBeUndefined()
  })
})
