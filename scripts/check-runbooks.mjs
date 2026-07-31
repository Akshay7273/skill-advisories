import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const required = {
  "docs/operations/triage.md": ["# Advisory triage runbook", "## Evidence decision", "## Completion record"],
  "docs/operations/correction.md": ["# Correction and withdrawal runbook", "## Verification", "## Communication"],
  "docs/operations/release.md": ["# Release runbook", "## Candidate verification", "## Post-release verification"],
  "docs/operations/incident.md": ["# Compromised release response", "## Containment", "## Closure evidence"],
  "docs/operations/rollback.md": ["# Last-known-good feed recovery", "## Recovery procedure", "## Validation"],
}

const index = await readFile("docs/operations/README.md", "utf8")
for (const [file, headings] of Object.entries(required)) {
  const contents = await readFile(file, "utf8")
  for (const heading of headings) assert.ok(contents.includes(heading), `${file}: missing ${heading}`)
  assert.ok(!/\b(?:TODO|TBD)\b/.test(contents), `${file}: unresolved placeholder`)
  assert.ok(index.includes(file.split("/").at(-1)), `${file}: missing from operations index`)
}
console.log(`operations: ${Object.keys(required).length} runbooks structurally complete`)
