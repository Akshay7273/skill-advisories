import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
/** Known agent skill install locations, relative to the home directory. */
export const KNOWN_SKILL_DIRS = [
    ".claude/skills",
    ".openclaw/skills",
    ".clawdbot/skills",
    ".moltbot/skills",
];
export function defaultSkillDirs() {
    return KNOWN_SKILL_DIRS.map((d) => join(homedir(), d));
}
/**
 * List installed skills (subdirectory names) in each existing directory.
 * Missing or unreadable directories are silently skipped.
 */
export async function listInstalledSkills(dirs) {
    const found = [];
    for (const dir of dirs) {
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            const names = entries
                .filter((e) => e.isDirectory())
                .map((e) => e.name)
                .sort();
            found.push({ dir, names });
        }
        catch {
            // directory doesn't exist or is unreadable; skip
        }
    }
    return found;
}
