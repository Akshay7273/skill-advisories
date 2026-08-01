#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio"
import { parseArtifactLock } from "./lock.js"
import { DEFAULT_FEED_URL, loadFeed } from "./lookup.js"
import { createAdvisoryMcpServer } from "./mcp.js"
import { loadPolicy } from "./policy.js"

const VERSION: string = createRequire(import.meta.url)("../package.json").version

let source = DEFAULT_FEED_URL
let offline = false
let refresh = false
let policyPath: string | undefined
let lockPath: string | undefined
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index]
  if (argument === "--feed") {
    source = process.argv[++index] ?? ""
    if (!source) throw new Error("--feed requires a URL or local path")
  } else if (argument === "--offline") {
    offline = true
  } else if (argument === "--refresh") {
    refresh = true
  } else if (argument === "--policy") {
    policyPath = process.argv[++index]
    if (!policyPath) throw new Error("--policy requires a local JSON file path")
  } else if (argument === "--lockfile") {
    lockPath = process.argv[++index]
    if (!lockPath) throw new Error("--lockfile requires a local JSON file path")
  } else {
    throw new Error(`unknown MCP server option: ${argument}`)
  }
}
if (offline && refresh) throw new Error("--offline and --refresh are mutually exclusive")

const feed = await loadFeed(source, { offline, refresh, strict: true })
const policy = policyPath ? await loadPolicy(policyPath) : undefined
// Read once at startup rather than per call. A lockfile is committed, so it
// does not change under a running server, and re-reading it on every tool call
// would let a mid-session edit silently change what the server approves.
const lock = lockPath ? parseArtifactLock(JSON.parse(await readFile(lockPath, "utf8"))) : undefined
const server = createAdvisoryMcpServer(feed, VERSION, policy, lock)
const transport = new StdioServerTransport()
await server.connect(transport)
