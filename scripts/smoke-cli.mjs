import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(root, "dist", "cli.js")

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

console.log("cli smoke: affected, unaffected, and validation paths passed")
