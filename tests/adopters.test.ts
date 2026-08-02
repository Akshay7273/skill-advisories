import { readFile } from "node:fs/promises"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import { describe, expect, it } from "vitest"
import {
  type Adopter,
  adoptionGateMet,
  parseAdopters,
  verifiedAdopters,
} from "../src/adopters.js"

const RECORDED = "2026-08-02T00:00:00.000Z"

function adopter(extra: Partial<Adopter> = {}): Adopter {
  return {
    name: "example-agent-tools",
    url: "https://github.com/example/agent-tools/blob/main/.github/workflows/ci.yml",
    integration: "action",
    consent: "public-link",
    consent_url: "https://github.com/Akshay7273/skill-advisories/issues/12#issuecomment-1",
    recorded: RECORDED,
    verified: true,
    ...extra,
  }
}

const ledger = (entries: Adopter[]) => ({ schema_version: "1" as const, entries })

describe("adoption ledger", () => {
  it("round-trips a recorded integration and rejects a malformed one", () => {
    const parsed = parseAdopters(ledger([adopter()]))
    expect(parsed.entries).toHaveLength(1)
    expect(() => parseAdopters({ schema_version: "1" })).toThrow()
    expect(() => parseAdopters(ledger([{ ...adopter(), unexpected: true } as Adopter]))).toThrow()
  })

  it("refuses a link that is not https", () => {
    // The ledger exists to be checked by someone who trusts nobody in it, and
    // a link they cannot trust the transport of is not evidence.
    expect(() => parseAdopters(ledger([adopter({ url: "http://example.com/ci.yml" })]))).toThrow()
    expect(() =>
      parseAdopters(ledger([adopter({ consent_url: "http://example.com/consent" })])),
    ).toThrow()
  })

  it("refuses the same integration URL twice", () => {
    // One project can appear more than once -- Action in CI, MCP server
    // locally -- so the name is not the identity. The same URL twice is a
    // duplicate or a disagreement, and either way the count stops meaning one
    // thing.
    expect(() => parseAdopters(ledger([adopter(), adopter({ name: "renamed" })]))).toThrow(
      "more than once",
    )
    const distinct = parseAdopters(
      ledger([
        adopter(),
        adopter({ url: "https://github.com/example/agent-tools/blob/main/.mcp.json" }),
      ]),
    )
    expect(distinct.entries).toHaveLength(2)
  })

  it("counts only entries that are verified and carry public consent", () => {
    // Both halves are load-bearing: verified is a maintainer saying they
    // followed the links, consent_url is the adopter's own word that they may
    // be listed. Either alone is this project asserting something about
    // somebody else's.
    expect(verifiedAdopters(parseAdopters(ledger([adopter()])))).toHaveLength(1)
    expect(
      verifiedAdopters(parseAdopters(ledger([adopter({ verified: false })]))),
    ).toHaveLength(0)
    expect(
      verifiedAdopters(parseAdopters(ledger([adopter({ consent_url: undefined })]))),
    ).toHaveLength(0)
  })

  it("reports the gate closed while nothing is verified", () => {
    expect(adoptionGateMet(parseAdopters(ledger([])))).toBe(false)
    expect(adoptionGateMet(parseAdopters(ledger([adopter({ verified: false })])))).toBe(false)
    expect(adoptionGateMet(parseAdopters(ledger([adopter()])))).toBe(true)
  })

  it("validates the committed ledger against its public schema", async () => {
    const ajv = new Ajv2020({ allErrors: true })
    addFormats(ajv)
    const validate = ajv.compile(JSON.parse(await readFile("schema/adopters.schema.json", "utf8")))
    const committed = JSON.parse(await readFile("adopters.json", "utf8"))
    expect(validate(committed), ajv.errorsText(validate.errors)).toBe(true)
    // Parses under the runtime schema too, so the published document and this
    // module cannot drift apart unnoticed.
    expect(() => parseAdopters(committed)).not.toThrow()
  })

  it("validates a fully populated entry against the published schema", async () => {
    const ajv = new Ajv2020({ allErrors: true })
    addFormats(ajv)
    const validate = ajv.compile(JSON.parse(await readFile("schema/adopters.schema.json", "utf8")))
    const populated = ledger([
      adopter({ consent: "maintainer-stated", integration: "mcp", notes: "pilot, one release" }),
    ])
    expect(validate(populated), ajv.errorsText(validate.errors)).toBe(true)
  })
})
