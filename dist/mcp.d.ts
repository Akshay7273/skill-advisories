import { McpServer } from "@modelcontextprotocol/server";
import type { Feed } from "./compile.js";
import type { AdvisoryPolicy } from "./policy.js";
export declare function createAdvisoryMcpServer(feed: Feed, version: string, policy?: AdvisoryPolicy): McpServer;
