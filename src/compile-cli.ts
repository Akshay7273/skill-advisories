import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises"
import pc from "picocolors"
import { buildFeed } from "./compile.js"
import { loadAdvisories } from "./load.js"
import { validateAdvisories } from "./validate.js"
import { toOsv } from "./osv.js"

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
const feedContent = JSON.stringify(feed, null, 2) + "\n"
await writeFile("feed/feed.json", feedContent, "utf8")
await writeFile("feed/index.json", JSON.stringify(index, null, 2) + "\n", "utf8")

const digest = createHash("sha256").update(feedContent).digest("hex")
await writeFile("feed/feed.json.sha256", `${digest}  feed.json\n`, "utf8")

const osvDir = "feed/osv"
await mkdir(osvDir, { recursive: true })
for (const file of await readdir(osvDir)) {
  if (file.endsWith(".json")) await unlink(`${osvDir}/${file}`)
}
const osvIndex: Array<{ id: string; path: string }> = []
for (const advisory of feed.advisories) {
  const relativePath = `osv/${advisory.id}.json`
  await writeFile(
    `feed/${relativePath}`,
    `${JSON.stringify(toOsv(advisory), null, 2)}\n`,
    "utf8",
  )
  osvIndex.push({ id: advisory.id, path: relativePath })
}
await writeFile(
  `${osvDir}/index.json`,
  `${JSON.stringify({ schema_version: "1", advisories: osvIndex }, null, 2)}\n`,
  "utf8",
)

const checksumFiles = [
  "feed.json",
  "index.json",
  ...osvIndex.map((entry) => entry.path),
  "osv/index.json",
].sort()
const checksumLines: string[] = []
for (const file of checksumFiles) {
  const contents = await readFile(`feed/${file}`)
  checksumLines.push(`${createHash("sha256").update(contents).digest("hex")}  ${file}`)
}
await writeFile("feed/checksums.txt", `${checksumLines.join("\n")}\n`, "utf8")

console.log(pc.green(`\u2705 feed/feed.json written \u2014 ${feed.advisory_count} advisories (test entries excluded)`))
console.log(pc.green(`\u2705 feed/index.json written \u2014 ${Object.keys(index).length} artifact keys`))
console.log(pc.green(`\u2705 feed/feed.json.sha256 written \u2014 ${digest}`))
console.log(pc.green(`\u2705 feed/osv written \u2014 ${osvIndex.length} OSV records`))
console.log(pc.green(`\u2705 feed/checksums.txt written \u2014 ${checksumFiles.length} files`))
