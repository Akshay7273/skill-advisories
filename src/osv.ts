import type { Advisory, Ecosystem } from "./types.js"

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

/**
 * Provenance for one reference, keyed by url so a consumer can join it back
 * to the OSV `references` entry. Only emitted for references that carry at
 * least one provenance field.
 */
export type OsvReferenceProvenance = {
  url: string
  archive_url?: string
  retrieved?: string
  content_sha256?: string
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
  references: Array<{ type: string; url: string }>
  database_specific: {
    type: Advisory["type"]
    severity: Advisory["severity"]
    behaviors?: Advisory["behaviors"]
    credits?: string[]
    reference_provenance?: OsvReferenceProvenance[]
    source: string
  }
}

/**
 * Convert a native SKA advisory into an OSV-compatible record.
 *
 * OSV reference entries are strictly {type, url}, so provenance is stripped
 * from `references` and re-emitted under
 * `database_specific.reference_provenance`, joinable by url. This keeps
 * exports valid for consumers that reject unknown reference keys.
 */
export function toOsv(advisory: Advisory): OsvAdvisory {
  const provenance = advisory.references
    .filter((r) => r.archive_url || r.retrieved || r.content_sha256)
    .map((r) => ({
      url: r.url,
      ...(r.archive_url ? { archive_url: r.archive_url } : {}),
      ...(r.retrieved ? { retrieved: r.retrieved } : {}),
      ...(r.content_sha256 ? { content_sha256: r.content_sha256 } : {}),
    }))

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
    references: advisory.references.map((r) => ({ type: r.type, url: r.url })),
    database_specific: {
      type: advisory.type,
      severity: advisory.severity,
      ...(advisory.behaviors?.length ? { behaviors: advisory.behaviors } : {}),
      ...(advisory.credits?.length ? { credits: advisory.credits } : {}),
      ...(provenance.length ? { reference_provenance: provenance } : {}),
      source: "https://github.com/Akshay7273/skill-advisories",
    },
  }
}
