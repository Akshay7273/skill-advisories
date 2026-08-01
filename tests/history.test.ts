import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import type { Feed } from "../src/compile.js"
import { feedCursor } from "../src/delta.js"
import {
  EMPTY_HISTORY,
  appendHistory,
  historyEntry,
  parseFeedHistory,
  verifyFeedAgainstHistory,
  verifyHistoryChain,
} from "../src/history.js"

function feed(ids: string[], generated = "2026-01-01T00:00:00.000Z"): Feed {
  return {
    schema_version: "1",
    name: "test",
    source: "test",
    generated,
    advisory_count: ids.length,
    advisories: ids.map((id) => ({
      schema_version: "1",
      id,
      type: "malicious",
      summary: id,
      severity: "high",
      artifacts: [{ ecosystem: "npm", name: id.toLowerCase() }],
      references: [{ type: "WEB", url: "https://example.test" }],
      published: "2026-01-01T00:00:00Z",
      modified: "2026-01-01T00:00:00Z",
    })) as Feed["advisories"],
  }
}

const digestOf = (value: Feed) =>
  createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`).digest("hex")

function publish(history = EMPTY_HISTORY, ...feeds: Feed[]) {
  return feeds.reduce(
    (log, next) => appendHistory(log, historyEntry(next, digestOf(next))),
    history,
  )
}

describe("feed history", () => {
  it("records the cursor, timestamp, count, and digest of a published feed", () => {
    const current = feed(["SKA-A"])
    const entry = historyEntry(current, digestOf(current))
    expect(entry).toEqual({
      cursor: feedCursor(current),
      generated: "2026-01-01T00:00:00.000Z",
      advisory_count: 1,
      digest: digestOf(current),
    })
  })

  it("appends each new published state in order", () => {
    const first = feed(["SKA-A"])
    const second = feed(["SKA-A", "SKA-B"], "2026-02-01T00:00:00.000Z")
    const history = publish(EMPTY_HISTORY, first, second)
    expect(history.entries.map((entry) => entry.advisory_count)).toEqual([1, 2])
    expect(parseFeedHistory(history)).toEqual(history)
  })

  it("treats republishing identical bytes as a no-op", () => {
    const current = feed(["SKA-A"])
    const once = publish(EMPTY_HISTORY, current)
    expect(publish(once, current)).toEqual(once)
  })

  it("rejects the same cursor republished with different bytes", () => {
    const current = feed(["SKA-A"])
    const history = publish(EMPTY_HISTORY, current)
    expect(() => appendHistory(history, historyEntry(current, "b".repeat(64)))).toThrow(
      "was published with digest",
    )
  })

  it("rejects a cursor reappearing after a later state", () => {
    const first = feed(["SKA-A"])
    const second = feed(["SKA-A", "SKA-B"], "2026-02-01T00:00:00.000Z")
    const history = publish(EMPTY_HISTORY, first, second)
    expect(() => appendHistory(history, historyEntry(first, digestOf(first)))).toThrow(
      "already published",
    )
  })

  it("rejects an entry that predates the last published state", () => {
    const later = feed(["SKA-A"], "2026-03-01T00:00:00.000Z")
    const earlier = feed(["SKA-B"], "2026-01-01T00:00:00.000Z")
    const history = publish(EMPTY_HISTORY, later)
    expect(() => appendHistory(history, historyEntry(earlier, digestOf(earlier)))).toThrow(
      "predates the last published",
    )
  })

  it("accepts an internally consistent chain", () => {
    const history = publish(
      EMPTY_HISTORY,
      feed(["SKA-A"]),
      feed(["SKA-A", "SKA-B"], "2026-02-01T00:00:00.000Z"),
    )
    expect(verifyHistoryChain(history)).toEqual([])
    expect(verifyHistoryChain(EMPTY_HISTORY)).toEqual([])
  })

  it("detects a duplicated cursor in a rewritten chain", () => {
    const current = feed(["SKA-A"])
    const entry = historyEntry(current, digestOf(current))
    const problems = verifyHistoryChain({ schema_version: "1", entries: [entry, entry] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("appears more than once")
  })

  it("detects a chain reordered into the past", () => {
    const later = feed(["SKA-A"], "2026-03-01T00:00:00.000Z")
    const earlier = feed(["SKA-B"], "2026-01-01T00:00:00.000Z")
    const problems = verifyHistoryChain({
      schema_version: "1",
      entries: [historyEntry(later, digestOf(later)), historyEntry(earlier, digestOf(earlier))],
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("predates entry 0")
  })

  it("verifies a published feed against its history", () => {
    const current = feed(["SKA-A"])
    const history = publish(EMPTY_HISTORY, current)
    expect(verifyFeedAgainstHistory(current, history, digestOf(current))).toEqual([])
  })

  it("rejects a feed that was never published", () => {
    const history = publish(EMPTY_HISTORY, feed(["SKA-A"]))
    const forged = feed(["SKA-EVIL"], "2026-02-01T00:00:00.000Z")
    const problems = verifyFeedAgainstHistory(forged, history, digestOf(forged))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("does not appear in the published history")
  })

  it("rejects a known cursor served with altered bytes", () => {
    const current = feed(["SKA-A"])
    const history = publish(EMPTY_HISTORY, current)
    const problems = verifyFeedAgainstHistory(current, history, "c".repeat(64))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("does not match published")
  })

  it("rejects metadata rewritten around an unchanged advisory set", () => {
    const current = feed(["SKA-A"])
    const history = publish(EMPTY_HISTORY, current)
    // The cursor covers the whole feed object, so a rewritten count or
    // timestamp is normally caught by the lookup failing. Simulate a history
    // rewritten to keep the cursor while claiming different metadata.
    const tampered = {
      schema_version: "1" as const,
      entries: [{ ...history.entries[0]!, advisory_count: 99, generated: "2026-06-01T00:00:00.000Z" }],
    }
    const problems = verifyFeedAgainstHistory(current, tampered, digestOf(current))
    expect(problems).toHaveLength(2)
    expect(problems.join(" ")).toContain("advisory count 1")
  })

  it("rejects a malformed history document", () => {
    expect(() => parseFeedHistory({ schema_version: "2", entries: [] })).toThrow()
    expect(() =>
      parseFeedHistory({
        schema_version: "1",
        entries: [{ cursor: "short", generated: "x", advisory_count: 1, digest: "a".repeat(64) }],
      }),
    ).toThrow()
  })
})
