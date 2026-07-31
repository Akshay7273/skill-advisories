import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import pc from "picocolors"
import { isFresh, readCache, writeCache } from "./cache.js"
import type { Feed } from "./compile.js"
import type { Advisory, Artifact, Ecosystem } from "./types.js"

export const DEFAULT_FEED_URL =
  "https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json"

export type Match = {
  query: string
  advisory: Advisory
  artifactNames: string[]
  artifactEcosystems: Ecosystem[]
  version?: string
}

type ArtifactIndexEntry = { advisory: Advisory; artifact: Artifact }

export type ArtifactIndex = {
  byName: Map<string, ArtifactIndexEntry[]>
  byEcosystemAndName: Map<string, ArtifactIndexEntry[]>
}

export type MatchNamesOptions = {
  ecosystem?: Ecosystem
  version?: string
  index?: ArtifactIndex
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v(?=\d)/i, "")
}

function artifactAffectsVersion(artifact: Artifact, version?: string): boolean {
  if (!version || !artifact.versions || artifact.versions.length === 0) return true
  if (artifact.versions.includes("*")) return true
  const wanted = normalizeVersion(version)
  return artifact.versions.some((candidate) => normalizeVersion(candidate) === wanted)
}

export type LoadFeedOptions = {
  offline?: boolean
  refresh?: boolean
  strict?: boolean
}

/** Load the advisory feed from a URL (http/https) or a local file path. */
export async function loadFeed(
  source: string = DEFAULT_FEED_URL,
  options: LoadFeedOptions = {},
): Promise<Feed> {
  if (!source.startsWith("http://") && !source.startsWith("https://")) {
    return JSON.parse(await readFile(source, "utf8")) as Feed
  }

  if (options.offline) {
    const cached = await readCache(source)
    if (!cached) {
      throw new Error(`offline mode: no cached feed available for ${source}`)
    }
    return JSON.parse(cached.body) as Feed
  }

  if (!options.refresh) {
    const cached = await readCache(source)
    if (cached && isFresh(cached)) {
      return JSON.parse(cached.body) as Feed
    }
  }

  try {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const bodyText = await res.text()

    try {
      const digestRes = await fetch(`${source}.sha256`)
      if (digestRes.ok) {
        const digestText = await digestRes.text()
        const expectedHash = digestText.trim().split(/\s+/)[0]?.toLowerCase()
        const actualHash = createHash("sha256").update(bodyText).digest("hex").toLowerCase()
        if (expectedHash && actualHash !== expectedHash) {
          console.error(
            pc.yellow(
              "\u26a0 feed digest mismatch \u2014 feed may be tampered with or mid-update",
            ),
          )
          if (options.strict) {
            throw new Error("feed digest mismatch (strict mode)")
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("strict mode")) {
        throw err
      }
      // digest fetch failed or unreachable: skip silently
    }

    await writeCache(source, bodyText)
    return JSON.parse(bodyText) as Feed
  } catch (err) {
    if (err instanceof Error && err.message.includes("strict mode")) {
      throw err
    }
    const fallback = await readCache(source)
    if (fallback) {
      const dateStr = new Date(fallback.fetchedAt).toISOString()
      console.error(
        pc.yellow(`\u26a0 network unavailable \u2014 using cached feed from ${dateStr}`),
      )
      return JSON.parse(fallback.body) as Feed
    }
    throw new Error(`failed to fetch feed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function appendIndexEntry(
  index: Map<string, ArtifactIndexEntry[]>,
  key: string,
  entry: ArtifactIndexEntry,
): void {
  const entries = index.get(key) ?? []
  entries.push(entry)
  index.set(key, entries)
}

/** Build reusable exact-name indexes for a feed. Withdrawn entries are omitted. */
export function buildArtifactIndex(feed: Feed): ArtifactIndex {
  const byName = new Map<string, ArtifactIndexEntry[]>()
  const byEcosystemAndName = new Map<string, ArtifactIndexEntry[]>()

  for (const advisory of feed.advisories) {
    if (advisory.withdrawn) continue
    for (const artifact of advisory.artifacts) {
      const normalizedName = artifact.name.toLowerCase()
      const entry = { advisory, artifact }
      appendIndexEntry(byName, normalizedName, entry)
      appendIndexEntry(
        byEcosystemAndName,
        `${artifact.ecosystem}:${normalizedName}`,
        entry,
      )
    }
  }

  return { byName, byEcosystemAndName }
}

/**
 * Find advisories whose artifacts match any given name. Matching is
 * case-insensitive and can be restricted to one ecosystem.
 */
export function matchNames(
  feed: Feed,
  names: string[],
  options: MatchNamesOptions = {},
): Match[] {
  const index = options.index ?? buildArtifactIndex(feed)
  const matches: Match[] = []
  for (const query of names) {
    const q = query.toLowerCase()
    const entries = options.ecosystem
      ? index.byEcosystemAndName.get(`${options.ecosystem}:${q}`) ?? []
      : index.byName.get(q) ?? []
    const grouped = new Map<
      string,
      { advisory: Advisory; names: Set<string>; ecosystems: Set<Ecosystem> }
    >()

    for (const { advisory, artifact } of entries) {
      if (!artifactAffectsVersion(artifact, options.version)) continue
      const group = grouped.get(advisory.id) ?? {
        advisory,
        names: new Set<string>(),
        ecosystems: new Set<Ecosystem>(),
      }
      group.names.add(artifact.name)
      group.ecosystems.add(artifact.ecosystem)
      grouped.set(advisory.id, group)
    }

    for (const group of grouped.values()) {
      matches.push({
        query,
        advisory: group.advisory,
        artifactNames: [...group.names],
        artifactEcosystems: [...group.ecosystems],
        version: options.version,
      })
    }
  }
  return matches
}

export type HashMatch = {
	sha256: string
	advisoryIds: string[]
}

/** All non-withdrawn artifact names in the feed (for typosquat proximity). */
export function collectKnownNames(feed: Feed, ecosystem?: Ecosystem): string[] {
	const names = new Set<string>()
	for (const adv of feed.advisories) {
		if (adv.withdrawn) continue
		for (const art of adv.artifacts) {
			if (!ecosystem || art.ecosystem === ecosystem) names.add(art.name)
		}
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
