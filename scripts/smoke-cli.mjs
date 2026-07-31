import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(root, "dist", "cli.js")
const packageVersion = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  })
}

const affected = run([
  "check",
  "rankaj",
  "--feed",
  "feed/feed.json",
  "--ecosystem",
  "clawhub",
  "--version",
  "1.0.0",
  "--json",
])
assert.equal(affected.status, 1, affected.stderr)
const result = JSON.parse(affected.stdout)
assert.equal(result.schemaVersion, "1")
assert.equal(result.matches[0].version, "1.0.0")
assert.deepEqual(result.matches[0].ecosystems, ["clawhub"])

const unaffected = run([
  "check",
  "rankaj",
  "--feed",
  "feed/feed.json",
  "--ecosystem",
  "clawhub",
  "--version",
  "2.0.0",
  "--json",
])
assert.equal(unaffected.status, 0, unaffected.stderr)

const invalid = run(["check", "rankaj", "--ecosystem", "not-real"])
assert.equal(invalid.status, 2)

const version = run(["--version"])
assert.equal(version.status, 0, version.stderr)
assert.equal(version.stdout.trim(), packageVersion)

const scanRoot = mkdtempSync(path.join(tmpdir(), "ska-smoke-"))
try {
  const artifact = path.join(scanRoot, "bounded-smoke-artifact")
  mkdirSync(artifact)
  writeFileSync(path.join(artifact, "a.txt"), "a")
  writeFileSync(path.join(artifact, "b.txt"), "b")
  const bounded = run([
    "scan",
    scanRoot,
    "--feed",
    "feed/feed.json",
    "--max-files",
    "1",
    "--json",
  ])
  assert.equal(bounded.status, 2, bounded.stderr)
  const boundedResult = JSON.parse(bounded.stdout)
  assert.equal(boundedResult.scan.hashedFiles, 1)
  assert.equal(boundedResult.scan.skippedBudgetFiles, 1)
  assert.equal(boundedResult.scan.budgetExhausted, true)

  const allowed = run([
    "scan",
    scanRoot,
    "--feed",
    "feed/feed.json",
    "--max-files",
    "1",
    "--allow-incomplete",
    "--json",
  ])
  assert.equal(allowed.status, 0, allowed.stderr)

  // A feed dated well past --max-feed-age must be reported but must not fail a
  // build on its own; only --strict promotes staleness to an exit code.
  const staleFeedPath = path.join(scanRoot, "stale-feed.json")
  const staleFeed = JSON.parse(readFileSync(path.join(root, "feed", "feed.json"), "utf8"))
  staleFeed.generated = new Date(Date.now() - 240 * 60 * 60 * 1000).toISOString()
  writeFileSync(staleFeedPath, JSON.stringify(staleFeed))

  const staleWarn = run(["check", "rankaj", "--feed", staleFeedPath, "--json"])
  assert.equal(staleWarn.status, 1, staleWarn.stderr)
  const staleResult = JSON.parse(staleWarn.stdout)
  assert.equal(staleResult.feedAge.status, "stale")
  assert.equal(staleResult.feedAge.maxAgeHours, 48)
  assert.ok(staleResult.feedAge.ageHours >= 240)

  const staleStrict = run(["check", "omnicog", "--feed", staleFeedPath, "--strict", "--json"])
  assert.equal(staleStrict.status, 2, staleStrict.stderr)

  const staleTolerated = run([
    "check",
    "omnicog",
    "--feed",
    staleFeedPath,
    "--strict",
    "--max-feed-age",
    "480",
    "--json",
  ])
  assert.notEqual(staleTolerated.status, 2)
  assert.equal(JSON.parse(staleTolerated.stdout).feedAge.status, "fresh")
} finally {
  rmSync(scanRoot, { recursive: true, force: true })
}

console.log(
  "cli smoke: version, detection, validation, bounded scan, and feed freshness paths passed",
)
