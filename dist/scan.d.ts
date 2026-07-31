import type { Feed } from "./compile.js";
import type { InstalledSkill } from "./metadata.js";
import type { Advisory, Ecosystem } from "./types.js";
/** Known agent skill install locations, relative to the home directory. */
export declare const KNOWN_SKILL_DIRS: string[];
export declare function defaultSkillDirs(): string[];
/**
 * List installed skills (subdirectory names) in each existing directory.
 * Missing or unreadable directories are silently skipped.
 */
export declare function listInstalledSkills(dirs: string[], ecosystem?: Ecosystem): Promise<Array<{
    dir: string;
    names: string[];
    skills: InstalledSkill[];
}>>;
export type ScanMatch = {
    query: string;
    advisory: Advisory;
    artifactNames: string[];
    artifactEcosystems: Ecosystem[];
    version?: string;
    matchedBy: "name" | "sha256";
    file?: string;
    sha256?: string;
};
export type ScanWarning = {
    name: string;
    similarTo: string;
    distance: number;
};
export type ScanResult = {
    installed: Array<{
        dir: string;
        names: string[];
        skills: InstalledSkill[];
    }>;
    scannedCount: number;
    matches: ScanMatch[];
    warnings: ScanWarning[];
};
export type ScanOptions = {
    ecosystem?: Ecosystem;
};
export declare function scanSkills(dirs: string[], feed: Feed, options?: ScanOptions): Promise<ScanResult>;
