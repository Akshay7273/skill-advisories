import * as z from "zod/v4"

/**
 * One measured signal, with the place it came from.
 *
 * The source URL travels with the value rather than living in documentation,
 * because a number in a readiness report is worth exactly as much as the
 * ability to re-derive it. `value` is nullable and null means the source did
 * not answer -- never that the signal is zero. Those are different facts, and
 * collapsing them would let an outage read as a collapse in adoption.
 */
export const MetricSchema = z
  .object({
    value: z.number().nullable(),
    source: z.string().min(1),
    note: z.string().optional(),
  })
  .strict()

/**
 * One collection run.
 *
 * Signals are recorded together because they are only comparable when they
 * were taken at the same moment: downloads rising while dependents stay flat
 * is the interesting shape, and it is unreadable if the two were sampled
 * weeks apart.
 */
export const MetricsEntrySchema = z
  .object({
    collected: z.string().min(1),
    source_commit: z.string().min(1),
    signals: z.record(z.string(), MetricSchema),
  })
  .strict()

export const MetricsHistorySchema = z
  .object({
    schema_version: z.literal("1"),
    entries: z.array(MetricsEntrySchema),
  })
  .strict()

export type Metric = z.infer<typeof MetricSchema>
export type MetricsEntry = z.infer<typeof MetricsEntrySchema>
export type MetricsHistory = z.infer<typeof MetricsHistorySchema>

export const EMPTY_METRICS: MetricsHistory = { schema_version: "1", entries: [] }

export function parseMetricsHistory(input: unknown): MetricsHistory {
  return MetricsHistorySchema.parse(input)
}

const day = (timestamp: string) => timestamp.slice(0, 10)

/**
 * Append a collection, replacing one already taken the same day.
 *
 * Re-running the collector on the day it already ran is a correction, not a
 * second observation -- typically the first run hit a rate limit and recorded
 * a null. Replacing keeps one row per day, so the log reads as a time series
 * rather than as a record of how often the script was invoked.
 *
 * A collection dated before the newest one is refused. The value of an
 * append-only log is that its order means something, and a backdated row would
 * quietly make `latestMetrics` return something other than the latest.
 */
export function appendMetrics(history: MetricsHistory, entry: MetricsEntry): MetricsHistory {
  const last = history.entries.at(-1)
  if (last && day(last.collected) === day(entry.collected)) {
    return { ...history, entries: [...history.entries.slice(0, -1), entry] }
  }
  if (last && Date.parse(entry.collected) < Date.parse(last.collected)) {
    throw new Error(
      `metrics history conflict: ${entry.collected} predates the last collection ${last.collected}`,
    )
  }
  return { ...history, entries: [...history.entries, entry] }
}

/**
 * Check the log's internal consistency, the same way `verifyHistoryChain`
 * does for the feed: a rewritten log is as much of a problem as a wrong
 * number, and neither is visible from a single entry.
 */
export function verifyMetricsChain(history: MetricsHistory): string[] {
  const problems: string[] = []
  const days = new Set<string>()
  let previous: MetricsEntry | undefined
  for (const [position, entry] of history.entries.entries()) {
    if (Number.isNaN(Date.parse(entry.collected))) {
      problems.push(`entry ${position}: collected ${entry.collected} is not a valid timestamp`)
    } else if (previous && Date.parse(entry.collected) < Date.parse(previous.collected)) {
      problems.push(`entry ${position}: collected ${entry.collected} predates entry ${position - 1}`)
    }
    if (days.has(day(entry.collected))) {
      problems.push(`entry ${position}: a collection for ${day(entry.collected)} already exists`)
    }
    days.add(day(entry.collected))
    previous = entry
  }
  return problems
}

export function latestMetrics(history: MetricsHistory): MetricsEntry | undefined {
  return history.entries.at(-1)
}
