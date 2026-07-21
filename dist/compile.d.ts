import type { Advisory } from "./types.js";
export type Feed = {
    schema_version: "1";
    name: string;
    source: string;
    generated: string;
    advisory_count: number;
    advisories: Advisory[];
};
export type FeedIndex = Record<string, string[]>;
export declare const FEED_NAME = "skill-advisories";
export declare const FEED_SOURCE = "https://github.com/Akshay7273/skill-advisories";
/**
 * Build the distributable feed and lookup index from validated advisories.
 * Test advisories never enter the feed. Withdrawn advisories stay in the
 * feed (with their withdrawn timestamp) but are removed from the index.
 */
export declare function buildFeed(advisories: Advisory[], now?: Date): {
    feed: Feed;
    index: FeedIndex;
};
