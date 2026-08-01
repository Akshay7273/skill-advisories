import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod/v4"
import type { Feed } from "./compile.js"
import { evaluateFreshness } from "./freshness.js"
import { assessArtifact, searchAdvisories } from "./intelligence.js"
import { lockStatus } from "./lock.js"
import type { ArtifactLock } from "./lock.js"
import { evaluatePolicy } from "./policy.js"
import type { AdvisoryPolicy } from "./policy.js"
import { ECOSYSTEMS } from "./types.js"

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  }
}

export function createAdvisoryMcpServer(
  feed: Feed,
  version: string,
  policy?: AdvisoryPolicy,
  lock?: ArtifactLock,
): McpServer {
  const server = new McpServer({ name: "skill-advisories", version })

  server.registerTool(
    "check_artifact",
    {
      title: "Check an agent artifact",
      description:
        "Check a skill, plugin, package, or MCP server against evidence-backed advisories before installation.",
      inputSchema: z.object({
        name: z.string().min(1),
        ecosystem: z.enum(ECOSYSTEMS).optional(),
        version: z.string().min(1).optional(),
        sha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
      }),
      annotations: READ_ONLY,
    },
    async (query) => {
      const assessment = assessArtifact(feed, query)
      // Computed per call, not once at startup: a long-lived server hands the
      // same feed out for hours, and an agent reading "no-known-advisory"
      // deserves to know how old the evidence behind that answer is.
      const feedAge = evaluateFreshness(feed, { maxAgeHours: policy?.maxFeedAgeHours })
      // The feed answers "is this known bad", which is silent for anything not
      // yet disclosed. The lockfile answers "is this what was reviewed", which
      // is exactly the gap, so an agent deciding whether to install something
      // gets both or neither.
      const status = lock ? lockStatus(lock, query) : undefined
      return toolResult({
        ...assessment,
        feedAge,
        ...(status ? { lock: status } : {}),
        ...(policy ? { policyDecision: evaluatePolicy(assessment, policy, status) } : {}),
      })
    },
  )

  server.registerTool(
    "get_advisory",
    {
      title: "Get an advisory",
      description: "Retrieve one advisory and its public evidence by SKA identifier or alias.",
      inputSchema: z.object({ id: z.string().min(3) }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const normalized = id.toLowerCase()
      const advisory = feed.advisories.find(
        (candidate) =>
          candidate.id.toLowerCase() === normalized ||
          candidate.aliases?.some((alias) => alias.toLowerCase() === normalized),
      )
      return toolResult(advisory ? { found: true, advisory } : { found: false, id })
    },
  )

  server.registerTool(
    "search_advisories",
    {
      title: "Search advisories",
      description: "Search advisories by text, ecosystem, and severity.",
      inputSchema: z.object({
        query: z.string().optional(),
        ecosystem: z.enum(ECOSYSTEMS).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      annotations: READ_ONLY,
    },
    async (options) => {
      const advisories = searchAdvisories(feed, options)
      return toolResult({ count: advisories.length, advisories })
    },
  )

  return server
}
