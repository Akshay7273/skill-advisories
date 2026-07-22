import { readFile } from "node:fs/promises";
export const DEFAULT_FEED_URL = "https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json";
/** Load the advisory feed from a URL (http/https) or a local file path. */
export async function loadFeed(source = DEFAULT_FEED_URL) {
    if (source.startsWith("http://") || source.startsWith("https://")) {
        const res = await fetch(source);
        if (!res.ok)
            throw new Error(`failed to fetch feed: HTTP ${res.status}`);
        return (await res.json());
    }
    return JSON.parse(await readFile(source, "utf8"));
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
