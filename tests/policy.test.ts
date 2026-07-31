import { describe, expect, it } from "vitest"
import type { ArtifactAssessment } from "../src/intelligence.js"
import { evaluatePolicy, parsePolicy } from "../src/policy.js"

const safeAssessment: ArtifactAssessment = {
  status: "no-known-advisory",
  query: { name: "example", ecosystem: "npm", sha256: "a".repeat(64) },
  matches: [],
  warnings: [],
  disclaimer: "No known advisory is not proof of safety.",
}

describe("advisory policy", () => {
  it("applies safe defaults and rejects unknown keys", () => {
    expect(parsePolicy({ schemaVersion: "1" })).toEqual({
      schemaVersion: "1",
      failOn: "high",
      deniedEcosystems: [],
      requireHash: false,
      warnings: "review",
    })
    expect(() => parsePolicy({ schemaVersion: "1", typo: true })).toThrow()
  })

  it("allows an artifact with no policy violation", () => {
    const policy = parsePolicy({ schemaVersion: "1" })
    expect(evaluatePolicy(safeAssessment, policy).decision).toBe("allow")
  })

  it("blocks threshold advisories and denied ecosystems", () => {
    const policy = parsePolicy({ schemaVersion: "1", deniedEcosystems: ["npm"] })
    const assessment: ArtifactAssessment = {
      ...safeAssessment,
      status: "known-risk",
      matches: [
        {
          id: "SKA-TEST",
          severity: "critical",
          type: "malicious",
          summary: "test",
          matchedBy: "name",
          references: [],
        },
      ],
    }
    const decision = evaluatePolicy(assessment, policy)
    expect(decision.decision).toBe("block")
    expect(decision.reasons).toHaveLength(2)
  })

  it("requires immutable identity when configured", () => {
    const policy = parsePolicy({ schemaVersion: "1", requireHash: true })
    const assessment = { ...safeAssessment, query: { name: "example", ecosystem: "npm" as const } }
    expect(evaluatePolicy(assessment, policy).reasons[0]).toContain("SHA-256")
  })
})
