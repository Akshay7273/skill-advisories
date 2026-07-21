import { mkdir, readFile, writeFile } from "node:fs/promises"
import pc from "picocolors"
import { buildFeed } from "./compile.js"
import { loadAdvisories } from "./load.js"
import { validateAdvisories } from "./validate.js"

const dir = process.argv[2] ?? "advisories"

const loaded = await loadAdvisories(dir)
const problems = await validateAdvisories(loaded)
if (problems.length > 0) {
  console.log(
    pc.red(`\u274c refusing to compile: ${problems.length} validation problem(s). Run: npm run validate`),
  )
  process.exit(1)
}

const { feed, index } = buildFeed(loaded.map((l) => l.advisory))

try {
  const existingRaw = await readFile("feed/feed.json", "utf8")
  const existingFeed = JSON.parse(existingRaw)
  if (JSON.stringify(existingFeed.advisories) === JSON.stringify(feed.advisories)) {
    feed.generated = existingFeed.generated
  }
} catch {
  // file doesn't exist yet, keep fresh generated timestamp
}

await mkdir("feed", { recursive: true })
await writeFile("feed/feed.json", JSON.stringify(feed, null, 2) + "\n", "utf8")
await writeFile("feed/index.json", JSON.stringify(index, null, 2) + "\n", "utf8")

console.log(pc.green(`\u2705 feed/feed.json written \u2014 ${feed.advisory_count} advisories (test entries excluded)`))
console.log(pc.green(`\u2705 feed/index.json written \u2014 ${Object.keys(index).length} artifact keys`))
