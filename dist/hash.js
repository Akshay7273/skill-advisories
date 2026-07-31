import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { mapConcurrent, positiveInteger } from "./concurrency.js";
export const MAX_HASHABLE_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MAX_HASHED_FILES = 10_000;
export const MAX_HASHED_BYTES = 256 * 1024 * 1024; // 256 MiB per artifact
export const DEFAULT_HASH_CONCURRENCY = 4;
function boundedBytes(value, name) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative safe integer`);
    }
    return value;
}
/** Hash a file as a stream so file size does not become process memory usage. */
export async function sha256File(filePath) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(filePath))
        hash.update(chunk);
    return hash.digest("hex");
}
/**
 * Recursively hash regular files with explicit concurrency and resource limits.
 * Symlinks are never followed. Unreadable entries are counted and skipped so a
 * local scan cannot crash because one artifact is malformed.
 */
export async function hashSkillDirDetailed(dir, options = {}) {
    const concurrency = positiveInteger(options.concurrency ?? DEFAULT_HASH_CONCURRENCY, "concurrency");
    const maxFileBytes = boundedBytes(options.maxFileBytes ?? MAX_HASHABLE_FILE_BYTES, "maxFileBytes");
    const maxFiles = positiveInteger(options.maxFiles ?? MAX_HASHED_FILES, "maxFiles");
    const maxTotalBytes = boundedBytes(options.maxTotalBytes ?? MAX_HASHED_BYTES, "maxTotalBytes");
    const excluded = new Set(options.excludeDirectories ?? []);
    const candidates = [];
    const stats = {
        discoveredFiles: 0,
        hashedFiles: 0,
        hashedBytes: 0,
        skippedLargeFiles: 0,
        skippedBudgetFiles: 0,
        skippedSymlinks: 0,
        skippedExcludedDirectories: 0,
        unreadableEntries: 0,
        budgetExhausted: false,
    };
    let reservedBytes = 0;
    async function walk(current) {
        let entries;
        try {
            entries = await fs.readdir(current, { withFileTypes: true });
        }
        catch {
            stats.unreadableEntries++;
            return;
        }
        entries.sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isSymbolicLink()) {
                stats.skippedSymlinks++;
            }
            else if (entry.isDirectory()) {
                if (excluded.has(entry.name)) {
                    stats.skippedExcludedDirectories++;
                }
                else {
                    await walk(fullPath);
                }
            }
            else if (entry.isFile()) {
                stats.discoveredFiles++;
                let bytes;
                try {
                    bytes = (await fs.stat(fullPath)).size;
                }
                catch {
                    stats.unreadableEntries++;
                    continue;
                }
                if (bytes > maxFileBytes) {
                    stats.skippedLargeFiles++;
                    continue;
                }
                if (candidates.length >= maxFiles || reservedBytes + bytes > maxTotalBytes) {
                    stats.skippedBudgetFiles++;
                    stats.budgetExhausted = true;
                    continue;
                }
                reservedBytes += bytes;
                candidates.push({ fullPath, relativePath: path.relative(dir, fullPath), bytes });
            }
        }
    }
    await walk(dir);
    const hashed = await mapConcurrent(candidates, concurrency, async (candidate) => {
        try {
            return {
                file: candidate.relativePath,
                sha256: await sha256File(candidate.fullPath),
                bytes: candidate.bytes,
            };
        }
        catch {
            stats.unreadableEntries++;
            return null;
        }
    });
    const files = hashed.filter((value) => value !== null);
    stats.hashedFiles = files.length;
    stats.hashedBytes = files.reduce((total, file) => total + (file.bytes ?? 0), 0);
    return { files, stats };
}
/** Backward-compatible compact hash API. */
export async function hashSkillDir(dir, options = {}) {
    const result = await hashSkillDirDetailed(dir, options);
    return result.files.map(({ file, sha256 }) => ({ file, sha256 }));
}
