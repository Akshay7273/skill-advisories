import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import {
	cacheFileFor,
	DEFAULT_TTL_MS,
	isFresh,
	readCache,
	writeCache,
} from "../src/cache.js"

beforeEach(async () => {
	process.env.XDG_CACHE_HOME = await mkdtemp(path.join(tmpdir(), "ska-cache-"))
})

describe("cache", () => {
	it("round-trips a cached feed body", async () => {
		await writeCache("https://example.com/feed.json", '{"advisories":[]}')
		const entry = await readCache("https://example.com/feed.json")
		expect(entry?.body).toBe('{"advisories":[]}')
	})
	it("returns null when nothing is cached", async () => {
		expect(await readCache("https://example.com/other.json")).toBeNull()
	})
	it("keys cache files by feed url", () => {
		expect(cacheFileFor("https://a.example/feed.json")).not.toBe(
			cacheFileFor("https://b.example/feed.json"),
		)
	})
	it("treats fresh entries as fresh and old ones as stale", () => {
		expect(isFresh({ fetchedAt: Date.now(), body: "" })).toBe(true)
		expect(
			isFresh({ fetchedAt: Date.now() - DEFAULT_TTL_MS - 1, body: "" }),
		).toBe(false)
	})
})
