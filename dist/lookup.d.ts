import type { Feed } from "./compile.js";
import type { Advisory, Artifact, Ecosystem } from "./types.js";
export declare const DEFAULT_FEED_URL = "https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json";
export type Match = {
    query: string;
    advisory: Advisory;
    artifactNames: string[];
    artifactEcosystems: Ecosystem[];
    version?: string;
};
type ArtifactIndexEntry = {
    advisory: Advisory;
    artifact: Artifact;
};
export type ArtifactIndex = {
    byName: Map<string, ArtifactIndexEntry[]>;
    byEcosystemAndName: Map<string, ArtifactIndexEntry[]>;
};
export type MatchNamesOptions = {
    ecosystem?: Ecosystem;
    version?: string;
    index?: ArtifactIndex;
};
export type LoadFeedOptions = {
    offline?: boolean;
    refresh?: boolean;
    strict?: boolean;
};
/** Load the advisory feed from a URL (http/https) or a local file path. */
export declare function loadFeed(source?: string, options?: LoadFeedOptions): Promise<Feed>;
/** Build reusable exact-name indexes for a feed. Withdrawn entries are omitted. */
export declare function buildArtifactIndex(feed: Feed): ArtifactIndex;
/**
 * Find advisories whose artifacts match any given name. Matching is
 * case-insensitive and can be restricted to one ecosystem.
 */
export declare function matchNames(feed: Feed, names: string[], options?: MatchNamesOptions): Match[];
export type HashMatch = {
    sha256: string;
    advisoryIds: string[];
};
/** All non-withdrawn artifact names in the feed (for typosquat proximity). */
export declare function collectKnownNames(feed: Feed, ecosystem?: Ecosystem): string[];
/** Match SHA-256 hashes (hex, any case) against non-withdrawn advisory artifacts. */
export declare function matchHashes(feed: Feed, hashes: string[]): HashMatch[];
export {};
