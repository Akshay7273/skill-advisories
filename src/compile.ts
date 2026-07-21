import type { Advisory } from "./types.js"

export type Feed = {
  schema_version: "1"
  name: string
  source: string
  generated: string
  advisory_count: number
  advisories: Advisory[]
}

export type FeedIndex = Record<string, string[]>

export const FEED_NAME = "skill-advisories"
export const FEED_SOURCE = "https://github.com/Akshay7273/skill-advisories"

/**
 * Build the distributable feed and lookup index from validated advisories.
 * Test advisories never enter the feed. Withdrawn advisories stay in the
 * feed (with their withdrawn timestamp) but are removed from the index.
 */
export function buildFeed(
  advisories: Advisory[],
  now: Date = new Date(),
): { feed: Feed; index: FeedIndex } {
  const live = advisories
    .filter((a) => a.type !== "test")
    .sort((a, b) => a.id.localeCompare(b.id))

  const index: FeedIndex = {}
  for (const adv of live) {
    if (adv.withdrawn) continue
    for (const artifact of adv.artifacts) {
      const key = `${artifact.ecosystem}:${artifact.name.toLowerCase()}`
      if (!index[key]) index[key] = []
      index[key].push(adv.id)
    }
  }

  return {
    feed: {
      schema_version: "1",
      name: FEED_NAME,
      source: FEED_SOURCE,
      generated: now.toISOString(),
      advisory_count: live.length,
      advisories: live,
    },
    index,
  }
}
