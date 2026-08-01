import { readFile } from "node:fs/promises"
import { parseFeedHistory, verifyHistoryChain } from "./history.js"
import type { FeedHistory } from "./history.js"
import { VerifyUnavailableError, verifyFeedDirectory } from "./verify.js"
import type { VerifyResult } from "./verify.js"

export type RecoveryCandidate = {
  /** Directory this copy was read from, as given by the caller. */
  dir: string
  /** Cursor the copy claims. Absent when it could not be read as a feed at all. */
  cursor?: string
  /** SHA-256 of the copy's exact `feed.json` bytes. */
  digest?: string
  /** Position in the published history. Absent when the cursor is not in it. */
  position?: number
  /** Publication timestamp the log records for this state, not the copy's claim. */
  generated?: string
  advisoryCount?: number
  /** Empty when this copy is usable as a recovery point. */
  problems: string[]
}

export type RecoverySelection = {
  /** History document the candidates were judged against. */
  history: string
  /** Number of published states the log records. */
  published: number
  /** Every copy examined, newest published state first. */
  candidates: RecoveryCandidate[]
  /** Newest copy the evidence proves good. Absent when none of them is. */
  selected?: RecoveryCandidate
  /** Faults in the log itself, which disqualify every candidate in it. */
  problems: string[]
}

/**
 * Read the log a recovery point must be justified against. Failure here is
 * operational rather than a finding: with no authority to compare copies to,
 * nothing about them has been disproved.
 */
async function loadHistory(path: string): Promise<FeedHistory> {
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    throw new VerifyUnavailableError(
      `cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  try {
    return parseFeedHistory(JSON.parse(raw))
  } catch (error) {
    throw new VerifyUnavailableError(
      `${path} is not a valid feed history: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Judge one copy on disk. A directory that cannot be read as a feed at all is
 * recorded as an unusable candidate rather than aborting the run: the whole
 * point of passing several copies is that some of them are expected to be bad,
 * and discarding the others to report the first failure would defeat it.
 */
async function examine(
  dir: string,
  history: FeedHistory,
  historyPath: string,
): Promise<RecoveryCandidate> {
  let copy: VerifyResult
  try {
    // Freshness is deliberately not consulted. A recovery point is chosen
    // precisely because the current state is suspect, so it is normally old,
    // and treating age as a fault would reject every candidate worth having.
    copy = await verifyFeedDirectory(dir)
  } catch (error) {
    if (error instanceof VerifyUnavailableError) return { dir, problems: [error.message] }
    throw error
  }

  const problems = [...copy.problems]
  const position = history.entries.findIndex((entry) => entry.cursor === copy.cursor)
  const entry = history.entries[position]
  if (!entry) {
    // The copy may carry a history of its own, and `verifyFeedDirectory` has
    // already checked it against that one. This is the separate question of
    // whether the authority the operator trusts also published this state, so
    // the path is named to keep the two findings apart.
    problems.push(`cursor ${copy.cursor} does not appear in ${historyPath}`)
  } else if (entry.digest !== copy.digest) {
    // The digest covers every byte of the document, so agreement here already
    // settles the timestamp and the advisory count. Comparing those separately
    // would report one substituted file as three faults.
    problems.push(`digest ${copy.digest} does not match the digest ${historyPath} published`)
  }

  return {
    dir,
    cursor: copy.cursor,
    digest: copy.digest,
    advisoryCount: copy.advisoryCount,
    ...(entry ? { position, generated: entry.generated } : {}),
    problems,
  }
}

/**
 * Pick the newest state that the evidence in hand actually proves good.
 *
 * This is the automated form of the first step of
 * `docs/operations/rollback.md`, which asks for the newest release whose
 * published record and local bytes both check out. Each copy is verified
 * against its own evidence and then against the published log, and every
 * candidate is reported with the reason it was rejected, because an operator
 * choosing where to roll back to needs to know what is wrong with the states
 * they are skipping over, not just which one survived.
 *
 * Ordering comes from the log rather than from the copies. A tampered copy can
 * claim any timestamp it likes, so the only trustworthy answer to *which of
 * these is newer* is the order in which they were published.
 *
 * Nothing here writes. Selecting a recovery point and performing the recovery
 * are separate decisions, and the second one belongs to a human.
 */
export async function selectRecoveryPoint(
  historyPath: string,
  dirs: string[],
): Promise<RecoverySelection> {
  if (dirs.length === 0) {
    throw new VerifyUnavailableError("no candidate feed directories were given")
  }
  const history = await loadHistory(historyPath)

  // A rewritten log cannot vouch for anything in it, including the entry that
  // would otherwise look like the safest place to land. When the chain is
  // broken every candidate is reported but none is selected.
  const problems = verifyHistoryChain(history)

  const candidates: RecoveryCandidate[] = []
  for (const dir of dirs) {
    candidates.push(await examine(dir, history, historyPath))
  }
  // Stable, so copies of the same published state stay in the order given and
  // ones the log does not know about sort to the end.
  candidates.sort((a, b) => (b.position ?? -1) - (a.position ?? -1))

  const selected =
    problems.length > 0
      ? undefined
      : candidates.find(
          (candidate) => candidate.position !== undefined && candidate.problems.length === 0,
        )

  return {
    history: historyPath,
    published: history.entries.length,
    candidates,
    ...(selected ? { selected } : {}),
    problems,
  }
}
