import { Client } from "@modelcontextprotocol/client"
import { InMemoryTransport } from "@modelcontextprotocol/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Feed } from "../src/compile.js"
import { buildFeed } from "../src/compile.js"
import { loadAdvisories } from "../src/load.js"
import { createAdvisoryMcpServer } from "../src/mcp.js"

let client: Client
let server: ReturnType<typeof createAdvisoryMcpServer>
let feed: Feed

beforeEach(async () => {
  const loaded = await loadAdvisories("advisories")
  feed = buildFeed(loaded.map(({ advisory }) => advisory)).feed
  server = createAdvisoryMcpServer(feed, "test")
  client = new Client({ name: "skill-advisories-test", version: "1.0.0" })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
})

afterEach(async () => {
  await Promise.all([client.close(), server.close()])
})

describe("MCP server", () => {
  it("advertises three non-destructive, read-only tools", async () => {
    const result = await client.listTools()
    expect(result.tools.map(({ name }) => name).sort()).toEqual([
      "check_artifact",
      "get_advisory",
      "search_advisories",
    ])
    expect(result.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true)
    expect(result.tools.every((tool) => tool.annotations?.destructiveHint === false)).toBe(true)
  })

  it("returns structured, evidence-backed artifact assessments", async () => {
    const result = await client.callTool({
      name: "check_artifact",
      arguments: { name: "omnicogg", ecosystem: "clawhub" },
    })
    expect(result.structuredContent).toMatchObject({
      status: "known-risk",
      matches: [{ id: "SKA-2026-0008", matchedBy: "name" }],
    })
  })

  it("retrieves advisories by identifier", async () => {
    const result = await client.callTool({
      name: "get_advisory",
      arguments: { id: "SKA-2026-0008" },
    })
    expect(result.structuredContent).toMatchObject({
      found: true,
      advisory: { id: "SKA-2026-0008" },
    })
  })

  it("validates tool input at the protocol boundary", async () => {
    const result = await client.callTool({
      name: "check_artifact",
      arguments: { name: "", ecosystem: "unknown" },
    })
    expect(result.isError).toBe(true)
    expect(result.content).toEqual([
      expect.objectContaining({ type: "text", text: expect.stringContaining("Input validation error") }),
    ])
  })
})
