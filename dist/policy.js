import { readFile } from "node:fs/promises";
import * as z from "zod/v4";
import { meetsThreshold } from "./sarif.js";
import { ECOSYSTEMS } from "./types.js";
export const AdvisoryPolicySchema = z
    .object({
    $schema: z.string().url().optional(),
    schemaVersion: z.literal("1"),
    failOn: z.enum(["low", "medium", "high", "critical"]).default("high"),
    deniedEcosystems: z.array(z.enum(ECOSYSTEMS)).default([]),
    requireHash: z.boolean().default(false),
    warnings: z.enum(["allow", "review", "block"]).default("review"),
})
    .strict();
export function parsePolicy(input) {
    return AdvisoryPolicySchema.parse(input);
}
export async function loadPolicy(path) {
    const raw = await readFile(path, "utf8");
    try {
        return parsePolicy(JSON.parse(raw));
    }
    catch (error) {
        throw new Error(`invalid advisory policy ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
export function evaluatePolicy(assessment, policy) {
    const reasons = [];
    const ecosystem = assessment.query.ecosystem;
    if (ecosystem && policy.deniedEcosystems.includes(ecosystem)) {
        reasons.push(`ecosystem ${ecosystem} is denied by policy`);
    }
    if (policy.requireHash && !assessment.query.sha256) {
        reasons.push("a SHA-256 artifact identity is required by policy");
    }
    for (const match of assessment.matches) {
        if (meetsThreshold(match.severity, policy.failOn)) {
            reasons.push(`${match.id} has ${match.severity} severity (policy threshold: ${policy.failOn})`);
        }
    }
    if (reasons.length > 0)
        return { decision: "block", reasons, policy };
    if (assessment.warnings.length > 0 && policy.warnings !== "allow") {
        return {
            decision: policy.warnings,
            reasons: ["artifact name resembles a known advisory identity"],
            policy,
        };
    }
    return { decision: "allow", reasons: [], policy };
}
