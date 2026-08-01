import { describe, expect, it } from "vitest"
import { DEFAULT_MAX_FEED_AGE_HOURS } from "../src/freshness.js"
import type { ArtifactAssessment } from "../src/intelligence.js"
import type { LockDrift } from "../src/lock.js"
import { evaluateLockDrift, evaluatePolicy, loadPolicy, parsePolicy } from "../src/policy.js"

const safeAssessment: ArtifactAssessment = {
  status: "no-known-advisory",
  query: { name: "example", ecosystem: "npm", sha256: "a".repeat(64) },
  matches: [],
  warnings: [],
  disclaimer: "No known advisory is not proof of safety.",
}

describe("advisory policy", () => {
  it("loads the checked-in reference policy", async () => {
    await expect(loadPolicy("examples/policy.json")).resolves.toMatchObject({
      schemaVersion: "1",
      failOn: "high",
    })
  })

  it("applies safe defaults and rejects unknown keys", () => {
    expect(parsePolicy({ schemaVersion: "1" })).toEqual({
      schemaVersion: "1",
      failOn: "high",
      deniedEcosystems: [],
      requireHash: false,
      warnings: "review",
      unlockedArtifacts: "review",
      maxFeedAgeHours: DEFAULT_MAX_FEED_AGE_HOURS,
    })
    expect(() => parsePolicy({ schemaVersion: "1", typo: true })).toThrow()
  })

  it("accepts a repo-specific feed age limit and rejects unusable ones", () => {
    expect(parsePolicy({ schemaVersion: "1", maxFeedAgeHours: 6 }).maxFeedAgeHours).toBe(6)
    expect(() => parsePolicy({ schemaVersion: "1", maxFeedAgeHours: 0 })).toThrow()
    expect(() => parsePolicy({ schemaVersion: "1", maxFeedAgeHours: -1 })).toThrow()
    expect(() => parsePolicy({ schemaVersion: "1", maxFeedAgeHours: 1.5 })).toThrow()
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

const digest = (value: string) => value.repeat(64).slice(0, 64)

function drift(overrides: Partial<LockDrift> = {}): LockDrift {
  return {
    unlocked: [],
    changed: [],
    missing: [],
    indeterminate: [],
    matched: [],
    ...overrides,
  }
}

describe("lock drift policy", () => {
  const clean = drift({ matched: ["claude-skill:alpha"] })
  const unapproved = drift({ unlocked: [{ key: "claude-skill:gamma", sha256: digest("c") }] })

  it("allows a scan that matches the lockfile under every setting", () => {
    for (const unlockedArtifacts of ["allow", "review", "block"]) {
      const policy = parsePolicy({ schemaVersion: "1", unlockedArtifacts })
      expect(evaluateLockDrift(clean, policy).decision).toBe("allow")
    }
  })

  it("carries drift to the configured decision, not a fixed one", () => {
    for (const unlockedArtifacts of ["review", "block"] as const) {
      const policy = parsePolicy({ schemaVersion: "1", unlockedArtifacts })
      expect(evaluateLockDrift(unapproved, policy).decision).toBe(unlockedArtifacts)
    }
    const permissive = parsePolicy({ schemaVersion: "1", unlockedArtifacts: "allow" })
    const decision = evaluateLockDrift(unapproved, permissive)
    expect(decision.decision).toBe("allow")
    expect(decision.reasons).toEqual([])
  })

  it("names the approved digest when contents no longer match", () => {
    const policy = parsePolicy({ schemaVersion: "1", unlockedArtifacts: "block" })
    const changed = drift({
      changed: [{ key: "claude-skill:alpha", expected: digest("a"), actual: digest("z") }],
    })
    const decision = evaluateLockDrift(changed, policy)
    expect(decision.decision).toBe("block")
    expect(decision.reasons).toEqual([
      `claude-skill:alpha does not match its approved contents (expected ${digest("a")})`,
    ])
  })

  it("fails closed when a budget stopped the comparison short", () => {
    const policy = parsePolicy({ schemaVersion: "1", unlockedArtifacts: "block" })
    const truncated = drift({
      indeterminate: [{ key: "claude-skill:alpha", reason: "budgets stopped the hash short" }],
    })
    const decision = evaluateLockDrift(truncated, policy)
    expect(decision.decision).toBe("block")
    expect(decision.reasons[0]).toContain("could not be compared to the lockfile")
  })

  it("never fails on an approved artifact this machine has not installed", () => {
    const policy = parsePolicy({ schemaVersion: "1", unlockedArtifacts: "block" })
    const absent = drift({ missing: [{ key: "claude-skill:beta", sha256: digest("b") }] })
    expect(evaluateLockDrift(absent, policy)).toMatchObject({ decision: "allow", reasons: [] })
  })
})
