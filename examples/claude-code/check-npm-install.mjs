#!/usr/bin/env node
import { spawnSync } from "node:child_process"

let input = ""
for await (const chunk of process.stdin) input += chunk

let command = ""
try {
  command = JSON.parse(input)?.tool_input?.command ?? ""
} catch {
  process.stderr.write("skill-advisories hook: invalid Claude Code hook input\n")
  process.exit(2)
}

// This reference hook intentionally handles only direct npm install commands.
// Other package managers and shell expressions should use a dedicated parser.
const match = command.match(/^\s*npm\s+(?:install|i|add)\s+(.+)$/s)
if (!match) process.exit(0)

const packages = match[1]
  .trim()
  .split(/\s+/)
  .filter((value) => !value.startsWith("-"))
  .map((value) => {
    if (value.startsWith("@")) {
      const slash = value.indexOf("/")
      const version = value.indexOf("@", slash)
      return version === -1 ? value : value.slice(0, version)
    }
    return value.split("@")[0]
  })
  .filter(Boolean)

if (packages.length === 0) process.exit(0)

const result = spawnSync(
  "npx",
  [
    "-y",
    "-p",
    "@akshay7273/skill-advisories",
    "skill-advisories",
    "check",
    "--ecosystem",
    "npm",
    "--fail-on",
    "high",
    ...packages,
  ],
  { encoding: "utf8", shell: false },
)

if (result.status === 1) {
  process.stderr.write(result.stdout || "skill-advisories blocked a known-risk npm package\n")
  process.exit(2)
}
if (result.status !== 0) {
  process.stderr.write(result.stderr || "skill-advisories could not complete the pre-install check\n")
  process.exit(2)
}
