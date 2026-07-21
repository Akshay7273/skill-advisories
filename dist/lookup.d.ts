import type { Feed } from "./compile.js";
import type { Advisory } from "./types.js";
export declare const DEFAULT_FEED_URL = "https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json";
export type Match = {
    query: string;
    advisory: Advisory;
    artifactNames: string[];
};
/** Load the advisory feed from a URL (http/https) or a local file path. */
export declare function loadFeed(source?: string): Promise<Feed>;
/**
 * Find advisories whose artifacts match any of the given names
 * (case-insensitive, across all ecosystems). Withdrawn advisories are skipped.
 */
export declare function matchNames(feed: Feed, names: string[]): Match[];
