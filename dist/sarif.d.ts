export declare function severityToLevel(severity: string): "error" | "warning" | "note";
export type SarifFinding = {
    advisoryId: string;
    severity: string;
    summary: string;
    artifactName: string;
    matchedBy: "name" | "sha256";
    file?: string;
};
export declare function buildSarif(findings: SarifFinding[], toolVersion: string): unknown;
export declare function meetsThreshold(severity: string, failOn: string): boolean;
