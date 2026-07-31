import { beforeAll, describe, expect, it } from "vitest"
import type { Feed } from "../src/compile.js"
import { buildFeed } from "../src/compile.js"
import { assessArtifact, searchAdvisories } from "../src/intelligence.js"
import { loadAdvisories } from "../src/load.js"

let feed: Feed

beforeAll(async () => {
  const loaded = await loadAdvisories("advisories")
  feed = buildFeed(loaded.map(({ advisory }) => advisory)).feed
})

describe("artifact intelligence", () => {
  it("reports an exact known risk with its public evidence", () => {
    const assessment = assessArtifact(feed, { name: "omnicogg", ecosystem: "clawhub" })
    expect(assessment.status).toBe("known-risk")
    expect(assessment.matches[0]).toMatchObject({ id: "SKA-2026-0008", matchedBy: "name" })
    expect(assessment.matches[0].references.length).toBeGreaterThan(0)
  })

  it("does not flag a version outside an advisory's affected set", () => {
    const assessment = assessArtifact(feed, { name: "rankaj", version: "2.0.0" })
    expect(assessment.status).not.toBe("known-risk")
    expect(assessment.matches).toEqual([])
  })

  it("asks for review when a name resembles a known malicious artifact", () => {
    const assessment = assessArtifact(feed, { name: "omnicog" })
    expect(assessment.status).toBe("review")
    expect(assessment.warnings).toContainEqual({ similarTo: "omnicogg", distance: 1 })
  })

  it("states that an absent advisory does not prove safety", () => {
    const assessment = assessArtifact(feed, { name: "original-example-artifact" })
    expect(assessment.status).toBe("no-known-advisory")
    expect(assessment.disclaimer).toContain("not proof of safety")
  })

  it("searches by ecosystem, severity, and text with a bounded limit", () => {
    const results = searchAdvisories(feed, {
      query: "credential",
      ecosystem: "clawhub",
      severity: "critical",
      limit: 2,
    })
    expect(results.length).toBeLessThanOrEqual(2)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((advisory) => advisory.severity === "critical")).toBe(true)
  })
})
