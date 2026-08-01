import { createHash } from "node:crypto"
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { hashSkillDir, hashSkillDirDetailed, artifactDigest, sha256File } from "../src/hash.js"
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
	it("reports oversized files and total-byte budget exhaustion", async () => {
		const dir = await mkdtemp(path.join(tmpdir(), "ska-"))
		await writeFile(path.join(dir, "a.txt"), "1234")
		await writeFile(path.join(dir, "b.txt"), "1234")
		await writeFile(path.join(dir, "large.txt"), "123456789")
		const result = await hashSkillDirDetailed(dir, {
			concurrency: 2,
			maxFileBytes: 8,
			maxFiles: 10,
			maxTotalBytes: 4,
		})
		expect(result.files.map(({ file }) => file)).toEqual(["a.txt"])
		expect(result.stats).toMatchObject({
			discoveredFiles: 3,
			hashedFiles: 1,
			hashedBytes: 4,
			skippedLargeFiles: 1,
			skippedBudgetFiles: 1,
			budgetExhausted: true,
		})
	})
	it("supports explicit directory exclusions without following their contents", async () => {
		const dir = await mkdtemp(path.join(tmpdir(), "ska-"))
		await mkdir(path.join(dir, "vendor"))
		await writeFile(path.join(dir, "SKILL.md"), "safe")
		await writeFile(path.join(dir, "vendor", "payload.js"), "payload")
		const result = await hashSkillDirDetailed(dir, { excludeDirectories: ["vendor"] })
		expect(result.files.map(({ file }) => file)).toEqual(["SKILL.md"])
		expect(result.stats.skippedExcludedDirectories).toBe(1)
	})
	it.skipIf(process.platform === "win32")(
		"skips broken symlinks without throwing",
		async () => {
			const dir = await mkdtemp(path.join(tmpdir(), "ska-"))
			await writeFile(path.join(dir, "SKILL.md"), "ok")
			await symlink("/nonexistent-target", path.join(dir, "broken"))
			const hashed = await hashSkillDir(dir)
			expect(hashed.map((h) => h.file)).toEqual(["SKILL.md"])
		},
	)
})

describe("artifactDigest", () => {
	it("is independent of the order files were hashed in", () => {
		const files = [
			{ file: "SKILL.md", sha256: digest("a") },
			{ file: "scripts/run.sh", sha256: digest("b") },
		]
		expect(artifactDigest(files)).toBe(artifactDigest([...files].reverse()))
	})
	it("treats Windows and POSIX separators as the same artifact", () => {
		const posix = [{ file: "scripts/run.sh", sha256: digest("b") }]
		const windows = [{ file: "scripts\\run.sh", sha256: digest("b") }]
		expect(artifactDigest(windows)).toBe(artifactDigest(posix))
	})
	it("changes when a file's contents change", () => {
		const before = [{ file: "SKILL.md", sha256: digest("a") }]
		const after = [{ file: "SKILL.md", sha256: digest("b") }]
		expect(artifactDigest(after)).not.toBe(artifactDigest(before))
	})
	it("changes when a file is added under the same contents", () => {
		const one = [{ file: "SKILL.md", sha256: digest("a") }]
		const two = [...one, { file: "extra.js", sha256: digest("a") }]
		expect(artifactDigest(two)).not.toBe(artifactDigest(one))
	})
	it("distinguishes identical contents at different paths", () => {
		const here = [{ file: "a.js", sha256: digest("x") }]
		const there = [{ file: "b.js", sha256: digest("x") }]
		expect(artifactDigest(here)).not.toBe(artifactDigest(there))
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
