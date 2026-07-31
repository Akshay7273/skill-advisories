import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const health = JSON.parse(await readFile("site/health.json", "utf8"))
assert.equal(health.schemaVersion, "1")
assert.equal(health.status, "healthy", JSON.stringify(health, null, 2))
assert.equal(health.integrity.checkedFiles, health.integrity.validFiles)
assert.equal(health.integrity.mismatches.length, 0)
assert.ok(health.feed.advisoryCount > 0)
assert.ok(health.feed.ageHours >= 0)
console.log(
  `health: ${health.integrity.validFiles} checksums valid; feed age ${health.feed.ageHours}h`,
)
