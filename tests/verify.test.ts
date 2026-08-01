import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type { Feed } from "../src/compile.js"
import { buildCompactFeed, buildFeedDelta } from "../src/delta.js"
import { EMPTY_HISTORY, appendHistory, historyEntry } from "../src/history.js"
import { VerifyUnavailableError, parseChecksumManifest, verifyFeedDirectory } from "../src/verify.js"

const GENERATED = "2026-01-01T00:00:00.000Z"
/** One hour after GENERATED, so a fixture feed is fresh without wall-clock drift. */
const NOW = Date.parse(GENERATED) + 3_600_000

const sha256 = (contents: string | Buffer) => createHash("sha256").update(contents).digest("hex")

function feed(ids: string[], generated = GENERATED): Feed {
  return {
    schema_version: "1",
    name: "test",
    source: "test",
    generated,
    advisory_count: ids.length,
    advisories: ids.map((id) => ({
      schema_version: "1",
      id,
      type: "malicious",
      summary: id,
      severity: "high",
      artifacts: [{ ecosystem: "npm", name: id.toLowerCase() }],
      references: [{ type: "WEB", url: "https://example.test" }],
      published: "2026-01-01T00:00:00Z",
      modified: "2026-01-01T00:00:00Z",
    })) as Feed["advisories"],
  }
}

/**
 * Write a feed directory the way `src/compile-cli.ts` writes one, so the happy
 * path is genuinely self-consistent rather than agreeing with hand-written
 * expectations. Each failure case then mutates exactly one file.
 */
async function publishFeed(current = feed(["SKA-A"])): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "ska-verify-"))
  const contents = `${JSON.stringify(current, null, 2)}\n`
  const digest = sha256(contents)
  const files: Record<string, string> = {
    "feed.json": contents,
    "compact.json": `${JSON.stringify(buildCompactFeed(current), null, 2)}\n`,
    "delta.json": `${JSON.stringify(buildFeedDelta(current, current), null, 2)}\n`,
    "history.json": `${JSON.stringify(
      appendHistory(EMPTY_HISTORY, historyEntry(current, digest)),
      null,
      2,
    )}\n`,
  }
  for (const [name, body] of Object.entries(files)) {
    await writeFile(path.join(dir, name), body, "utf8")
  }
  await writeFile(path.join(dir, "feed.json.sha256"), `${digest}  feed.json\n`, "utf8")
  const manifest = Object.keys(files)
    .sort()
    .map((name) => `${sha256(files[name]!)}  ${name}`)
  await writeFile(path.join(dir, "checksums.txt"), `${manifest.join("\n")}\n`, "utf8")
  return dir
}

const rewrite = (dir: string, name: string, body: string) =>
  writeFile(path.join(dir, name), body, "utf8")

const readJson = async (dir: string, name: string) =>
  JSON.parse(await readFile(path.join(dir, name), "utf8"))

describe("checksum manifest parsing", () => {
  it("reads sha256sum-formatted lines and ignores blank ones", () => {
    const entries = parseChecksumManifest(`${"a".repeat(64)}  feed.json\n\n${"b".repeat(64)}  osv/index.json\n`)
    expect([...entries]).toEqual([
      ["feed.json", "a".repeat(64)],
      ["osv/index.json", "b".repeat(64)],
    ])
  })

  it("refuses a malformed line rather than skipping it", () => {
    expect(() => parseChecksumManifest(`${"a".repeat(64)} feed.json\n`)).toThrow(
      VerifyUnavailableError,
    )
    expect(() => parseChecksumManifest("not-a-digest  feed.json\n")).toThrow("line 1 is malformed")
  })
})

describe("feed directory verification", () => {
  it("accepts a freshly published feed", async () => {
    const dir = await publishFeed()
    const result = await verifyFeedDirectory(dir, { now: NOW })
    expect(result.problems).toEqual([])
    expect(result.advisoryCount).toBe(1)
    expect(result.checkedFiles).toBe(4)
    expect(result.freshness.status).toBe("fresh")
    await rm(dir, { recursive: true, force: true })
  })

  it("reports a feed whose age exceeds the caller's limit without calling it a problem", async () => {
    const dir = await publishFeed()
    const result = await verifyFeedDirectory(dir, { now: NOW, maxAgeHours: 0 })
    expect(result.freshness.status).toBe("stale")
    // Staleness is the caller's call to escalate, exactly as check/scan treat
    // it, so it must not contaminate the verification verdict.
    expect(result.problems).toEqual([])
    await rm(dir, { recursive: true, force: true })
  })

  it("detects feed bytes altered after publication", async () => {
    const dir = await publishFeed()
    const tampered = feed(["SKA-A"])
    tampered.advisories[0]!.severity = "low"
    await rewrite(dir, "feed.json", `${JSON.stringify(tampered, null, 2)}\n`)
    const result = await verifyFeedDirectory(dir, { now: NOW })
    // One edit invalidates every independent record of the feed at once, and
    // all of them are reported rather than the first.
    expect(result.problems.join("\n")).toContain("does not match feed.json.sha256")
    expect(result.problems.join("\n")).toContain("feed.json digest")
    expect(result.problems.join("\n")).toContain("does not appear in the published history")
    await rm(dir, { recursive: true, force: true })
  })

  it("detects a manifest entry whose file no longer matches", async () => {
    const dir = await publishFeed()
    const delta = await readJson(dir, "delta.json")
    delta.generated = "2026-05-05T00:00:00.000Z"
    await rewrite(dir, "delta.json", `${JSON.stringify(delta, null, 2)}\n`)
    const result = await verifyFeedDirectory(dir, { now: NOW })
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain("delta.json digest")
    expect(result.problems[0]).toContain("does not match checksums.txt")
    await rm(dir, { recursive: true, force: true })
  })

  it("detects a manifest entry with no file behind it", async () => {
    const dir = await publishFeed()
    await rm(path.join(dir, "compact.json"))
    const result = await verifyFeedDirectory(dir, { now: NOW })
    // Reported once, by the manifest loop, and the remaining checks still run:
    // a missing derived artifact must not discard the findings around it.
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain("compact.json is listed in checksums.txt but missing from")
    expect(result.checkedFiles).toBe(3)
    await rm(dir, { recursive: true, force: true })
  })

  it("reports a file the manifest does not cover as missing exactly once", async () => {
    const dir = await publishFeed()
    await rm(path.join(dir, "feed.json.sha256"))
    const result = await verifyFeedDirectory(dir, { now: NOW })
    expect(result.problems).toEqual([`feed.json.sha256 is missing from ${dir}`])
    await rm(dir, { recursive: true, force: true })
  })

  it("detects a compact projection built from a different feed", async () => {
    const dir = await publishFeed()
    const other = feed(["SKA-A", "SKA-B"])
    const compact = `${JSON.stringify(buildCompactFeed(other), null, 2)}\n`
    await rewrite(dir, "compact.json", compact)
    await rewrite(
      dir,
      "checksums.txt",
      (await readFile(path.join(dir, "checksums.txt"), "utf8")).replace(
        /^[a-f0-9]{64}(?=  compact\.json$)/m,
        sha256(compact),
      ),
    )
    const result = await verifyFeedDirectory(dir, { now: NOW })
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain("compact.json cursor")
    await rm(dir, { recursive: true, force: true })
  })

  it("detects a delta that targets a different feed state", async () => {
    const dir = await publishFeed()
    const stale = feed(["SKA-A", "SKA-B"])
    const delta = `${JSON.stringify(buildFeedDelta(stale, stale), null, 2)}\n`
    await rewrite(dir, "delta.json", delta)
    await rewrite(
      dir,
      "checksums.txt",
      (await readFile(path.join(dir, "checksums.txt"), "utf8")).replace(
        /^[a-f0-9]{64}(?=  delta\.json$)/m,
        sha256(delta),
      ),
    )
    const result = await verifyFeedDirectory(dir, { now: NOW })
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain("delta.json targets cursor")
    await rm(dir, { recursive: true, force: true })
  })

  it("detects a feed that never appeared in the published history", async () => {
    const dir = await publishFeed()
    const other = feed(["SKA-EVIL"])
    const history = `${JSON.stringify(
      appendHistory(EMPTY_HISTORY, historyEntry(other, sha256("elsewhere"))),
      null,
      2,
    )}\n`
    await rewrite(dir, "history.json", history)
    await rewrite(
      dir,
      "checksums.txt",
      (await readFile(path.join(dir, "checksums.txt"), "utf8")).replace(
        /^[a-f0-9]{64}(?=  history\.json$)/m,
        sha256(history),
      ),
    )
    const result = await verifyFeedDirectory(dir, { now: NOW })
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain("does not appear in the published history")
    await rm(dir, { recursive: true, force: true })
  })

  it("treats a corrupt history document as a finding, not an outage", async () => {
    const dir = await publishFeed()
    const history = `${JSON.stringify({ schema_version: "1", entries: [{ cursor: "short" }] }, null, 2)}\n`
    await rewrite(dir, "history.json", history)
    await rewrite(
      dir,
      "checksums.txt",
      (await readFile(path.join(dir, "checksums.txt"), "utf8")).replace(
        /^[a-f0-9]{64}(?=  history\.json$)/m,
        sha256(history),
      ),
    )
    const result = await verifyFeedDirectory(dir, { now: NOW })
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain("history.json is not a valid feed history")
    await rm(dir, { recursive: true, force: true })
  })

  it("reports an unreadable directory as an outage, not a finding", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "ska-verify-empty-"))
    await expect(verifyFeedDirectory(dir)).rejects.toBeInstanceOf(VerifyUnavailableError)
    await rm(dir, { recursive: true, force: true })
  })

  it("reports an unparseable feed as an outage, not a finding", async () => {
    const dir = await publishFeed()
    await rewrite(dir, "feed.json", "{ not json")
    await expect(verifyFeedDirectory(dir)).rejects.toThrow("is not valid JSON")
    await rm(dir, { recursive: true, force: true })
  })
})
