import type { Feed } from "./compile.js"

/**
 * The feed is republished daily by `.github/workflows/pages.yml`. Two days of
 * silence is therefore one missed run plus a full grace period — long enough
 * that a single failed cron does not cry wolf, short enough that a consumer
 * hears about a genuinely abandoned mirror within a working day.
 */
export const DEFAULT_MAX_FEED_AGE_HOURS = 48

export type FreshnessStatus = "fresh" | "stale" | "unknown"

export type Freshness = {
  status: FreshnessStatus
  /** Age of the feed in hours, rounded to one decimal. Absent when unknown. */
  ageHours?: number
  generated?: string
  maxAgeHours: number
}

/**
 * Milliseconds since the feed was generated, or `null` when the feed carries no
 * usable `generated` timestamp.
 *
 * A timestamp from the future is not clamped to zero: a mirror serving a feed
 * dated next year is a real problem, and reporting age `0` would hide it. The
 * caller sees a negative age and can decide.
 */
export function feedAgeMs(feed: Pick<Feed, "generated">, now: number = Date.now()): number | null {
  if (typeof feed.generated !== "string") return null
  const generated = Date.parse(feed.generated)
  if (Number.isNaN(generated)) return null
  return now - generated
}

/**
 * Classify how current a feed is.
 *
 * `unknown` is deliberately distinct from `stale`. A feed with no parseable
 * `generated` field has not been shown to be old — it has failed to say
 * anything, which is a different defect and deserves a different message. Both
 * are non-`fresh`, so a caller that only cares whether to trust the data can
 * test for `status !== "fresh"` and get fail-closed behaviour for free.
 */
export function evaluateFreshness(
  feed: Pick<Feed, "generated">,
  options: { maxAgeMs?: number; maxAgeHours?: number; now?: number } = {},
): Freshness {
  const maxAgeHours = options.maxAgeMs !== undefined
    ? options.maxAgeMs / 3_600_000
    : options.maxAgeHours ?? DEFAULT_MAX_FEED_AGE_HOURS
  const maxAgeMs = maxAgeHours * 3_600_000
  const ageMs = feedAgeMs(feed, options.now)

  if (ageMs === null) return { status: "unknown", maxAgeHours }

  return {
    status: ageMs > maxAgeMs ? "stale" : "fresh",
    ageHours: Math.round((ageMs / 3_600_000) * 10) / 10,
    generated: feed.generated,
    maxAgeHours,
  }
}

/** One-line explanation suitable for a CLI warning or a health page cell. */
export function describeFreshness(freshness: Freshness): string {
  if (freshness.status === "unknown") {
    return "feed age unknown: no valid generated timestamp"
  }
  const age = `${freshness.ageHours}h old`
  return freshness.status === "stale"
    ? `feed is stale: ${age}, limit ${freshness.maxAgeHours}h`
    : `feed is fresh: ${age}, limit ${freshness.maxAgeHours}h`
}
