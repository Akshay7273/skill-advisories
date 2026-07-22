import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { hashSkillDir } from "./hash.js";
import { collectKnownNames, matchHashes, matchNames } from "./lookup.js";
import { findNearMatches } from "./typosquat.js";
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
export async function scanSkills(dirs, feed) {
    const installed = await listInstalledSkills(dirs);
    const knownNames = collectKnownNames(feed);
    const matches = [];
    const warnings = [];
    const advisoryMap = new Map();
    for (const adv of feed.advisories) {
        advisoryMap.set(adv.id, adv);
    }
    let scannedCount = 0;
    for (const group of installed) {
        for (const name of group.names) {
            scannedCount++;
            const skillPath = join(group.dir, name);
            let matchedInSkill = false;
            const matchedAdvisoryIds = new Set();
            // 1. Name match
            const nameHits = matchNames(feed, [name]);
            for (const nh of nameHits) {
                matchedInSkill = true;
                matchedAdvisoryIds.add(nh.advisory.id);
                matches.push({
                    query: name,
                    advisory: nh.advisory,
                    artifactNames: nh.artifactNames,
                    matchedBy: "name",
                });
            }
            // 2. Hash match
            const hashedFiles = await hashSkillDir(skillPath);
            const hashHits = matchHashes(feed, hashedFiles.map((h) => h.sha256));
            for (const hh of hashHits) {
                const matchingFile = hashedFiles.find((hf) => hf.sha256 === hh.sha256);
                for (const advId of hh.advisoryIds) {
                    if (!matchedAdvisoryIds.has(advId)) {
                        matchedInSkill = true;
                        matchedAdvisoryIds.add(advId);
                        const adv = advisoryMap.get(advId);
                        if (adv) {
                            matches.push({
                                query: name,
                                advisory: adv,
                                artifactNames: adv.artifacts.map((a) => a.name),
                                matchedBy: "sha256",
                                file: matchingFile?.file,
                                sha256: hh.sha256,
                            });
                        }
                    }
                }
            }
            // 3. Typosquat check if no real match
            if (!matchedInSkill) {
                const near = findNearMatches(name, knownNames);
                for (const nm of near) {
                    warnings.push({
                        name,
                        similarTo: nm.name,
                        distance: nm.distance,
                    });
                }
            }
        }
    }
    return { installed, scannedCount, matches, warnings };
}
