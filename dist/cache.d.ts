export declare const DEFAULT_TTL_MS: number;
export declare function cacheDir(): string;
export declare function cacheFileFor(feedUrl: string): string;
export type CachedFeed = {
    fetchedAt: number;
    body: string;
};
export declare function readCache(feedUrl: string): Promise<CachedFeed | null>;
export declare function writeCache(feedUrl: string, body: string): Promise<void>;
export declare function isFresh(entry: CachedFeed, ttlMs?: number): boolean;
