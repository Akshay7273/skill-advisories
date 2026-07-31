import type { Advisory, Ecosystem, Reference } from "./types.js"

const OSV_ECOSYSTEMS: Record<Ecosystem, string> = {
  "claude-skill": "Claude Skill",
  "claude-plugin": "Claude Plugin",
  clawhub: "ClawHub",
  "mcp-server": "MCP Server",
  npm: "npm",
  pypi: "PyPI",
  "vscode-extension": "VSCode Extension",
  "github-action": "GitHub Actions",
}

export type OsvAdvisory = {
  id: string
  aliases?: string[]
  summary: string
  details?: string
  published: string
  modified: string
  withdrawn?: string
  affected: Array<{
    package: { ecosystem: string; name: string }
    versions?: string[]
    database_specific: {
      native_ecosystem: Ecosystem
      publisher?: string
      sha256?: string[]
    }
  }>
  references: Reference[]
  database_specific: {
    type: Advisory["type"]
    severity: Advisory["severity"]
    behaviors?: Advisory["behaviors"]
    credits?: string[]
    source: string
  }
}

/** Convert a native SKA advisory into an OSV-compatible record. */
export function toOsv(advisory: Advisory): OsvAdvisory {
  return {
    id: advisory.id,
    ...(advisory.aliases?.length ? { aliases: advisory.aliases } : {}),
    summary: advisory.summary,
    ...(advisory.details ? { details: advisory.details } : {}),
    published: advisory.published,
    modified: advisory.modified,
    ...(advisory.withdrawn ? { withdrawn: advisory.withdrawn } : {}),
    affected: advisory.artifacts.map((artifact) => {
      const versions = artifact.versions?.filter((version) => version !== "*")
      return {
        package: {
          ecosystem: OSV_ECOSYSTEMS[artifact.ecosystem],
          name: artifact.name,
        },
        ...(versions?.length ? { versions } : {}),
        database_specific: {
          native_ecosystem: artifact.ecosystem,
          ...(artifact.publisher ? { publisher: artifact.publisher } : {}),
          ...(artifact.sha256?.length ? { sha256: artifact.sha256 } : {}),
        },
      }
    }),
    references: advisory.references,
    database_specific: {
      type: advisory.type,
      severity: advisory.severity,
      ...(advisory.behaviors?.length ? { behaviors: advisory.behaviors } : {}),
      ...(advisory.credits?.length ? { credits: advisory.credits } : {}),
      source: "https://github.com/Akshay7273/skill-advisories",
    },
  }
}
