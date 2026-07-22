import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

export const MAX_HASHABLE_FILE_BYTES = 10 * 1024 * 1024 // 10 MiB

export async function sha256File(filePath: string): Promise<string> {
	const data = await fs.readFile(filePath)
	return createHash("sha256").update(data).digest("hex")
}

export type HashedFile = {
	/** Path relative to the skill directory. */
	file: string
	sha256: string
}

/**
 * Recursively hash all regular files in a skill directory.
 * Files larger than MAX_HASHABLE_FILE_BYTES are skipped; symlinks are
 * never followed; unreadable files are skipped — a scan must never crash.
 */
export async function hashSkillDir(dir: string): Promise<HashedFile[]> {
	const out: HashedFile[] = []
	async function walk(current: string): Promise<void> {
		let entries
		try {
			entries = await fs.readdir(current, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			const full = path.join(current, entry.name)
			if (entry.isSymbolicLink()) continue
			if (entry.isDirectory()) {
				await walk(full)
			} else if (entry.isFile()) {
				try {
					const stat = await fs.stat(full)
					if (stat.size > MAX_HASHABLE_FILE_BYTES) continue
					out.push({
						file: path.relative(dir, full),
						sha256: await sha256File(full),
					})
				} catch {
					// unreadable file: skip
				}
			}
		}
	}
	await walk(dir)
	return out
}
