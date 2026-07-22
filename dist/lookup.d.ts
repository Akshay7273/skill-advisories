import type { Feed } from "./compile.js";
import type { Advisory } from "./types.js";
export declare const DEFAULT_FEED_URL = "https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json";
export type Match = {
    query: string;
    advisory: Advisory;
    artifactNames: string[];
};
export type LoadFeedOptions = {
    offline?: boolean;
    refresh?: boolean;
    strict?: boolean;
};
/** Load the advisory feed from a URL (http/https) or a local file path. */
export declare function loadFeed(source?: string, options?: LoadFeedOptions): Promise<Feed>;
/**
 * Find advisories whose artifacts match any of the given names
 * (case-insensitive, across all ecosystems). Withdrawn advisories are skipped.
 */
export declare function matchNames(feed: Feed, names: string[]): Match[];
export type HashMatch = {
    sha256: string;
    advisoryIds: string[];
};
/** All non-withdrawn artifact names in the feed (for typosquat proximity). */
export declare function collectKnownNames(feed: Feed): string[];
/** Match SHA-256 hashes (hex, any case) against non-withdrawn advisory artifacts. */
export declare function matchHashes(feed: Feed, hashes: string[]): HashMatch[];
