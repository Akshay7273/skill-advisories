export declare const MAX_HASHABLE_FILE_BYTES: number;
export declare const MAX_HASHED_FILES = 10000;
export declare const MAX_HASHED_BYTES: number;
export declare const DEFAULT_HASH_CONCURRENCY = 4;
export type HashOptions = {
    concurrency?: number;
    maxFileBytes?: number;
    maxFiles?: number;
    maxTotalBytes?: number;
    /** Directory basenames to skip. Matching is exact and case-sensitive. */
    excludeDirectories?: string[];
};
export type HashedFile = {
    /** Path relative to the skill directory. */
    file: string;
    sha256: string;
    bytes?: number;
};
export type HashStats = {
    discoveredFiles: number;
    hashedFiles: number;
    hashedBytes: number;
    skippedLargeFiles: number;
    skippedBudgetFiles: number;
    skippedSymlinks: number;
    skippedExcludedDirectories: number;
    unreadableEntries: number;
    budgetExhausted: boolean;
};
export type HashDirectoryResult = {
    files: HashedFile[];
    stats: HashStats;
};
/** Hash a file as a stream so file size does not become process memory usage. */
export declare function sha256File(filePath: string): Promise<string>;
/**
 * Recursively hash regular files with explicit concurrency and resource limits.
 * Symlinks are never followed. Unreadable entries are counted and skipped so a
 * local scan cannot crash because one artifact is malformed.
 */
export declare function hashSkillDirDetailed(dir: string, options?: HashOptions): Promise<HashDirectoryResult>;
/** Backward-compatible compact hash API. */
export declare function hashSkillDir(dir: string, options?: HashOptions): Promise<HashedFile[]>;
