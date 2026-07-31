import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { detectSkillMetadata, inferEcosystemFromDirectory } from "../src/metadata.js"
import { scanSkills } from "../src/scan.js"

describe("installed skill metadata", () => {
  it("prefers SKILL.md frontmatter over package metadata", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "ska-metadata-"))
    await writeFile(
      path.join(dir, "SKILL.md"),
      "---\nname: frontmatter-name\nversion: 2.1.0\n---\n# Skill\n",
    )
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "package-name", version: "1.0.0" }),
    )
    await expect(detectSkillMetadata(dir, "fallback", "claude-skill")).resolves.toEqual({
      path: dir,
      name: "frontmatter-name",
      version: "2.1.0",
      ecosystem: "claude-skill",
    })
  })

  it("infers known installation ecosystems on every platform", () => {
    expect(inferEcosystemFromDirectory("C:\\Users\\me\\.claude\\skills")).toBe(
      "claude-skill",
    )
    expect(inferEcosystemFromDirectory("/home/me/.openclaw/skills")).toBe("clawhub")
  })

  it("uses discovered names and versions during scans", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ska-scan-"))
    const skillDir = path.join(root, "renamed-folder")
    await mkdir(skillDir)
    await writeFile(
      path.join(skillDir, "package.json"),
      JSON.stringify({ name: "risky-package", version: "2.0.0" }),
    )
    const feed = {
      advisories: [
        {
          id: "SKA-2026-9999",
          artifacts: [{ ecosystem: "npm", name: "risky-package", versions: ["1.0.0"] }],
        },
      ],
    } as any

    const result = await scanSkills([root], feed, { ecosystem: "npm" })
    expect(result.installed[0].skills[0].name).toBe("risky-package")
    expect(result.installed[0].skills[0].version).toBe("2.0.0")
    expect(result.matches).toHaveLength(0)
  })
})
