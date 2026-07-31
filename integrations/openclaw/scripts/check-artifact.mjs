#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import path from "node:path"
import process from "node:process"

if (process.argv.length < 3) {
  process.stderr.write("usage: check-artifact.mjs <skill-name> [skill-advisories options]\n")
  process.exit(2)
}

const localCli = process.env.SKILL_ADVISORIES_CLI
const command = localCli ? process.execPath : process.platform === "win32" ? "npx.cmd" : "npx"
const prefix = localCli
  ? [path.resolve(localCli)]
  : ["-y", "-p", "@akshay7273/skill-advisories", "skill-advisories"]
const result = spawnSync(
  command,
  [...prefix, "check", "--ecosystem", "clawhub", "--fail-on", "high", ...process.argv.slice(2)],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: false },
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) {
  process.stderr.write(`skill-advisories could not start: ${result.error.message}\n`)
  process.exit(2)
}
process.exit(result.status ?? 2)
