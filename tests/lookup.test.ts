import { describe, expect, it } from "vitest"
import { buildFeed } from "../src/compile.js"
import { loadAdvisories } from "../src/load.js"
import { loadFeed, matchNames } from "../src/lookup.js"

describe("advisory lookup", () => {
  it("loads a feed from a local file", async () => {
    const feed = await loadFeed("feed/feed.json")
    expect(feed.advisory_count).toBeGreaterThan(0)
  })

  it("matches known-bad skill names case-insensitively", async () => {
    const loaded = await loadAdvisories("advisories")
    const { feed } = buildFeed(loaded.map((l) => l.advisory))
    const matches = matchNames(feed, ["OMNICOGG"])
    expect(matches).toHaveLength(1)
    expect(matches[0].advisory.id).toBe("SKA-2026-0008")
  })

  it("returns no matches for clean names", async () => {
    const loaded = await loadAdvisories("advisories")
    const { feed } = buildFeed(loaded.map((l) => l.advisory))
    expect(matchNames(feed, ["definitely-not-a-real-skill"])).toHaveLength(0)
  })
})
