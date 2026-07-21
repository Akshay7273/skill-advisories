import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Advisory } from "./types.js"

export type LoadedAdvisory = { file: string; advisory: Advisory }

/**
 * Load every .json advisory in a directory (sorted by filename).
 * Throws on unparseable JSON.
 */
export async function loadAdvisories(dir: string): Promise<LoadedAdvisory[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort()
  const loaded: LoadedAdvisory[] = []
  for (const file of files) {
    const raw = await readFile(join(dir, file), "utf8")
    let advisory: Advisory
    try {
      advisory = JSON.parse(raw) as Advisory
    } catch {
      throw new Error(`${file}: not valid JSON`)
    }
    loaded.push({ file, advisory })
  }
  return loaded
}
