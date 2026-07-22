import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pc from "picocolors";
import { isFresh, readCache, writeCache } from "./cache.js";
export const DEFAULT_FEED_URL = "https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json";
/** Load the advisory feed from a URL (http/https) or a local file path. */
export async function loadFeed(source = DEFAULT_FEED_URL, options = {}) {
    if (!source.startsWith("http://") && !source.startsWith("https://")) {
        return JSON.parse(await readFile(source, "utf8"));
    }
    if (options.offline) {
        const cached = await readCache(source);
        if (!cached) {
            throw new Error(`offline mode: no cached feed available for ${source}`);
        }
        return JSON.parse(cached.body);
    }
    if (!options.refresh) {
        const cached = await readCache(source);
        if (cached && isFresh(cached)) {
            return JSON.parse(cached.body);
        }
    }
    try {
        const res = await fetch(source);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const bodyText = await res.text();
        try {
            const digestRes = await fetch(`${source}.sha256`);
            if (digestRes.ok) {
                const digestText = await digestRes.text();
                const expectedHash = digestText.trim().split(/\s+/)[0]?.toLowerCase();
                const actualHash = createHash("sha256").update(bodyText).digest("hex").toLowerCase();
                if (expectedHash && actualHash !== expectedHash) {
                    console.error(pc.yellow("\u26a0 feed digest mismatch \u2014 feed may be tampered with or mid-update"));
                    if (options.strict) {
                        throw new Error("feed digest mismatch (strict mode)");
                    }
                }
            }
        }
        catch (err) {
            if (err instanceof Error && err.message.includes("strict mode")) {
                throw err;
            }
            // digest fetch failed or unreachable: skip silently
        }
        await writeCache(source, bodyText);
        return JSON.parse(bodyText);
    }
    catch (err) {
        if (err instanceof Error && err.message.includes("strict mode")) {
            throw err;
        }
        const fallback = await readCache(source);
        if (fallback) {
            const dateStr = new Date(fallback.fetchedAt).toISOString();
            console.error(pc.yellow(`\u26a0 network unavailable \u2014 using cached feed from ${dateStr}`));
            return JSON.parse(fallback.body);
        }
        throw new Error(`failed to fetch feed: ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * Find advisories whose artifacts match any of the given names
 * (case-insensitive, across all ecosystems). Withdrawn advisories are skipped.
 */
export function matchNames(feed, names) {
    const matches = [];
    for (const query of names) {
        const q = query.toLowerCase();
        for (const advisory of feed.advisories) {
            if (advisory.withdrawn)
                continue;
            const hits = advisory.artifacts
                .filter((a) => a.name.toLowerCase() === q)
                .map((a) => a.name);
            if (hits.length > 0) {
                matches.push({ query, advisory, artifactNames: hits });
            }
        }
    }
    return matches;
}
/** All non-withdrawn artifact names in the feed (for typosquat proximity). */
export function collectKnownNames(feed) {
    const names = new Set();
    for (const adv of feed.advisories) {
        if (adv.withdrawn)
            continue;
        for (const art of adv.artifacts)
            names.add(art.name);
    }
    return [...names];
}
/** Match SHA-256 hashes (hex, any case) against non-withdrawn advisory artifacts. */
export function matchHashes(feed, hashes) {
    const wanted = new Map();
    for (const adv of feed.advisories) {
        if (adv.withdrawn)
            continue;
        for (const art of adv.artifacts) {
            for (const h of art.sha256 ?? []) {
                const key = h.toLowerCase();
                const ids = wanted.get(key) ?? [];
                if (!ids.includes(adv.id))
                    ids.push(adv.id);
                wanted.set(key, ids);
            }
        }
    }
    const out = [];
    for (const h of hashes) {
        const ids = wanted.get(h.toLowerCase());
        if (ids)
            out.push({ sha256: h.toLowerCase(), advisoryIds: ids });
    }
    return out;
}
