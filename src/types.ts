export type AdvisoryType = "malicious" | "vulnerable" | "typosquat" | "compromised" | "test"

export const ECOSYSTEMS = [
  "claude-skill",
  "claude-plugin",
  "clawhub",
  "mcp-server",
  "npm",
  "pypi",
  "vscode-extension",
  "github-action",
] as const

export type Ecosystem = (typeof ECOSYSTEMS)[number]

export type Behavior =
  | "credential-theft"
  | "data-exfiltration"
  | "backdoor"
  | "malware-dropper"
  | "prompt-injection"
  | "crypto-theft"
  | "spam"
  | "other"

export type Severity = "critical" | "high" | "medium" | "low"

export type Reference = {
  type: "REPORT" | "ADVISORY" | "ARTICLE" | "WEB"
  url: string
  /** Archived copy of url, for when the original rots. */
  archive_url?: string
  /** RFC 3339 timestamp at which url was read and any hash taken. */
  retrieved?: string
  /** SHA-256 of the retrieved body, so a later reader can detect edits. */
  content_sha256?: string
}

export type Artifact = {
  ecosystem: Ecosystem
  name: string
  publisher?: string
  versions?: string[]
  sha256?: string[]
}

export type Advisory = {
  schema_version: "1"
  id: string
  aliases?: string[]
  type: AdvisoryType
  summary: string
  details?: string
  severity: Severity
  behaviors?: Behavior[]
  artifacts: Artifact[]
  references: Reference[]
  credits?: string[]
  published: string
  modified: string
  withdrawn?: string
}
