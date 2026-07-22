import { readFile } from "node:fs/promises"
import type { Feed } from "./compile.js"
import type { Advisory } from "./types.js"

export const DEFAULT_FEED_URL =
  "https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json"

export type Match = { query: string; advisory: Advisory; artifactNames: string[] }

/** Load the advisory feed from a URL (http/https) or a local file path. */
export async function loadFeed(source: string = DEFAULT_FEED_URL): Promise<Feed> {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`failed to fetch feed: HTTP ${res.status}`)
    return (await res.json()) as Feed
  }
  return JSON.parse(await readFile(source, "utf8")) as Feed
}

/**
 * Find advisories whose artifacts match any of the given names
 * (case-insensitive, across all ecosystems). Withdrawn advisories are skipped.
 */
export function matchNames(feed: Feed, names: string[]): Match[] {
  const matches: Match[] = []
  for (const query of names) {
    const q = query.toLowerCase()
    for (const advisory of feed.advisories) {
      if (advisory.withdrawn) continue
      const hits = advisory.artifacts
        .filter((a) => a.name.toLowerCase() === q)
        .map((a) => a.name)
      if (hits.length > 0) {
        matches.push({ query, advisory, artifactNames: hits })
      }
    }
  }
  return matches
}

export type HashMatch = {
	sha256: string
	advisoryIds: string[]
}

/** All non-withdrawn artifact names in the feed (for typosquat proximity). */
export function collectKnownNames(feed: Feed): string[] {
	const names = new Set<string>()
	for (const adv of feed.advisories) {
		if (adv.withdrawn) continue
		for (const art of adv.artifacts) names.add(art.name)
	}
	return [...names]
}

/** Match SHA-256 hashes (hex, any case) against non-withdrawn advisory artifacts. */
export function matchHashes(feed: Feed, hashes: string[]): HashMatch[] {
	const wanted = new Map<string, string[]>()
	for (const adv of feed.advisories) {
		if (adv.withdrawn) continue
		for (const art of adv.artifacts) {
			for (const h of art.sha256 ?? []) {
				const key = h.toLowerCase()
				const ids = wanted.get(key) ?? []
				if (!ids.includes(adv.id)) ids.push(adv.id)
				wanted.set(key, ids)
			}
		}
	}
	const out: HashMatch[] = []
	for (const h of hashes) {
		const ids = wanted.get(h.toLowerCase())
		if (ids) out.push({ sha256: h.toLowerCase(), advisoryIds: ids })
	}
	return out
}
