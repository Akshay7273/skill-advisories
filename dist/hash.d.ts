export declare const MAX_HASHABLE_FILE_BYTES: number;
export declare function sha256File(filePath: string): Promise<string>;
export type HashedFile = {
    /** Path relative to the skill directory. */
    file: string;
    sha256: string;
};
/**
 * Recursively hash all regular files in a skill directory.
 * Files larger than MAX_HASHABLE_FILE_BYTES are skipped; symlinks are
 * never followed; unreadable files are skipped — a scan must never crash.
 */
export declare function hashSkillDir(dir: string): Promise<HashedFile[]>;
