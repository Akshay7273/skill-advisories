import { createHash } from "node:crypto"
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { hashSkillDir, sha256File } from "../src/hash.js"
import { matchHashes } from "../src/lookup.js"

const digest = (s: string) => createHash("sha256").update(s).digest("hex")

const testFeed = {
	advisories: [
		{
			id: "SKA-2026-9999",
			artifacts: [
				{ ecosystem: "claude-skill", name: "evil", sha256: [digest("malware")] },
			],
		},
		{
			id: "SKA-2026-9998",
			withdrawn: "2026-07-01T00:00:00Z",
			artifacts: [
				{ ecosystem: "claude-skill", name: "gone", sha256: [digest("withdrawn")] },
			],
		},
	],
} as any

describe("hashSkillDir", () => {
	it("hashes a file to the expected sha256", async () => {
		const dir = await mkdtemp(path.join(tmpdir(), "ska-"))
		await writeFile(path.join(dir, "SKILL.md"), "hello")
		expect(await sha256File(path.join(dir, "SKILL.md"))).toBe(digest("hello"))
	})
	it("hashes nested files with relative paths", async () => {
		const dir = await mkdtemp(path.join(tmpdir(), "ska-"))
		await mkdir(path.join(dir, "scripts"))
		await writeFile(path.join(dir, "scripts", "run.sh"), "payload")
		const hashed = await hashSkillDir(dir)
		expect(hashed).toEqual([
			{ file: path.join("scripts", "run.sh"), sha256: digest("payload") },
		])
	})
	it("skips broken symlinks without throwing", async () => {
		const dir = await mkdtemp(path.join(tmpdir(), "ska-"))
		await writeFile(path.join(dir, "SKILL.md"), "ok")
		await symlink("/nonexistent-target", path.join(dir, "broken"))
		const hashed = await hashSkillDir(dir)
		expect(hashed.map((h) => h.file)).toEqual(["SKILL.md"])
	})
})

describe("matchHashes", () => {
	it("matches a known hash case-insensitively", () => {
		const upper = digest("malware").toUpperCase()
		expect(matchHashes(testFeed, [upper])).toEqual([
			{ sha256: digest("malware"), advisoryIds: ["SKA-2026-9999"] },
		])
	})
	it("returns empty for unknown hashes", () => {
		expect(matchHashes(testFeed, [digest("innocent")])).toEqual([])
	})
	it("skips withdrawn advisories", () => {
		expect(matchHashes(testFeed, [digest("withdrawn")])).toEqual([])
	})
})
