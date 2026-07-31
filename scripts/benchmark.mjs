#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { cpus, tmpdir, totalmem } from "node:os"
import path from "node:path"
import process from "node:process"
import { performance } from "node:perf_hooks"
import { buildArtifactIndex, matchNames } from "../dist/lookup.js"
import { scanSkills } from "../dist/scan.js"

const options = {
  identities: 100_000,
  artifacts: 250,
  filesPerArtifact: 1,
  bytesPerFile: 128,
  concurrency: 4,
  maxLookupMs: undefined,
  maxScanMs: undefined,
}

function integer(value, flag) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} requires a positive integer`)
  }
  return parsed
}

for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index]
  const value = process.argv[++index]
  if (value === undefined) throw new Error(`${flag} requires a value`)
  if (flag === "--identities") options.identities = integer(value, flag)
  else if (flag === "--artifacts") options.artifacts = integer(value, flag)
  else if (flag === "--files-per-artifact") options.filesPerArtifact = integer(value, flag)
  else if (flag === "--bytes-per-file") options.bytesPerFile = integer(value, flag)
  else if (flag === "--concurrency") options.concurrency = integer(value, flag)
  else if (flag === "--max-lookup-ms") options.maxLookupMs = integer(value, flag)
  else if (flag === "--max-scan-ms") options.maxScanMs = integer(value, flag)
  else throw new Error(`unknown benchmark option: ${flag}`)
}

const feed = {
  schema_version: "1",
  name: "synthetic-benchmark",
  source: "generated locally; contains no third-party code",
  generated: "2026-01-01T00:00:00.000Z",
  advisory_count: 1,
  advisories: [
    {
      schema_version: "1",
      id: "SKA-BENCHMARK-0001",
      type: "test",
      summary: "Synthetic benchmark identity",
      severity: "low",
      artifacts: [{ ecosystem: "claude-skill", name: "synthetic-known-risk" }],
      references: [{ type: "WEB", url: "https://example.invalid/synthetic" }],
      published: "2026-01-01T00:00:00Z",
      modified: "2026-01-01T00:00:00Z",
    },
  ],
}

const queries = Array.from({ length: options.identities }, (_, index) =>
  index === options.identities - 1 ? "synthetic-known-risk" : `synthetic-clean-${index}`,
)
const artifactIndex = buildArtifactIndex(feed)
const lookupStart = performance.now()
const lookupMatches = matchNames(feed, queries, { index: artifactIndex })
const lookupDurationMs = performance.now() - lookupStart

const corpusPath = await mkdtemp(path.join(tmpdir(), "skill-advisories-benchmark-"))
let scanDurationMs
let scanResult
try {
  const content = "x".repeat(options.bytesPerFile)
  for (let artifact = 0; artifact < options.artifacts; artifact++) {
    const artifactPath = path.join(corpusPath, `synthetic-artifact-${artifact}`)
    await mkdir(artifactPath)
    for (let file = 0; file < options.filesPerArtifact; file++) {
      await writeFile(path.join(artifactPath, `file-${file}.txt`), content)
    }
  }
  const scanStart = performance.now()
  scanResult = await scanSkills([corpusPath], feed, { concurrency: options.concurrency })
  scanDurationMs = performance.now() - scanStart
} finally {
  await rm(corpusPath, { recursive: true, force: true })
}

let commit = "unknown"
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
} catch {
  // Source archives may not contain Git metadata.
}

const result = {
  schemaVersion: "1",
  generatedAt: new Date().toISOString(),
  commit,
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(),
    maxRssBytes: process.resourceUsage().maxRSS * 1024,
  },
  corpus: {
    source: "deterministic synthetic generator",
    identities: options.identities,
    artifacts: options.artifacts,
    filesPerArtifact: options.filesPerArtifact,
    bytesPerFile: options.bytesPerFile,
  },
  lookup: {
    durationMs: Number(lookupDurationMs.toFixed(3)),
    identitiesPerSecond: Math.round(options.identities / (lookupDurationMs / 1000)),
    matches: lookupMatches.length,
  },
  filesystemScan: {
    durationMs: Number(scanDurationMs.toFixed(3)),
    artifactsPerSecond: Math.round(options.artifacts / (scanDurationMs / 1000)),
    matches: scanResult.matches.length,
    stats: scanResult.stats,
  },
}

console.log(JSON.stringify(result, null, 2))

if (options.maxLookupMs !== undefined && lookupDurationMs > options.maxLookupMs) {
  process.stderr.write(`lookup exceeded ${options.maxLookupMs}ms regression ceiling\n`)
  process.exitCode = 1
}
if (options.maxScanMs !== undefined && scanDurationMs > options.maxScanMs) {
  process.stderr.write(`filesystem scan exceeded ${options.maxScanMs}ms regression ceiling\n`)
  process.exitCode = 1
}
