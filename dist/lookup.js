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
