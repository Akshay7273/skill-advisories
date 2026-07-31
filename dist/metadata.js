import { readFile } from "node:fs/promises";
import path from "node:path";
function nonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
async function readPackageMetadata(skillPath) {
    try {
        const parsed = JSON.parse(await readFile(path.join(skillPath, "package.json"), "utf8"));
        return {
            name: nonEmptyString(parsed.name),
            version: nonEmptyString(parsed.version),
        };
    }
    catch {
        return {};
    }
}
async function readSkillFrontmatter(skillPath) {
    try {
        const contents = await readFile(path.join(skillPath, "SKILL.md"), "utf8");
        const frontmatter = contents.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
        if (!frontmatter)
            return {};
        const fields = {};
        for (const line of frontmatter.split(/\r?\n/)) {
            const match = line.match(/^([A-Za-z][\w-]*):\s*(.*?)\s*$/);
            if (!match)
                continue;
            fields[match[1].toLowerCase()] = match[2].replace(/^(["'])(.*)\1$/, "$2");
        }
        return {
            name: nonEmptyString(fields.name),
            version: nonEmptyString(fields.version),
        };
    }
    catch {
        return {};
    }
}
export function inferEcosystemFromDirectory(dir) {
    const normalized = dir.replaceAll("\\", "/").toLowerCase().replace(/\/$/, "");
    if (normalized.endsWith("/.claude/skills"))
        return "claude-skill";
    if (normalized.endsWith("/.openclaw/skills") ||
        normalized.endsWith("/.clawdbot/skills") ||
        normalized.endsWith("/.moltbot/skills")) {
        return "clawhub";
    }
    return undefined;
}
export async function detectSkillMetadata(skillPath, fallbackName, ecosystem) {
    const [skill, pkg] = await Promise.all([
        readSkillFrontmatter(skillPath),
        readPackageMetadata(skillPath),
    ]);
    return {
        path: skillPath,
        name: skill.name ?? pkg.name ?? fallbackName,
        version: skill.version ?? pkg.version,
        ecosystem,
    };
}
