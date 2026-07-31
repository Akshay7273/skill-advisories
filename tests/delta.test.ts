import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import type { Feed } from "../src/compile.js"
import { applyFeedDelta, buildCompactFeed, buildFeedDelta, feedCursor } from "../src/delta.js"

function feed(advisories: any[], generated = "2026-01-01T00:00:00.000Z"): Feed {
  return {
    schema_version: "1",
    name: "test",
    source: "test",
    generated,
    advisory_count: advisories.length,
    advisories,
  }
}

const advisory = (id: string, severity = "high") => ({
  schema_version: "1",
  id,
  type: "malicious",
  summary: id,
  severity,
  artifacts: [{ ecosystem: "npm", name: id.toLowerCase() }],
  references: [{ type: "WEB", url: "https://example.test" }],
  published: "2026-01-01T00:00:00Z",
  modified: "2026-01-01T00:00:00Z",
})

describe("incremental feeds", () => {
  it("validates the published delta against its public schema", async () => {
    const ajv = new Ajv2020({ allErrors: true })
    addFormats(ajv)
    ajv.addSchema(JSON.parse(await readFile("schema/advisory.schema.json", "utf8")))
    const validate = ajv.compile(JSON.parse(await readFile("schema/delta.schema.json", "utf8")))
    expect(validate(JSON.parse(await readFile("feed/delta.json", "utf8"))), ajv.errorsText(validate.errors)).toBe(true)
  })

  it("round-trips additions, changes, and removals with verified cursors", () => {
    const previous = feed([advisory("SKA-A"), advisory("SKA-B")])
    const current = feed(
      [advisory("SKA-A", "critical"), advisory("SKA-C")],
      "2026-02-01T00:00:00.000Z",
    )
    const delta = buildFeedDelta(previous, current)
    expect(delta.upserts.map(({ id }) => id)).toEqual(["SKA-A", "SKA-C"])
    expect(delta.removed).toEqual(["SKA-B"])
    expect(applyFeedDelta(previous, delta)).toEqual(current)
  })

  it("rejects a delta for a different local cursor", () => {
    const previous = feed([advisory("SKA-A")])
    const delta = buildFeedDelta(previous, feed([advisory("SKA-B")]))
    expect(() => applyFeedDelta(feed([]), delta)).toThrow("cursor")
  })

  it("builds a smaller feed with matching identity cursor", () => {
    const source = feed([advisory("SKA-A")])
    const compact = buildCompactFeed(source)
    expect(compact.cursor).toBe(feedCursor(source))
    expect(compact.advisories[0]).not.toHaveProperty("summary")
  })
})
