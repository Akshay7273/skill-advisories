import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
/**
 * Load every .json advisory in a directory (sorted by filename).
 * Throws on unparseable JSON.
 */
export async function loadAdvisories(dir) {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    const loaded = [];
    for (const file of files) {
        const raw = await readFile(join(dir, file), "utf8");
        let advisory;
        try {
            advisory = JSON.parse(raw);
        }
        catch {
            throw new Error(`${file}: not valid JSON`);
        }
        loaded.push({ file, advisory });
    }
    return loaded;
}
