import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

export const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hour

export function cacheDir(): string {
	const base =
		process.env.XDG_CACHE_HOME && process.env.XDG_CACHE_HOME !== ""
			? process.env.XDG_CACHE_HOME
			: path.join(os.homedir(), ".cache")
	return path.join(base, "skill-advisories")
}

export function cacheFileFor(feedUrl: string): string {
	const key = createHash("sha256").update(feedUrl).digest("hex").slice(0, 16)
	return path.join(cacheDir(), `feed-${key}.json`)
}

export type CachedFeed = {
	fetchedAt: number
	body: string
}

export async function readCache(feedUrl: string): Promise<CachedFeed | null> {
	try {
		const raw = await fs.readFile(cacheFileFor(feedUrl), "utf8")
		const parsed = JSON.parse(raw) as CachedFeed
		if (typeof parsed.fetchedAt !== "number" || typeof parsed.body !== "string") {
			return null
		}
		return parsed
	} catch {
		return null
	}
}

export async function writeCache(feedUrl: string, body: string): Promise<void> {
	try {
		await fs.mkdir(cacheDir(), { recursive: true })
		const entry: CachedFeed = { fetchedAt: Date.now(), body }
		await fs.writeFile(cacheFileFor(feedUrl), JSON.stringify(entry))
	} catch {
		// cache write failures must never break a run
	}
}

export function isFresh(
	entry: CachedFeed,
	ttlMs: number = DEFAULT_TTL_MS,
): boolean {
	return Date.now() - entry.fetchedAt < ttlMs
}
