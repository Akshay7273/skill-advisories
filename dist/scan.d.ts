/** Known agent skill install locations, relative to the home directory. */
export declare const KNOWN_SKILL_DIRS: string[];
export declare function defaultSkillDirs(): string[];
/**
 * List installed skills (subdirectory names) in each existing directory.
 * Missing or unreadable directories are silently skipped.
 */
export declare function listInstalledSkills(dirs: string[]): Promise<Array<{
    dir: string;
    names: string[];
}>>;
