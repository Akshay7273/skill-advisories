import type { Feed } from "./compile.js";
import type { Ecosystem, Severity } from "./types.js";
export type ArtifactQuery = {
    name: string;
    ecosystem?: Ecosystem;
    version?: string;
    sha256?: string;
};
export type ArtifactAssessment = {
    status: "known-risk" | "review" | "no-known-advisory";
    query: ArtifactQuery;
    matches: Array<{
        id: string;
        severity: Severity;
        type: string;
        summary: string;
        matchedBy: "name" | "sha256";
        references: string[];
    }>;
    warnings: Array<{
        similarTo: string;
        distance: number;
    }>;
    disclaimer: string;
};
/** Evaluate an artifact without implying that an absent advisory proves safety. */
export declare function assessArtifact(feed: Feed, query: ArtifactQuery): ArtifactAssessment;
export declare function searchAdvisories(feed: Feed, options: {
    query?: string;
    ecosystem?: Ecosystem;
    severity?: Severity;
    limit?: number;
}): import("./types.js").Advisory[];
