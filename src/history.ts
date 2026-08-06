import * as z from "zod/v4"
import type { Feed } from "./compile.js"
import { feedCursor } from "./delta.js"

/**
 * One published state of the feed. The cursor identifies the normalized feed
 * document (including publication metadata); the digest covers the exact bytes
 * served for it.
 */
export const FeedHistoryEntrySchema = z
  .object({
    cursor: z.string().regex(/^[a-f0-9]{64}$/),
    generated: z.string().min(1),
    advisory_count: z.number().int().nonnegative(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export const FeedHistorySchema = z
  .object({
    schema_version: z.literal("1"),
    entries: z.array(FeedHistoryEntrySchema),
  })
  .strict()

export type FeedHistoryEntry = z.infer<typeof FeedHistoryEntrySchema>
export type FeedHistory = z.infer<typeof FeedHistorySchema>

export const EMPTY_HISTORY: FeedHistory = { schema_version: "1", entries: [] }

export function parseFeedHistory(input: unknown): FeedHistory {
  return FeedHistorySchema.parse(input)
}

export function historyEntry(feed: Feed, digest: string): FeedHistoryEntry {
  return {
    cursor: feedCursor(feed),
    generated: feed.generated,
    advisory_count: feed.advisory_count,
    digest,
  }
}

/**
 * Append a published state, or return the history unchanged when the newest
 * entry already records it. Republishing identical bytes is a no-op rather
 * than an error, so a rebuild that changes nothing does not grow the log.
 */
export function appendHistory(history: FeedHistory, entry: FeedHistoryEntry): FeedHistory {
  const last = history.entries.at(-1)
  if (last && last.cursor === entry.cursor) {
    if (last.digest !== entry.digest) {
      throw new Error(
        `feed history conflict: cursor ${entry.cursor} was published with digest ${last.digest}`,
      )
    }
    return history
  }
  const earlier = history.entries.find((candidate) => candidate.cursor === entry.cursor)
  if (earlier) {
    throw new Error(`feed history conflict: cursor ${entry.cursor} was already published`)
  }
  if (last && Date.parse(entry.generated) < Date.parse(last.generated)) {
    throw new Error(
      `feed history conflict: ${entry.generated} predates the last published ${last.generated}`,
    )
  }
  return { ...history, entries: [...history.entries, entry] }
}

/**
 * Check the log's internal consistency. A rewritten history is as much of a
 * problem as a rewritten feed, so this runs before the feed is compared to it.
 */
export function verifyHistoryChain(history: FeedHistory): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  let previous: FeedHistoryEntry | undefined
  for (const [position, entry] of history.entries.entries()) {
    if (seen.has(entry.cursor)) {
      problems.push(`entry ${position}: cursor ${entry.cursor} appears more than once`)
    }
    seen.add(entry.cursor)
    if (Number.isNaN(Date.parse(entry.generated))) {
      problems.push(`entry ${position}: generated ${entry.generated} is not a valid timestamp`)
    } else if (previous && Date.parse(entry.generated) < Date.parse(previous.generated)) {
      problems.push(
        `entry ${position}: generated ${entry.generated} predates entry ${position - 1}`,
      )
    }
    previous = entry
  }
  return problems
}

/**
 * Confirm a feed is one this project published, byte for byte. Catches a
 * mirror serving a feed that never appeared in the log, and a feed whose
 * cursor is known but whose contents or metadata have since been altered.
 */
export function verifyFeedAgainstHistory(
  feed: Feed,
  history: FeedHistory,
  digest: string,
): string[] {
  const problems = verifyHistoryChain(history)
  const cursor = feedCursor(feed)
  const entry = history.entries.find((candidate) => candidate.cursor === cursor)
  if (!entry) {
    problems.push(`feed cursor ${cursor} does not appear in the published history`)
    return problems
  }
  if (entry.digest !== digest) {
    problems.push(`feed digest ${digest} does not match published ${entry.digest}`)
  }
  if (entry.generated !== feed.generated) {
    problems.push(`feed generated ${feed.generated} does not match published ${entry.generated}`)
  }
  if (entry.advisory_count !== feed.advisory_count) {
    problems.push(
      `feed advisory count ${feed.advisory_count} does not match published ${entry.advisory_count}`,
    )
  }
  return problems
}
