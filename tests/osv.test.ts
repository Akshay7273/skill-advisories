import { describe, expect, it } from "vitest"
import { toOsv } from "../src/osv.js"
import type { Advisory } from "../src/types.js"

const advisory: Advisory = {
  schema_version: "1",
  id: "SKA-2026-9999",
  aliases: ["GHSA-xxxx-yyyy-zzzz"],
  type: "malicious",
  summary: "A malicious test package used for OSV conversion.",
  details: "Conversion details.",
  severity: "critical",
  behaviors: ["credential-theft"],
  artifacts: [
    {
      ecosystem: "npm",
      name: "bad-package",
      publisher: "bad-actor",
      versions: ["1.0.0"],
      sha256: ["a".repeat(64)],
    },
  ],
  references: [{ type: "REPORT", url: "https://example.com/report" }],
  published: "2026-07-01T00:00:00Z",
  modified: "2026-07-02T00:00:00Z",
}

describe("OSV export", () => {
  it("maps identity, aliases, versions, and references", () => {
    const osv = toOsv(advisory)
    expect(osv.id).toBe("SKA-2026-9999")
    expect(osv.aliases).toEqual(["GHSA-xxxx-yyyy-zzzz"])
    expect(osv.affected[0].package).toEqual({ ecosystem: "npm", name: "bad-package" })
    expect(osv.affected[0].versions).toEqual(["1.0.0"])
    expect(osv.references).toEqual(advisory.references)
  })

  it("preserves native security metadata", () => {
    const osv = toOsv(advisory)
    expect(osv.database_specific.severity).toBe("critical")
    expect(osv.affected[0].database_specific.native_ecosystem).toBe("npm")
    expect(osv.affected[0].database_specific.sha256).toEqual(["a".repeat(64)])
  })

  it("omits wildcard versions because OSV treats missing versions as all", () => {
    const wildcard = {
      ...advisory,
      artifacts: [{ ecosystem: "clawhub", name: "bad-skill", versions: ["*"] }],
    } as Advisory
    expect(toOsv(wildcard).affected[0].versions).toBeUndefined()
  })
})
