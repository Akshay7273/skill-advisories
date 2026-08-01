import { readFile } from "node:fs/promises"
import * as z from "zod/v4"
import { DEFAULT_MAX_FEED_AGE_HOURS } from "./freshness.js"
import type { ArtifactAssessment } from "./intelligence.js"
import type { LockDrift } from "./lock.js"
import { meetsThreshold } from "./sarif.js"
import { ECOSYSTEMS } from "./types.js"

export const AdvisoryPolicySchema = z
  .object({
    $schema: z.string().url().optional(),
    schemaVersion: z.literal("1"),
    failOn: z.enum(["low", "medium", "high", "critical"]).default("high"),
    deniedEcosystems: z.array(z.enum(ECOSYSTEMS)).default([]),
    requireHash: z.boolean().default(false),
    warnings: z.enum(["allow", "review", "block"]).default("review"),
    // What to do about an installed artifact the lockfile never approved.
    // Defaults to review rather than block so a repository can adopt a lockfile
    // without its next unrelated pull request failing on artifacts that were
    // already there and were never in question.
    unlockedArtifacts: z.enum(["allow", "review", "block"]).default("review"),
    // How old the feed may be before this repo stops trusting it. Owned by the
    // policy rather than the caller so the rule travels with the repo instead
    // of living in whichever CI invocation happens to run the check.
    maxFeedAgeHours: z.number().int().positive().default(DEFAULT_MAX_FEED_AGE_HOURS),
  })
  .strict()

export type AdvisoryPolicy = z.infer<typeof AdvisoryPolicySchema>

export type PolicyDecision = {
  decision: "allow" | "review" | "block"
  reasons: string[]
  policy: AdvisoryPolicy
}

export function parsePolicy(input: unknown): AdvisoryPolicy {
  return AdvisoryPolicySchema.parse(input)
}

export async function loadPolicy(path: string): Promise<AdvisoryPolicy> {
  const raw = await readFile(path, "utf8")
  try {
    return parsePolicy(JSON.parse(raw))
  } catch (error) {
    throw new Error(`invalid advisory policy ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function evaluatePolicy(
  assessment: ArtifactAssessment,
  policy: AdvisoryPolicy,
): PolicyDecision {
  const reasons: string[] = []
  const ecosystem = assessment.query.ecosystem
  if (ecosystem && policy.deniedEcosystems.includes(ecosystem)) {
    reasons.push(`ecosystem ${ecosystem} is denied by policy`)
  }
  if (policy.requireHash && !assessment.query.sha256) {
    reasons.push("a SHA-256 artifact identity is required by policy")
  }
  for (const match of assessment.matches) {
    if (meetsThreshold(match.severity, policy.failOn)) {
      reasons.push(`${match.id} has ${match.severity} severity (policy threshold: ${policy.failOn})`)
    }
  }
  if (reasons.length > 0) return { decision: "block", reasons, policy }

  if (assessment.warnings.length > 0 && policy.warnings !== "allow") {
    return {
      decision: policy.warnings,
      reasons: ["artifact name resembles a known advisory identity"],
      policy,
    }
  }
  return { decision: "allow", reasons: [], policy }
}

/**
 * Turn a lockfile comparison into a decision.
 *
 * Three of the four drift categories are treated alike, under one policy key,
 * because they are one question asked from different angles: is something
 * installed here that this repository did not approve? An artifact with no
 * lock entry was never approved; an artifact whose digest moved is no longer
 * the thing that was approved; and an artifact the scan could not finish
 * hashing cannot be shown to be either. That last one follows the same
 * fail-closed rule the scanner already applies to exhausted budgets -- a
 * resource limit must not read as a clean result.
 *
 * Missing artifacts are reported by the caller but never fail. A lockfile
 * describes what is allowed, not what is required, and the common cause of a
 * missing entry is a developer machine with a smaller install set than the one
 * the lock was generated on.
 */
export function evaluateLockDrift(drift: LockDrift, policy: AdvisoryPolicy): PolicyDecision {
  if (policy.unlockedArtifacts === "allow") return { decision: "allow", reasons: [], policy }

  const reasons: string[] = []
  for (const entry of drift.changed) {
    reasons.push(`${entry.key} does not match its approved contents (expected ${entry.expected})`)
  }
  for (const entry of drift.unlocked) {
    reasons.push(`${entry.key} is installed but not approved by the lockfile`)
  }
  for (const entry of drift.indeterminate) {
    reasons.push(`${entry.key} could not be compared to the lockfile: ${entry.reason}`)
  }
  if (reasons.length === 0) return { decision: "allow", reasons: [], policy }
  return { decision: policy.unlockedArtifacts, reasons, policy }
}
