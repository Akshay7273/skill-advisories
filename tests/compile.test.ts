import { describe, expect, it } from "vitest"
import { buildFeed } from "../src/compile.js"
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
})
