import { describe, expect, it } from "vitest"
import { buildFeed, compilationGeneratedAt } from "../src/compile.js"
import { loadAdvisories } from "../src/load.js"

describe("feed compiler", () => {
  it("excludes test advisories from the feed and index", async () => {
    const loaded = await loadAdvisories("advisories")
    const { feed, index } = buildFeed(loaded.map((l) => l.advisory))
    expect(feed.advisories.some((a) => a.type === "test")).toBe(false)
    expect(index["claude-skill:ska-test-artifact"]).toBeUndefined()
  })

  it("indexes artifacts by lowercased ecosystem:name", async () => {
    const loaded = await loadAdvisories("fixtures/valid")
    const { feed, index } = buildFeed(loaded.map((l) => l.advisory))
    expect(feed.advisory_count).toBe(1)
    expect(index["claude-skill:fixture-skill-one"]).toEqual(["SKA-2026-9901"])
    expect(index["clawhub:fixture-skill-two"]).toEqual(["SKA-2026-9901"])
  })

  it("keeps unchanged rebuilds stable but permits a freshness publication", async () => {
    const loaded = await loadAdvisories("fixtures/valid")
    const advisories = loaded.map((entry) => entry.advisory)
    const previous = buildFeed(advisories, new Date("2026-08-01T00:00:00.000Z")).feed
    const next = buildFeed(advisories, new Date("2026-08-02T00:00:00.000Z")).feed

    expect(compilationGeneratedAt(next, previous)).toBe(previous.generated)
    expect(compilationGeneratedAt(next, previous, true)).toBe(next.generated)
  })
})
