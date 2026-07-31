import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises"
import pc from "picocolors"
import { buildFeed } from "./compile.js"
import { loadAdvisories } from "./load.js"
import { validateAdvisories } from "./validate.js"
import { toOsv } from "./osv.js"
import { buildCompactFeed, buildFeedDelta, feedCursor } from "./delta.js"
import type { FeedDelta } from "./delta.js"
import { EMPTY_HISTORY, appendHistory, historyEntry, parseFeedHistory } from "./history.js"
import type { FeedHistory } from "./history.js"
import type { Feed } from "./compile.js"

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

let previousFeed: Feed | undefined
try {
  const existingRaw = await readFile("feed/feed.json", "utf8")
  previousFeed = JSON.parse(existingRaw) as Feed
  if (JSON.stringify(previousFeed.advisories) === JSON.stringify(feed.advisories)) {
    feed.generated = previousFeed.generated
  }
} catch {
  // file doesn't exist yet, keep fresh generated timestamp
}

await mkdir("feed", { recursive: true })
const feedContent = JSON.stringify(feed, null, 2) + "\n"
await writeFile("feed/feed.json", feedContent, "utf8")
await writeFile("feed/index.json", JSON.stringify(index, null, 2) + "\n", "utf8")

const compactFeed = buildCompactFeed(feed)
await writeFile("feed/compact.json", `${JSON.stringify(compactFeed, null, 2)}\n`, "utf8")
let delta: FeedDelta = buildFeedDelta(previousFeed ?? feed, feed)
if (previousFeed && feedCursor(previousFeed) === feedCursor(feed)) {
  try {
    const existingDelta = JSON.parse(await readFile("feed/delta.json", "utf8")) as FeedDelta
    if (existingDelta.to === feedCursor(feed)) delta = existingDelta
  } catch {
    // First incremental compilation: publish an empty self-verifying delta.
  }
}
await writeFile("feed/delta.json", `${JSON.stringify(delta, null, 2)}\n`, "utf8")

const digest = createHash("sha256").update(feedContent).digest("hex")
await writeFile("feed/feed.json.sha256", `${digest}  feed.json\n`, "utf8")

let existingHistory: string | undefined
try {
  existingHistory = await readFile("feed/history.json", "utf8")
} catch {
  // No log yet: this build starts one.
}
let history: FeedHistory = EMPTY_HISTORY
if (existingHistory !== undefined) {
  // A log that cannot be read is not the same as a log that does not exist.
  // Silently starting over would erase exactly the evidence the log exists
  // to preserve, so an unreadable or conflicting history stops the build.
  try {
    history = parseFeedHistory(JSON.parse(existingHistory))
  } catch (error) {
    console.log(
      pc.red(
        `\u274c refusing to compile: feed/history.json is not a valid history \u2014 ${error instanceof Error ? error.message : String(error)}`,
      ),
    )
    process.exit(1)
  }
}
try {
  history = appendHistory(history, historyEntry(feed, digest))
} catch (error) {
  console.log(
    pc.red(
      `\u274c refusing to compile: ${error instanceof Error ? error.message : String(error)}`,
    ),
  )
  process.exit(1)
}
await writeFile("feed/history.json", `${JSON.stringify(history, null, 2)}\n`, "utf8")

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
  "compact.json",
  "delta.json",
  "feed.json",
  "history.json",
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
console.log(pc.green(`\u2705 feed/history.json written \u2014 ${history.entries.length} published state(s)`))
console.log(pc.green(`\u2705 feed/osv written \u2014 ${osvIndex.length} OSV records`))
console.log(pc.green(`\u2705 feed/checksums.txt written \u2014 ${checksumFiles.length} files`))
