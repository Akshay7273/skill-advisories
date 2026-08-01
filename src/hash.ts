import { createHash } from "node:crypto"
import { createReadStream, promises as fs } from "node:fs"
import path from "node:path"
import { mapConcurrent, positiveInteger } from "./concurrency.js"

export const MAX_HASHABLE_FILE_BYTES = 10 * 1024 * 1024 // 10 MiB
export const MAX_HASHED_FILES = 10_000
export const MAX_HASHED_BYTES = 256 * 1024 * 1024 // 256 MiB per artifact
export const DEFAULT_HASH_CONCURRENCY = 4

export type HashOptions = {
  concurrency?: number
  maxFileBytes?: number
  maxFiles?: number
  maxTotalBytes?: number
  /** Directory basenames to skip. Matching is exact and case-sensitive. */
  excludeDirectories?: string[]
}

export type HashedFile = {
  /** Path relative to the skill directory. */
  file: string
  sha256: string
  bytes?: number
}

export type HashStats = {
  discoveredFiles: number
  hashedFiles: number
  hashedBytes: number
  skippedLargeFiles: number
  skippedBudgetFiles: number
  skippedSymlinks: number
  skippedExcludedDirectories: number
  unreadableEntries: number
  budgetExhausted: boolean
}

export type HashDirectoryResult = {
  files: HashedFile[]
  stats: HashStats
}

type Candidate = { fullPath: string; relativePath: string; bytes: number }

function boundedBytes(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`)
  }
  return value
}

/** Hash a file as a stream so file size does not become process memory usage. */
export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest("hex")
}

/**
 * Recursively hash regular files with explicit concurrency and resource limits.
 * Symlinks are never followed. Unreadable entries are counted and skipped so a
 * local scan cannot crash because one artifact is malformed.
 */
export async function hashSkillDirDetailed(
  dir: string,
  options: HashOptions = {},
): Promise<HashDirectoryResult> {
  const concurrency = positiveInteger(options.concurrency ?? DEFAULT_HASH_CONCURRENCY, "concurrency")
  const maxFileBytes = boundedBytes(
    options.maxFileBytes ?? MAX_HASHABLE_FILE_BYTES,
    "maxFileBytes",
  )
  const maxFiles = positiveInteger(options.maxFiles ?? MAX_HASHED_FILES, "maxFiles")
  const maxTotalBytes = boundedBytes(options.maxTotalBytes ?? MAX_HASHED_BYTES, "maxTotalBytes")
  const excluded = new Set(options.excludeDirectories ?? [])
  const candidates: Candidate[] = []
  const stats: HashStats = {
    discoveredFiles: 0,
    hashedFiles: 0,
    hashedBytes: 0,
    skippedLargeFiles: 0,
    skippedBudgetFiles: 0,
    skippedSymlinks: 0,
    skippedExcludedDirectories: 0,
    unreadableEntries: 0,
    budgetExhausted: false,
  }
  let reservedBytes = 0

  async function walk(current: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      stats.unreadableEntries++
      return
    }
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isSymbolicLink()) {
        stats.skippedSymlinks++
      } else if (entry.isDirectory()) {
        if (excluded.has(entry.name)) {
          stats.skippedExcludedDirectories++
        } else {
          await walk(fullPath)
        }
      } else if (entry.isFile()) {
        stats.discoveredFiles++
        let bytes: number
        try {
          bytes = (await fs.stat(fullPath)).size
        } catch {
          stats.unreadableEntries++
          continue
        }
        if (bytes > maxFileBytes) {
          stats.skippedLargeFiles++
          continue
        }
        if (candidates.length >= maxFiles || reservedBytes + bytes > maxTotalBytes) {
          stats.skippedBudgetFiles++
          stats.budgetExhausted = true
          continue
        }
        reservedBytes += bytes
        candidates.push({ fullPath, relativePath: path.relative(dir, fullPath), bytes })
      }
    }
  }

  await walk(dir)
  const hashed = await mapConcurrent<Candidate, HashedFile | null>(
    candidates,
    concurrency,
    async (candidate) => {
      try {
        return {
          file: candidate.relativePath,
          sha256: await sha256File(candidate.fullPath),
          bytes: candidate.bytes,
        } satisfies HashedFile
      } catch {
        stats.unreadableEntries++
        return null
      }
    },
  )
  const files = hashed.filter((value): value is HashedFile => value !== null)
  stats.hashedFiles = files.length
  stats.hashedBytes = files.reduce((total, file) => total + (file.bytes ?? 0), 0)
  return { files, stats }
}

/**
 * Reduce a set of hashed files to one digest identifying the directory's
 * contents.
 *
 * Entries are sorted by path and separators normalised to `/` first, so the
 * result depends only on which files exist and what they contain — not on
 * readdir order, and not on whether the scan ran on Windows or POSIX. The line
 * format matches `sha256sum`, the same convention `feed/checksums.txt` uses.
 *
 * Callers must not treat this as a complete identity when the producing scan
 * reported `budgetExhausted`: a digest over a truncated file set names a subset
 * of the artifact, and comparing it to a full one reports drift that is really
 * a difference in how much was read.
 */
export function artifactDigest(files: HashedFile[]): string {
  const hash = createHash("sha256")
  const lines = files
    .map((file) => ({ path: file.file.replaceAll("\\", "/"), sha256: file.sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path))
  for (const line of lines) hash.update(`${line.sha256}  ${line.path}\n`)
  return hash.digest("hex")
}

/** Backward-compatible compact hash API. */
export async function hashSkillDir(
  dir: string,
  options: HashOptions = {},
): Promise<HashedFile[]> {
  const result = await hashSkillDirDetailed(dir, options)
  return result.files.map(({ file, sha256 }) => ({ file, sha256 }))
}
