import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"

const vscode = JSON.parse(await readFile("integrations/vscode/mcp.json", "utf8"))
assert.equal(vscode.servers["skill-advisories"].type, "stdio")
assert.ok(vscode.servers["skill-advisories"].args.includes("skill-advisories-mcp"))

const openClaw = spawnSync(
  process.execPath,
  [
    "integrations/openclaw/scripts/check-artifact.mjs",
    "omnicogg",
    "--feed",
    "feed/feed.json",
  ],
  {
    encoding: "utf8",
    env: { ...process.env, SKILL_ADVISORIES_CLI: "dist/cli.js", FORCE_COLOR: "0" },
  },
)
assert.equal(openClaw.status, 1, openClaw.stderr)
assert.match(openClaw.stdout, /SKA-2026-0008/)
assert.match(openClaw.stdout, /https:\/\//)

console.log("integrations: VS Code MCP config and OpenClaw launcher passed")
