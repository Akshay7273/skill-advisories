import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { assessArtifact, searchAdvisories } from "./intelligence.js";
import { evaluatePolicy } from "./policy.js";
import { ECOSYSTEMS } from "./types.js";
const READ_ONLY = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
};
function toolResult(value) {
    return {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
    };
}
export function createAdvisoryMcpServer(feed, version, policy) {
    const server = new McpServer({ name: "skill-advisories", version });
    server.registerTool("check_artifact", {
        title: "Check an agent artifact",
        description: "Check a skill, plugin, package, or MCP server against evidence-backed advisories before installation.",
        inputSchema: z.object({
            name: z.string().min(1),
            ecosystem: z.enum(ECOSYSTEMS).optional(),
            version: z.string().min(1).optional(),
            sha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
        }),
        annotations: READ_ONLY,
    }, async (query) => {
        const assessment = assessArtifact(feed, query);
        return toolResult(policy ? { ...assessment, policyDecision: evaluatePolicy(assessment, policy) } : assessment);
    });
    server.registerTool("get_advisory", {
        title: "Get an advisory",
        description: "Retrieve one advisory and its public evidence by SKA identifier or alias.",
        inputSchema: z.object({ id: z.string().min(3) }),
        annotations: READ_ONLY,
    }, async ({ id }) => {
        const normalized = id.toLowerCase();
        const advisory = feed.advisories.find((candidate) => candidate.id.toLowerCase() === normalized ||
            candidate.aliases?.some((alias) => alias.toLowerCase() === normalized));
        return toolResult(advisory ? { found: true, advisory } : { found: false, id });
    });
    server.registerTool("search_advisories", {
        title: "Search advisories",
        description: "Search advisories by text, ecosystem, and severity.",
        inputSchema: z.object({
            query: z.string().optional(),
            ecosystem: z.enum(ECOSYSTEMS).optional(),
            severity: z.enum(["low", "medium", "high", "critical"]).optional(),
            limit: z.number().int().min(1).max(50).optional(),
        }),
        annotations: READ_ONLY,
    }, async (options) => {
        const advisories = searchAdvisories(feed, options);
        return toolResult({ count: advisories.length, advisories });
    });
    return server;
}
