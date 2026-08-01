import { Client } from "@modelcontextprotocol/client"
import { InMemoryTransport } from "@modelcontextprotocol/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Feed } from "../src/compile.js"
import { buildFeed } from "../src/compile.js"
import { loadAdvisories } from "../src/load.js"
import { buildLock } from "../src/lock.js"
import type { ArtifactLock } from "../src/lock.js"
import { createAdvisoryMcpServer } from "../src/mcp.js"
import { parsePolicy } from "../src/policy.js"
import type { AdvisoryPolicy } from "../src/policy.js"

let client: Client
let server: ReturnType<typeof createAdvisoryMcpServer>
let feed: Feed

/** Connect a throwaway client to a server built over a caller-supplied feed. */
async function connect(over: Feed, policy?: AdvisoryPolicy, lock?: ArtifactLock) {
  const extra = createAdvisoryMcpServer(over, "test", policy, lock)
  const extraClient = new Client({ name: "skill-advisories-test", version: "1.0.0" })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([extra.connect(serverTransport), extraClient.connect(clientTransport)])
  return {
    client: extraClient,
    close: () => Promise.all([extraClient.close(), extra.close()]),
  }
}

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

  it("reports how current the feed is alongside every assessment", async () => {
    const result = await client.callTool({
      name: "check_artifact",
      arguments: { name: "omnicogg", ecosystem: "clawhub" },
    })
    expect(result.structuredContent).toMatchObject({
      feedAge: { status: "fresh", maxAgeHours: 48 },
    })
  })

  it("marks the feed stale when it outlives the policy limit", async () => {
    const stale = { ...feed, generated: new Date(Date.now() - 30 * 3_600_000).toISOString() }
    const session = await connect(stale, parsePolicy({ schemaVersion: "1", maxFeedAgeHours: 6 }))
    try {
      const result = await session.client.callTool({
        name: "check_artifact",
        arguments: { name: "definitely-not-published", ecosystem: "npm" },
      })
      expect(result.structuredContent).toMatchObject({
        status: "no-known-advisory",
        feedAge: { status: "stale", maxAgeHours: 6 },
      })
    } finally {
      await session.close()
    }
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

describe("MCP lock status", () => {
  const digest = (value: string) => value.repeat(64).slice(0, 64)
  const lock = buildLock(
    [
      {
        path: "/home/agent/.claude/skills/reviewed",
        name: "reviewed",
        ecosystem: "claude-skill",
        sha256: digest("a"),
        files: 3,
        incomplete: false,
      },
    ],
    "2026-08-01T00:00:00.000Z",
  )

  /** Run one check_artifact call against a server holding the lockfile above. */
  async function check(args: Record<string, unknown>, policy?: AdvisoryPolicy) {
    const session = await connect(feed, policy, lock)
    try {
      const result = await session.client.callTool({ name: "check_artifact", arguments: args })
      return result.structuredContent as Record<string, unknown>
    } finally {
      await session.close()
    }
  }

  it("reports nothing about approval when no lockfile was supplied", async () => {
    const result = await client.callTool({
      name: "check_artifact",
      arguments: { name: "reviewed", ecosystem: "claude-skill" },
    })
    expect(result.structuredContent).not.toHaveProperty("lock")
  })

  it("approves an artifact whose digest the lockfile recorded", async () => {
    const result = await check({
      name: "reviewed",
      ecosystem: "claude-skill",
      sha256: digest("a"),
    })
    expect(result.lock).toMatchObject({ key: "claude-skill:reviewed", status: "approved" })
  })

  it("reports an artifact the lockfile never approved", async () => {
    const result = await check({ name: "unreviewed", ecosystem: "claude-skill" })
    expect(result.lock).toMatchObject({ status: "unapproved" })
  })

  it("does not let a clean feed answer for an unapproved artifact", async () => {
    // The feed has nothing on this name, so without the lockfile the agent
    // would read no-known-advisory and install it. That silence is exactly the
    // window a lockfile exists to cover.
    const result = await check(
      { name: "unreviewed", ecosystem: "claude-skill" },
      parsePolicy({ schemaVersion: "1" }),
    )
    expect(result).toMatchObject({
      status: "no-known-advisory",
      policyDecision: { decision: "review" },
    })
  })

  it("blocks an unapproved artifact when the policy says to", async () => {
    const result = await check(
      { name: "unreviewed", ecosystem: "claude-skill" },
      parsePolicy({ schemaVersion: "1", unlockedArtifacts: "block" }),
    )
    expect(result.policyDecision).toMatchObject({ decision: "block" })
  })

  it("holds back a locked name supplied without a digest", async () => {
    const result = await check(
      { name: "reviewed", ecosystem: "claude-skill" },
      parsePolicy({ schemaVersion: "1", unlockedArtifacts: "block" }),
    )
    expect(result.lock).toMatchObject({ status: "unverified" })
    expect(result.policyDecision).toMatchObject({ decision: "block" })
  })

  it("leaves the decision alone when the policy allows unapproved artifacts", async () => {
    const result = await check(
      { name: "unreviewed", ecosystem: "claude-skill" },
      parsePolicy({ schemaVersion: "1", unlockedArtifacts: "allow" }),
    )
    expect(result.lock).toMatchObject({ status: "unapproved" })
    expect(result.policyDecision).toMatchObject({ decision: "allow" })
  })
})
