export type AdvisoryType = "malicious" | "vulnerable" | "typosquat" | "compromised" | "test";
export type Ecosystem = "claude-skill" | "claude-plugin" | "clawhub" | "mcp-server" | "npm" | "pypi" | "vscode-extension" | "github-action";
export type Behavior = "credential-theft" | "data-exfiltration" | "backdoor" | "malware-dropper" | "prompt-injection" | "crypto-theft" | "spam" | "other";
export type Severity = "critical" | "high" | "medium" | "low";
export type Reference = {
    type: "REPORT" | "ADVISORY" | "ARTICLE" | "WEB";
    url: string;
};
export type Artifact = {
    ecosystem: Ecosystem;
    name: string;
    publisher?: string;
    versions?: string[];
    sha256?: string[];
};
export type Advisory = {
    schema_version: "1";
    id: string;
    type: AdvisoryType;
    summary: string;
    details?: string;
    severity: Severity;
    behaviors?: Behavior[];
    artifacts: Artifact[];
    references: Reference[];
    credits?: string[];
    published: string;
    modified: string;
    withdrawn?: string;
};
