import type { Feed } from "./compile.js";
import type { Advisory } from "./types.js";
export type FeedDelta = {
    schema_version: "1";
    from: string;
    to: string;
    generated: string;
    upserts: Advisory[];
    removed: string[];
};
export type CompactFeed = {
    schema_version: "1";
    generated: string;
    cursor: string;
    advisory_count: number;
    advisories: Array<Pick<Advisory, "id" | "type" | "severity" | "artifacts" | "references" | "withdrawn">>;
};
/** Stable semantic cursor independent of JSON whitespace. */
export declare function feedCursor(feed: Feed): string;
export declare function buildFeedDelta(previous: Feed, current: Feed): FeedDelta;
export declare function applyFeedDelta(previous: Feed, delta: FeedDelta): Feed;
export declare function buildCompactFeed(feed: Feed): CompactFeed;
