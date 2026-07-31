import { describe, expect, it } from "vitest"
import { findReferenceProblems } from "../src/references.js"
import type { Advisory, Reference } from "../src/types.js"

const NOW = Date.parse("2026-08-01T00:00:00Z")

function withReferences(references: Reference[]): { file: string; advisory: Advisory }[] {
  return [
    {
      file: "SKA-2026-0001.json",
      advisory: {
        schema_version: "1",
        id: "SKA-2026-0001",
        type: "malicious",
        summary: "A summary long enough to satisfy the schema.",
        severity: "high",
        artifacts: [{ ecosystem: "npm", name: "example" }],
        references,
        published: "2026-01-01T00:00:00Z",
        modified: "2026-01-01T00:00:00Z",
      },
    },
  ]
}

const problemsFor = (references: Reference[]) =>
  findReferenceProblems(withReferences(references), NOW).map((p) => p.problem)

describe("reference provenance", () => {
  it("accepts a reference with no provenance at all", () => {
    expect(problemsFor([{ type: "REPORT", url: "https://example.com/report" }])).toEqual([])
  })

  it("accepts a fully populated reference", () => {
    expect(
      problemsFor([
        {
          type: "REPORT",
          url: "https://example.com/report",
          archive_url: "https://web.archive.org/web/2026/https://example.com/report",
          retrieved: "2026-07-30T12:00:00Z",
          content_sha256: "a".repeat(64),
        },
      ]),
    ).toEqual([])
  })

  it("rejects a non-http(s) url", () => {
    expect(problemsFor([{ type: "WEB", url: "ftp://example.com/report" }])).toEqual([
      "references[0].url must be an absolute http(s) URL",
    ])
  })

  it("rejects a relative url", () => {
    expect(problemsFor([{ type: "WEB", url: "/report" }])).toEqual([
      "references[0].url must be an absolute http(s) URL",
    ])
  })

  it("rejects a non-http(s) archive_url", () => {
    expect(
      problemsFor([
        { type: "WEB", url: "https://example.com/a", archive_url: "about:blank" },
      ]),
    ).toEqual(["references[0].archive_url must be an absolute http(s) URL"])
  })

  it("rejects a retrieved timestamp in the future", () => {
    expect(
      problemsFor([
        { type: "WEB", url: "https://example.com/a", retrieved: "2027-01-01T00:00:00Z" },
      ]),
    ).toEqual(["references[0].retrieved is in the future"])
  })

  it("tolerates small clock skew on retrieved", () => {
    expect(
      problemsFor([
        { type: "WEB", url: "https://example.com/a", retrieved: "2026-08-01T00:01:00Z" },
      ]),
    ).toEqual([])
  })

  it("rejects a content hash with no retrieval time", () => {
    expect(
      problemsFor([
        { type: "WEB", url: "https://example.com/a", content_sha256: "b".repeat(64) },
      ]),
    ).toEqual(["references[0].content_sha256 requires references[0].retrieved"])
  })

  it("reports the index of the offending reference", () => {
    expect(
      problemsFor([
        { type: "WEB", url: "https://example.com/ok" },
        { type: "WEB", url: "mailto:someone@example.com" },
      ]),
    ).toEqual(["references[1].url must be an absolute http(s) URL"])
  })
})

describe("reference hygiene", () => {
  it("rejects the same url cited twice", () => {
    expect(
      problemsFor([
        { type: "REPORT", url: "https://example.com/report" },
        { type: "ARTICLE", url: "https://example.com/report" },
      ]),
    ).toEqual(["references[1].url duplicates an earlier reference"])
  })

  it("treats a fragment-only difference as the same page", () => {
    expect(
      problemsFor([
        { type: "REPORT", url: "https://example.com/report" },
        { type: "REPORT", url: "https://example.com/report#findings" },
      ]),
    ).toEqual(["references[1].url duplicates an earlier reference"])
  })

  it("treats a trailing slash as the same page", () => {
    expect(
      problemsFor([
        { type: "REPORT", url: "https://example.com/report/" },
        { type: "REPORT", url: "https://example.com/report" },
      ]),
    ).toEqual(["references[1].url duplicates an earlier reference"])
  })

  it("keeps distinct paths on one host separate", () => {
    expect(
      problemsFor([
        { type: "REPORT", url: "https://example.com/part-1" },
        { type: "REPORT", url: "https://example.com/part-2" },
      ]),
    ).toEqual([])
  })

  it("rejects a bare domain as evidence", () => {
    expect(problemsFor([{ type: "WEB", url: "https://example.com" }])).toEqual([
      "references[0].url cites a bare domain; link the specific report",
    ])
  })

  it("rejects a bare domain written with a trailing slash", () => {
    expect(problemsFor([{ type: "WEB", url: "https://example.com/" }])).toEqual([
      "references[0].url cites a bare domain; link the specific report",
    ])
  })

  it("accepts a root path carrying a query", () => {
    expect(problemsFor([{ type: "WEB", url: "https://example.com/?id=4172" }])).toEqual([])
  })

  it("allows separate advisories to cite one campaign writeup", () => {
    const shared = "https://example.com/campaign-writeup"
    const [first] = withReferences([{ type: "REPORT", url: shared }])
    const second = {
      file: "SKA-2026-0002.json",
      advisory: { ...first.advisory, id: "SKA-2026-0002" },
    }
    expect(findReferenceProblems([first, second], NOW)).toEqual([])
  })
})
