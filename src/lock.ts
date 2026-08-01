import * as z from "zod/v4"
import type { ScannedArtifact } from "./scan.js"
import { ECOSYSTEMS } from "./types.js"

/**
 * One artifact a repository has approved, identified by what it is rather than
 * by where it happens to be installed.
 *
 * The install path is deliberately not recorded. A lockfile is committed and
 * shared, and paths are the one property of a scan that differs on every
 * machine; keying on them would make the file report drift for two checkouts
 * of the same approved set. `files` is informational — the digest already
 * covers it — but it makes a drift report legible without a second scan.
 */
export const LockedArtifactSchema = z
  .object({
    name: z.string().min(1),
    ecosystem: z.enum(ECOSYSTEMS).optional(),
    version: z.string().min(1).optional(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    files: z.number().int().nonnegative(),
  })
  .strict()

export const ArtifactLockSchema = z
  .object({
    $schema: z.string().url().optional(),
    schema_version: z.literal("1"),
    generated: z.string().min(1),
    artifacts: z.array(LockedArtifactSchema),
  })
  .strict()

export type LockedArtifact = z.infer<typeof LockedArtifactSchema>
export type ArtifactLock = z.infer<typeof ArtifactLockSchema>

export const LOCK_FILE_NAME = "skill-advisories.lock.json"

export function parseArtifactLock(input: unknown): ArtifactLock {
  return ArtifactLockSchema.parse(input)
}

/**
 * Identity an artifact is tracked under. Ecosystem participates because the
 * same name means different things in different registries, but version does
 * not: an upgrade should read as the approved artifact having changed, which
 * is a fact worth surfacing, rather than as one artifact vanishing and an
 * unrelated one appearing.
 */
export function lockKey(artifact: { name: string; ecosystem?: string }): string {
  return artifact.ecosystem ? `${artifact.ecosystem}:${artifact.name}` : artifact.name
}

/**
 * Fields are emitted in the order `schema/lock.schema.json` declares them, so
 * the published schema, this module's parser, and this writer all agree on one
 * canonical form. A tool that implements the published schema faithfully then
 * produces a file this writer does not immediately reorder.
 */
function lockedFrom(artifact: ScannedArtifact): LockedArtifact {
  return {
    name: artifact.name,
    ...(artifact.ecosystem ? { ecosystem: artifact.ecosystem } : {}),
    ...(artifact.version ? { version: artifact.version } : {}),
    sha256: artifact.sha256,
    files: artifact.files,
  }
}

/**
 * The comparable form of a locked entry: its fields in a fixed order.
 *
 * Two lockfiles approving the same artifacts are the same approval whatever
 * order their keys happen to sit in, and key order is not something a caller
 * controls. `parseArtifactLock` returns fields in the order this module's
 * schema declares them, an editor or another tool writing the published schema
 * may use yet another, and neither matches the order `lockedFrom` builds. A
 * comparison over serialised bytes would read all of those as a changed
 * approval set.
 */
function comparable(artifact: LockedArtifact): string {
  return JSON.stringify([
    artifact.name,
    artifact.ecosystem ?? null,
    artifact.version ?? null,
    artifact.sha256,
    artifact.files,
  ])
}

function sameApprovals(left: LockedArtifact[], right: LockedArtifact[]): boolean {
  if (left.length !== right.length) return false
  // Both sides are already ordered by identity, so a positional walk is enough
  // and a differing order is a differing set.
  return left.every((artifact, index) => comparable(artifact) === comparable(right[index]))
}

/**
 * Build a lockfile from a scan's observations.
 *
 * Artifacts whose digest covers only part of their directory are rejected
 * rather than recorded: approving a subset of an artifact and calling it the
 * artifact is worse than having no lockfile, because every later check would
 * pass against a file set nobody ever looked at. Raise the scan's budgets and
 * run again.
 *
 * Passing the previous lock keeps `generated` stable when the approved set has
 * not changed, so re-running `lock` on an unchanged tree produces byte
 * identical output and CI can diff it. A `$schema` reference the previous file
 * carried is preserved: the published schema allows one, an editor uses it to
 * validate the file as it is edited, and dropping it on the next write would
 * take that away without saying so.
 */
export function buildLock(
  artifacts: ScannedArtifact[],
  generated: string,
  previous?: ArtifactLock,
): ArtifactLock {
  const incomplete = artifacts.filter((artifact) => artifact.incomplete)
  if (incomplete.length > 0) {
    throw new Error(
      `cannot lock ${incomplete.map((artifact) => artifact.name).join(", ")}: ` +
        "the scan's resource budgets stopped the hash short, so the digest covers " +
        "only part of the artifact",
    )
  }

  const byKey = new Map<string, LockedArtifact>()
  for (const artifact of artifacts) {
    const locked = lockedFrom(artifact)
    const key = lockKey(locked)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, locked)
      continue
    }
    // The same artifact installed in two skill directories is normal, and
    // locking it once is right. Two different things under one identity is
    // not: the lockfile could only approve one of them, silently.
    if (existing.sha256 !== locked.sha256) {
      throw new Error(
        `cannot lock ${key}: two installed copies differ (${existing.sha256} and ${locked.sha256})`,
      )
    }
  }

  const locked = [...byKey.values()].sort((left, right) =>
    lockKey(left).localeCompare(lockKey(right)),
  )
  const unchanged = previous !== undefined && sameApprovals(previous.artifacts, locked)
  return {
    ...(previous?.$schema ? { $schema: previous.$schema } : {}),
    schema_version: "1",
    generated: unchanged ? previous.generated : generated,
    artifacts: locked,
  }
}

export type LockDrift = {
  /** Observed on disk with no entry in the lockfile. */
  unlocked: Array<{ key: string; sha256: string }>
  /** Locked and present, but the contents are not what was approved. */
  changed: Array<{ key: string; expected: string; actual: string; version?: string }>
  /** Locked but not observed in the directories that were scanned. */
  missing: Array<{ key: string; sha256: string }>
  /**
   * Observed, but the scan's budgets truncated the hash, so neither agreement
   * nor drift can be claimed. Reported separately so a resource limit is never
   * mistaken for a clean result.
   */
  indeterminate: Array<{ key: string; reason: string }>
  /** Locked, observed, and unchanged. */
  matched: string[]
}

/**
 * Compare what is installed against what was approved.
 *
 * All four outcomes are reported together rather than stopping at the first,
 * because they mean different things to an operator: an unlocked artifact is
 * something nobody approved, a changed one is something that was approved and
 * has since been altered, and a missing one is usually just a machine with a
 * smaller install set. Deciding which of them is a failure belongs to policy,
 * not here.
 */
export function diffLock(lock: ArtifactLock, observed: ScannedArtifact[]): LockDrift {
  const drift: LockDrift = {
    unlocked: [],
    changed: [],
    missing: [],
    indeterminate: [],
    matched: [],
  }
  const locked = new Map(lock.artifacts.map((artifact) => [lockKey(artifact), artifact]))
  const seen = new Set<string>()

  for (const artifact of observed) {
    const key = lockKey(artifact)
    seen.add(key)
    const approved = locked.get(key)
    if (artifact.incomplete) {
      drift.indeterminate.push({
        key,
        reason: "the scan's resource budgets stopped the hash short",
      })
      continue
    }
    if (!approved) {
      drift.unlocked.push({ key, sha256: artifact.sha256 })
      continue
    }
    if (approved.sha256 !== artifact.sha256) {
      const changed: LockDrift["changed"][number] = {
        key,
        expected: approved.sha256,
        actual: artifact.sha256,
      }
      if (artifact.version) changed.version = artifact.version
      drift.changed.push(changed)
      continue
    }
    drift.matched.push(key)
  }

  for (const [key, artifact] of locked) {
    if (!seen.has(key)) drift.missing.push({ key, sha256: artifact.sha256 })
  }
  return drift
}

export type LockStatus = {
  /** Identity the lookup was made under. */
  key: string
  /**
   * `approved` -- the identity is locked and the supplied digest matches it.
   * `changed` -- locked, but the supplied digest is not the approved one.
   * `unapproved` -- no lock entry exists for this identity.
   * `unverified` -- locked, but no digest was supplied to compare against, so
   * only the name has been checked.
   */
  status: "approved" | "changed" | "unapproved" | "unverified"
  /** Digest the lockfile approves, when there is an entry at all. */
  approved?: string
  /** Version the lockfile recorded, informational. */
  version?: string
}

/**
 * Answer whether a lockfile approves an artifact, without touching the disk.
 *
 * This is the question a caller can ask before installing something, where the
 * scan-based comparison in `diffLock` cannot help because the artifact is not
 * installed yet. It therefore judges the identity and digest it is handed
 * rather than anything it reads.
 *
 * A name that is locked but supplied without a digest reports `unverified`
 * rather than `approved`. Names are not identities -- the entire reason the
 * lockfile stores digests is that the same name can carry different bytes --
 * and answering `approved` on a name alone would hand back the reassurance
 * without having done the check.
 */
export function lockStatus(
  lock: ArtifactLock,
  query: { name: string; ecosystem?: string; sha256?: string },
): LockStatus {
  const key = lockKey(query)
  const approved = lock.artifacts.find((artifact) => lockKey(artifact) === key)
  if (!approved) return { key, status: "unapproved" }

  const status = !query.sha256
    ? "unverified"
    : query.sha256.toLowerCase() === approved.sha256
      ? "approved"
      : "changed"
  return {
    key,
    status,
    approved: approved.sha256,
    ...(approved.version ? { version: approved.version } : {}),
  }
}
