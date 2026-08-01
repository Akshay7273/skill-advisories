import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import type { Feed } from "./compile.js"
import { buildCompactFeed, feedCursor } from "./delta.js"
import type { CompactFeed, FeedDelta } from "./delta.js"
import { evaluateFreshness } from "./freshness.js"
import type { Freshness } from "./freshness.js"
import { parseFeedHistory, verifyFeedAgainstHistory } from "./history.js"

export type VerifyOptions = {
  maxAgeHours?: number
  now?: number
}

export type VerifyResult = {
  /** Directory that was checked, as given by the caller. */
  dir: string
  /** SHA-256 of the exact `feed.json` bytes on disk. */
  digest: string
  cursor: string
  advisoryCount: number
  /** Number of `checksums.txt` entries that were read and compared. */
  checkedFiles: number
  freshness: Freshness
  /** Empty when the directory is a faithful copy of a published feed. */
  problems: string[]
}

/**
 * Raised when the directory cannot be inspected at all — no feed, no manifest,
 * a document that is not JSON. Distinct from a verification problem: nothing
 * was disproved, the check simply could not run.
 */
export class VerifyUnavailableError extends Error {}

async function read(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8")
  } catch (error) {
    throw new VerifyUnavailableError(
      `cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function parse<T>(raw: string, path: string): T {
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new VerifyUnavailableError(
      `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Read a file the manifest claims exists, returning `undefined` when it does
 * not. Only `feed.json` and `checksums.txt` are load-bearing enough to abort
 * on: they define what the directory claims to be. Anything else going missing
 * is a fact about this copy, so it is reported alongside the other findings
 * rather than cutting the run short and discarding them.
 */
async function readPublished(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return undefined
  }
}

const sha256 = (contents: string | Buffer) => createHash("sha256").update(contents).digest("hex")

/**
 * Parse a `checksums.txt` manifest into path/digest pairs. The format is the
 * one `sha256sum` emits: a lowercase hex digest, two spaces, then a path
 * relative to the manifest.
 */
export function parseChecksumManifest(contents: string): Map<string, string> {
  const entries = new Map<string, string>()
  for (const [position, line] of contents.split("\n").entries()) {
    if (line.trim() === "") continue
    const match = /^([a-f0-9]{64})\s\s(\S.*)$/.exec(line)
    if (!match) {
      throw new VerifyUnavailableError(`checksums.txt line ${position + 1} is malformed: ${line}`)
    }
    entries.set(match[2]!, match[1]!)
  }
  return entries
}

/**
 * Check that a feed directory is a faithful, current copy of a feed this
 * project published.
 *
 * This is the automated form of the manual sequence in
 * `docs/operations/rollback.md`. It answers three separate questions, and a
 * failure of any one of them is reported rather than short-circuiting, so an
 * operator sees the whole picture in a single run:
 *
 * 1. Do the bytes on disk match the digests the publisher recorded?
 * 2. Do the derived artifacts (`compact.json`, `delta.json`) agree with the
 *    feed they claim to describe?
 * 3. Is this state one that appeared in the published history, and is it
 *    recent enough to act on?
 */
export async function verifyFeedDirectory(
  dir: string,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const feedContent = await read(`${dir}/feed.json`)
  const feed = parse<Feed>(feedContent, `${dir}/feed.json`)
  const digest = sha256(feedContent)
  const cursor = feedCursor(feed)
  const problems: string[] = []

  const manifest = parseChecksumManifest(await read(`${dir}/checksums.txt`))
  let checkedFiles = 0
  const missing = new Set<string>()
  for (const [path, expected] of manifest) {
    let contents: Buffer
    try {
      contents = await readFile(`${dir}/${path}`)
    } catch {
      // A manifest entry with no file is a verification failure, not an
      // operational one: the publisher said this file exists and it does not.
      missing.add(path)
      problems.push(`${path} is listed in checksums.txt but missing from ${dir}`)
      continue
    }
    checkedFiles++
    const actual = sha256(contents)
    if (actual !== expected) {
      problems.push(`${path} digest ${actual} does not match checksums.txt ${expected}`)
    }
  }
  if (!manifest.has("feed.json")) {
    problems.push("checksums.txt does not cover feed.json")
  }

  /**
   * Fetch a published file for a downstream check, recording its absence once.
   * The manifest loop has already reported anything it covers, so saying so
   * again here would turn one missing file into two findings.
   */
  const published = async (name: string): Promise<string | undefined> => {
    const contents = await readPublished(`${dir}/${name}`)
    if (contents === undefined && !missing.has(name)) {
      problems.push(`${name} is missing from ${dir}`)
    }
    return contents
  }

  const recorded = await published("feed.json.sha256")
  if (recorded !== undefined) {
    const recordedDigest = recorded.trim().split(/\s+/)[0]
    if (recordedDigest !== digest) {
      problems.push(`feed.json digest ${digest} does not match feed.json.sha256 ${recordedDigest}`)
    }
  }

  const compactRaw = await published("compact.json")
  if (compactRaw !== undefined) {
    const compact = parse<CompactFeed>(compactRaw, `${dir}/compact.json`)
    if (compact.cursor !== cursor) {
      problems.push(`compact.json cursor ${compact.cursor} does not match feed cursor ${cursor}`)
    } else if (JSON.stringify(compact) !== JSON.stringify(buildCompactFeed(feed))) {
      // Only worth saying once the cursors agree: a mismatched cursor already
      // explains a mismatched projection, and reporting both reads as two
      // independent faults when there is one.
      problems.push("compact.json is not the compact projection of feed.json")
    }
  }

  const deltaRaw = await published("delta.json")
  if (deltaRaw !== undefined) {
    const delta = parse<FeedDelta>(deltaRaw, `${dir}/delta.json`)
    if (delta.to !== cursor) {
      problems.push(`delta.json targets cursor ${delta.to}, not the local feed cursor ${cursor}`)
    }
  }

  // A history document that will not parse is a verification failure, not an
  // operational one: the log is the evidence, and corrupt evidence is a
  // finding about the copy in hand.
  const historyRaw = await published("history.json")
  if (historyRaw !== undefined) {
    try {
      const history = parseFeedHistory(parse(historyRaw, `${dir}/history.json`))
      problems.push(...verifyFeedAgainstHistory(feed, history, digest))
    } catch (error) {
      if (error instanceof VerifyUnavailableError) throw error
      problems.push(
        `history.json is not a valid feed history: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return {
    dir,
    digest,
    cursor,
    advisoryCount: feed.advisory_count,
    checkedFiles,
    freshness: evaluateFreshness(feed, { maxAgeHours: options.maxAgeHours, now: options.now }),
    problems,
  }
}
