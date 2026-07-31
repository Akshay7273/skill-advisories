import * as z from "zod/v4";
import type { ArtifactAssessment } from "./intelligence.js";
export declare const AdvisoryPolicySchema: z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    schemaVersion: z.ZodLiteral<"1">;
    failOn: z.ZodDefault<z.ZodEnum<{
        critical: "critical";
        high: "high";
        medium: "medium";
        low: "low";
    }>>;
    deniedEcosystems: z.ZodDefault<z.ZodArray<z.ZodEnum<{
        "claude-skill": "claude-skill";
        "claude-plugin": "claude-plugin";
        clawhub: "clawhub";
        "mcp-server": "mcp-server";
        npm: "npm";
        pypi: "pypi";
        "vscode-extension": "vscode-extension";
        "github-action": "github-action";
    }>>>;
    requireHash: z.ZodDefault<z.ZodBoolean>;
    warnings: z.ZodDefault<z.ZodEnum<{
        review: "review";
        allow: "allow";
        block: "block";
    }>>;
}, z.core.$strict>;
export type AdvisoryPolicy = z.infer<typeof AdvisoryPolicySchema>;
export type PolicyDecision = {
    decision: "allow" | "review" | "block";
    reasons: string[];
    policy: AdvisoryPolicy;
};
export declare function parsePolicy(input: unknown): AdvisoryPolicy;
export declare function loadPolicy(path: string): Promise<AdvisoryPolicy>;
export declare function evaluatePolicy(assessment: ArtifactAssessment, policy: AdvisoryPolicy): PolicyDecision;
