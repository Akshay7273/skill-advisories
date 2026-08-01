import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type { Feed } from "../src/compile.js"
import { buildCompactFeed, buildFeedDelta } from "../src/delta.js"
import { EMPTY_HISTORY, appendHistory, historyEntry } from "../src/history.js"
import type { FeedHistory } from "../src/history.js"
import { selectRecoveryPoint } from "../src/rollback.js"
import { VerifyUnavailableError } from "../src/verify.js"

const sha256 = (contents: string) => createHash("sha256").update(contents).digest("hex")

function feed(ids: string[], generated: string): Feed {
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

const serialise = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

/**
 * Write one published state as its own directory, exactly as `compile-cli`
 * writes the live feed, and hand back the history entry that records it. Each
 * copy embeds the history as it stood when that state was current, which is
 * what a real archived release contains.
 */
async function publish(current: Feed, history: FeedHistory) {
  const dir = await mkdtemp(path.join(tmpdir(), "ska-rollback-"))
  const contents = serialise(current)
  const digest = sha256(contents)
  const log = appendHistory(history, historyEntry(current, digest))
  const files: Record<string, string> = {
    "feed.json": contents,
    "compact.json": serialise(buildCompactFeed(current)),
    "delta.json": serialise(buildFeedDelta(current, current)),
    "history.json": serialise(log),
  }
  for (const [name, body] of Object.entries(files)) {
    await writeFile(path.join(dir, name), body, "utf8")
  }
  await writeFile(path.join(dir, "feed.json.sha256"), `${digest}  feed.json\n`, "utf8")
  const manifest = Object.keys(files)
    .sort()
    .map((name) => `${sha256(files[name]!)}  ${name}`)
  await writeFile(path.join(dir, "checksums.txt"), `${manifest.join("\n")}\n`, "utf8")
  return { dir, log }
}

/**
 * Build a run of published states plus the authoritative log covering all of
 * them, written outside every candidate so no copy can vouch for itself.
 */
async function published(...states: Feed[]) {
  const dirs: string[] = []
  let log = EMPTY_HISTORY
  for (const state of states) {
    const result = await publish(state, log)
    dirs.push(result.dir)
    log = result.log
  }
  const root = await mkdtemp(path.join(tmpdir(), "ska-rollback-log-"))
  const historyPath = path.join(root, "history.json")
  await writeFile(historyPath, serialise(log), "utf8")
  return {
    dirs,
    historyPath,
    log,
    cleanup: () => Promise.all([...dirs, root].map((d) => rm(d, { recursive: true, force: true }))),
  }
}

const OLDEST = feed(["SKA-A"], "2026-01-01T00:00:00.000Z")
const MIDDLE = feed(["SKA-A", "SKA-B"], "2026-02-01T00:00:00.000Z")
const NEWEST = feed(["SKA-A", "SKA-B", "SKA-C"], "2026-03-01T00:00:00.000Z")

describe("recovery point selection", () => {
  it("selects the newest published state when every copy verifies", async () => {
    const { dirs, historyPath, cleanup } = await published(OLDEST, MIDDLE, NEWEST)
    const result = await selectRecoveryPoint(historyPath, dirs)
    expect(result.problems).toEqual([])
    expect(result.published).toBe(3)
    expect(result.selected?.dir).toBe(dirs[2])
    expect(result.selected?.generated).toBe(NEWEST.generated)
    await cleanup()
  })

  it("orders candidates by publication, not by the order they were given", async () => {
    const { dirs, historyPath, cleanup } = await published(OLDEST, MIDDLE, NEWEST)
    const result = await selectRecoveryPoint(historyPath, [dirs[1]!, dirs[2]!, dirs[0]!])
    expect(result.candidates.map((c) => c.dir)).toEqual([dirs[2], dirs[1], dirs[0]])
    await cleanup()
  })

  it("falls back to the newest state that still verifies", async () => {
    const { dirs, historyPath, cleanup } = await published(OLDEST, MIDDLE, NEWEST)
    // The newest copy has been tampered with after publication, which is the
    // situation a rollback exists for.
    await writeFile(path.join(dirs[2]!, "feed.json"), serialise(feed(["SKA-X"], "2026-03-01T00:00:00.000Z")), "utf8")
    const result = await selectRecoveryPoint(historyPath, dirs)
    expect(result.selected?.dir).toBe(dirs[1])
    // The rejected copy is still reported, because an operator needs to know
    // what is wrong with the state they are skipping over.
    const rejected = result.candidates.find((c) => c.dir === dirs[2])
    expect(rejected?.problems.join("\n")).toContain("does not match checksums.txt")
    await cleanup()
  })

  it("rejects a copy the trusted log never published", async () => {
    const { dirs, historyPath, cleanup } = await published(OLDEST, MIDDLE)
    // A state that verifies perfectly against evidence of its own making. Only
    // the external log can tell it apart from a genuine release.
    const forged = await publish(feed(["SKA-Z"], "2026-04-01T00:00:00.000Z"), EMPTY_HISTORY)
    const result = await selectRecoveryPoint(historyPath, [...dirs, forged.dir])
    expect(result.selected?.dir).toBe(dirs[1])
    const candidate = result.candidates.find((c) => c.dir === forged.dir)
    expect(candidate?.position).toBeUndefined()
    expect(candidate?.problems.join("\n")).toContain(`does not appear in ${historyPath}`)
    await cleanup()
    await rm(forged.dir, { recursive: true, force: true })
  })

  it("rejects a copy whose bytes differ from the ones published under its cursor", async () => {
    const { dirs, historyPath, log, cleanup } = await published(OLDEST, MIDDLE)
    // A mirror that reserialised the feed it was handed. The advisory set is
    // untouched, so the cursor is identical and only the digest can tell the
    // two documents apart -- and the copy's own evidence has been rebuilt to
    // agree with itself, so only the external log catches it.
    const contents = `${JSON.stringify(MIDDLE, null, 4)}\n`
    const digest = sha256(contents)
    const mirrored = {
      ...log,
      entries: log.entries.map((entry, index) =>
        index === log.entries.length - 1 ? { ...entry, digest } : entry,
      ),
    }
    const files: Record<string, string> = {
      "feed.json": contents,
      "compact.json": serialise(buildCompactFeed(MIDDLE)),
      "delta.json": serialise(buildFeedDelta(MIDDLE, MIDDLE)),
      "history.json": serialise(mirrored),
    }
    for (const [name, body] of Object.entries(files)) {
      await writeFile(path.join(dirs[1]!, name), body, "utf8")
    }
    await writeFile(path.join(dirs[1]!, "feed.json.sha256"), `${digest}  feed.json\n`, "utf8")
    await writeFile(
      path.join(dirs[1]!, "checksums.txt"),
      `${Object.keys(files)
        .sort()
        .map((name) => `${sha256(files[name]!)}  ${name}`)
        .join("\n")}\n`,
      "utf8",
    )
    const result = await selectRecoveryPoint(historyPath, dirs)
    expect(result.selected?.dir).toBe(dirs[0])
    const candidate = result.candidates.find((c) => c.dir === dirs[1])
    expect(candidate?.problems).toEqual([
      `digest ${digest} does not match the digest ${historyPath} published`,
    ])
    await cleanup()
  })

  it("selects nothing when the log itself has been rewritten", async () => {
    const { dirs, historyPath, log, cleanup } = await published(OLDEST, MIDDLE)
    await writeFile(
      historyPath,
      serialise({ ...log, entries: [...log.entries, log.entries[0]!] }),
      "utf8",
    )
    const result = await selectRecoveryPoint(historyPath, dirs)
    // Every copy still verifies against itself. None of them can be trusted,
    // because the authority that would vouch for them is broken.
    expect(result.selected).toBeUndefined()
    expect(result.problems.join("\n")).toContain("appears more than once")
    await cleanup()
  })

  it("reports an unreadable candidate without discarding the others", async () => {
    const { dirs, historyPath, cleanup } = await published(OLDEST, MIDDLE)
    const empty = await mkdtemp(path.join(tmpdir(), "ska-rollback-empty-"))
    const result = await selectRecoveryPoint(historyPath, [...dirs, empty])
    expect(result.selected?.dir).toBe(dirs[1])
    const candidate = result.candidates.find((c) => c.dir === empty)
    expect(candidate?.cursor).toBeUndefined()
    expect(candidate?.problems.join("\n")).toContain("cannot read")
    await cleanup()
    await rm(empty, { recursive: true, force: true })
  })

  it("selects nothing when no candidate survives", async () => {
    const { dirs, historyPath, cleanup } = await published(OLDEST)
    await writeFile(path.join(dirs[0]!, "delta.json"), "{}\n", "utf8")
    const result = await selectRecoveryPoint(historyPath, dirs)
    expect(result.selected).toBeUndefined()
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]!.problems.length).toBeGreaterThan(0)
    await cleanup()
  })

  it("treats a missing or corrupt log as an outage, not a finding", async () => {
    const { dirs, historyPath, cleanup } = await published(OLDEST)
    await expect(selectRecoveryPoint(path.join(dirs[0]!, "absent.json"), dirs)).rejects.toBeInstanceOf(
      VerifyUnavailableError,
    )
    await writeFile(historyPath, "{ not json", "utf8")
    await expect(selectRecoveryPoint(historyPath, dirs)).rejects.toThrow("is not a valid feed history")
    await cleanup()
  })

  it("refuses to choose between no candidates at all", async () => {
    const { historyPath, cleanup } = await published(OLDEST)
    await expect(selectRecoveryPoint(historyPath, [])).rejects.toBeInstanceOf(VerifyUnavailableError)
    await cleanup()
  })
})
