#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import pc from "picocolors"
import type { Feed } from "./compile.js"
import { describeFreshness, evaluateFreshness } from "./freshness.js"
import type { Freshness } from "./freshness.js"
import { LOCK_FILE_NAME, buildLock, diffLock, parseArtifactLock } from "./lock.js"
import type { ArtifactLock } from "./lock.js"
import { DEFAULT_FEED_URL, collectKnownNames, loadFeed, matchHashes, matchNames } from "./lookup.js"
import { evaluateLockDrift, loadPolicy, parsePolicy } from "./policy.js"
import { ECOSYSTEMS } from "./types.js"
import type { Advisory, Ecosystem } from "./types.js"
import { defaultSkillDirs, observeArtifacts, scanSkills } from "./scan.js"
import type { ScanMatch, ScanStats, ScanWarning } from "./scan.js"
import { findNearMatches } from "./typosquat.js"
import { buildSarif, meetsThreshold } from "./sarif.js"
import type { SarifFinding } from "./sarif.js"
import { VerifyUnavailableError, verifyFeedDirectory } from "./verify.js"
import type { VerifyResult } from "./verify.js"

const VERSION: string = createRequire(import.meta.url)("../package.json").version

const HELP = `skill-advisories ${VERSION} — open advisory database for AI agent skills

Usage:
  skill-advisories check <name...>   Check skill names against the advisory feed
  skill-advisories check --sha256 <hash...>  Check SHA-256 file hashes against the advisory feed
  skill-advisories scan [dir...]     Scan installed skill directories (defaults to known locations)
  skill-advisories verify [dir]       Verify a published feed directory against its own checksums and history (default: feed)
  skill-advisories lock [dir...]      Record the artifacts installed in these directories as approved
  skill-advisories lock --check       Compare installed artifacts against the lockfile without writing

Options:
  --format <format> Output format: human, json, or sarif (default: human)
  --json           Alias for --format json
  --fail-on <sev>  Minimum severity to trigger exit code 1: low, medium, high, critical
  --feed <source>  Feed URL or local file path (default: official feed)
  --ecosystem <id> Restrict name checks to one artifact ecosystem
  --version <value> Restrict name checks to an installed artifact version
  --sha256         Treat positional arguments as SHA-256 hashes
  --strict         Exit code 1 on typosquat warnings even if no exact match is found
  --offline        Use cached feed only; fail if cache is missing
  --refresh        Ignore cached feed; force network download
  --concurrency <n> Scan this many artifacts concurrently (default: 4)
  --hash-concurrency <n> Hash this many files per artifact concurrently (default: 4)
  --max-file-bytes <n> Skip files larger than this many bytes (default: 10485760)
  --max-files <n> Hash at most this many files per artifact (default: 10000)
  --max-total-bytes <n> Hash at most this many bytes per artifact (default: 268435456)
  --exclude-dir <name> Skip an exact directory basename; may be repeated
  --allow-incomplete Continue when files exceed budgets or cannot be read
  --max-feed-age <hours> Warn when the feed is older than this (default: 48);
                   exit code 2 instead of a warning under --strict
  --check          For lock: report drift against the lockfile without writing it
  --lockfile <path> Path to the artifact lockfile (default: skill-advisories.lock.json)
  --policy <path>  Policy file deciding whether lock drift fails (default: built-in defaults)
  --help, -h       Show this help
  --version, -v    Show version

Exit codes: 0 = no advisories matched (or below threshold), 1 = matches found (or warnings with --strict), 2 = usage, feed, or incomplete-evidence error
For verify: 0 = the directory matches its own evidence, 1 = it does not, 2 = the check could not run
For lock --check: 0 = installed artifacts match the lockfile, 1 = drift the policy rejects, 2 = the check could not run`

function fail(message: string): never {
  console.error(pc.red(`error: ${message}`))
  process.exit(2)
}

type ParsedArgs = {
  command?: string
  positionals: string[]
  format: "human" | "json" | "sarif"
  feed: string
  sha256: boolean
  strict: boolean
  offline: boolean
  refresh: boolean
  ecosystem?: Ecosystem
  version?: string
  failOn?: string
  scanConcurrency?: number
  hashConcurrency?: number
  maxFileBytes?: number
  maxFiles?: number
  maxTotalBytes?: number
  excludeDirectories: string[]
  allowIncomplete: boolean
  maxFeedAgeHours?: number
  check: boolean
  lockfile?: string
  policy?: string
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  let format: "human" | "json" | "sarif" = "human"
  let feed = DEFAULT_FEED_URL
  let sha256 = false
  let strict = false
  let offline = false
  let refresh = false
  let ecosystem: Ecosystem | undefined = undefined
  let version: string | undefined = undefined
  let failOn: string | undefined = undefined
  let scanConcurrency: number | undefined
  let hashConcurrency: number | undefined
  let maxFileBytes: number | undefined
  let maxFiles: number | undefined
  let maxTotalBytes: number | undefined
  const excludeDirectories: string[] = []
  let allowIncomplete = false
  let maxFeedAgeHours: number | undefined
  let check = false
  let lockfile: string | undefined
  let policy: string | undefined

  const VALID_FORMATS = ["human", "json", "sarif"]
  const VALID_SEVERITIES = ["low", "medium", "high", "critical"]
  let i = 0

  function readInteger(flag: string, allowZero = false): number {
    const raw = argv[++i]
    const value = Number(raw)
    if (!raw || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
      fail(`${flag} requires ${allowZero ? "a non-negative" : "a positive"} integer`)
    }
    return value
  }

  for (; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--json") {
      format = "json"
    } else if (arg === "--format") {
      i++
      const value = argv[i]
      if (!value || !VALID_FORMATS.includes(value)) {
        fail(`invalid format "${value ?? ""}", expected human, json, or sarif`)
      }
      format = value as "human" | "json" | "sarif"
    } else if (arg === "--fail-on") {
      i++
      const value = argv[i]
      if (!value || !VALID_SEVERITIES.includes(value.toLowerCase())) {
        fail(`invalid severity threshold "${value ?? ""}", expected low, medium, high, or critical`)
      }
      failOn = value.toLowerCase()
    } else if (arg === "--feed") {
      i++
      const value = argv[i]
      if (!value) fail("--feed requires a value")
      feed = value
    } else if (arg === "--ecosystem") {
      i++
      const value = argv[i]
      if (!value || !ECOSYSTEMS.includes(value as Ecosystem)) {
        fail(`invalid ecosystem "${value ?? ""}", expected one of: ${ECOSYSTEMS.join(", ")}`)
      }
      ecosystem = value as Ecosystem
    } else if (arg === "--version" && argv[i + 1] && !argv[i + 1].startsWith("-")) {
      i++
      const value = argv[i]
      if (!value || value.trim() === "") fail("--version requires a value")
      version = value.trim()
    } else if (arg === "--sha256") {
      sha256 = true
    } else if (arg === "--strict") {
      strict = true
    } else if (arg === "--offline") {
      offline = true
    } else if (arg === "--refresh") {
      refresh = true
    } else if (arg === "--concurrency") {
      scanConcurrency = readInteger(arg)
    } else if (arg === "--hash-concurrency") {
      hashConcurrency = readInteger(arg)
    } else if (arg === "--max-file-bytes") {
      maxFileBytes = readInteger(arg, true)
    } else if (arg === "--max-files") {
      maxFiles = readInteger(arg)
    } else if (arg === "--max-total-bytes") {
      maxTotalBytes = readInteger(arg, true)
    } else if (arg === "--exclude-dir") {
      const value = argv[++i]
      if (!value || value.trim() === "") fail("--exclude-dir requires a directory basename")
      if (value.includes("/") || value.includes("\\")) {
        fail("--exclude-dir accepts a basename, not a path")
      }
      excludeDirectories.push(value)
    } else if (arg === "--allow-incomplete") {
      allowIncomplete = true
    } else if (arg === "--max-feed-age") {
      maxFeedAgeHours = readInteger(arg)
    } else if (arg === "--check") {
      check = true
    } else if (arg === "--lockfile") {
      i++
      const value = argv[i]
      if (!value || value.trim() === "") fail("--lockfile requires a path")
      lockfile = value
    } else if (arg === "--policy") {
      i++
      const value = argv[i]
      if (!value || value.trim() === "") fail("--policy requires a path")
      policy = value
    } else if (arg === "--help" || arg === "-h") {
      console.log(HELP)
      process.exit(0)
    } else if (arg === "--version" || arg === "-v") {
      console.log(VERSION)
      process.exit(0)
    } else if (arg.startsWith("--")) {
      fail(`unknown option "${arg}"`)
    } else {
      positionals.push(arg)
    }
  }

  if (offline && refresh) {
    fail("--offline and --refresh are mutually exclusive")
  }

  const [command, ...rest] = positionals
  return {
    command,
    positionals: rest,
    format,
    feed,
    sha256,
    strict,
    offline,
    refresh,
    ecosystem,
    version,
    failOn,
    scanConcurrency,
    hashConcurrency,
    maxFileBytes,
    maxFiles,
    maxTotalBytes,
    excludeDirectories,
    allowIncomplete,
    maxFeedAgeHours,
    check,
    lockfile,
    policy,
  }
}

async function loadFeedOrFail(
  source: string,
  options: { offline?: boolean; refresh?: boolean; strict?: boolean },
): Promise<Feed> {
  try {
    return await loadFeed(source, options)
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  }
}

function report(
  checked: number,
  matches: ScanMatch[],
  warnings: ScanWarning[],
  format: "human" | "json" | "sarif",
  strict: boolean,
  failOn?: string,
  scanStats?: ScanStats,
  allowIncomplete = false,
  freshness?: Freshness,
): void {
  if (format === "sarif") {
    const findings: SarifFinding[] = matches.map((m) => ({
      advisoryId: m.advisory.id,
      severity: m.advisory.severity,
      summary: m.advisory.summary,
      artifactName: m.query,
      matchedBy: m.matchedBy,
      file: m.file,
    }))
    console.log(JSON.stringify(buildSarif(findings, VERSION), null, 2))
  } else if (format === "json") {
    console.log(
      JSON.stringify(
        {
          schemaVersion: "1",
          checked,
          matchCount: matches.length,
          matches: matches.map((m) => {
            const item: Record<string, any> = {
              query: m.query,
              id: m.advisory.id,
              type: m.advisory.type,
              severity: m.advisory.severity,
              ecosystems: m.artifactEcosystems,
              ...(m.version ? { version: m.version } : {}),
              summary: m.advisory.summary,
              references: m.advisory.references.map((r) => r.url),
            }
            if (m.matchedBy) item.matchedBy = m.matchedBy
            if (m.file) item.file = m.file
            if (m.sha256) item.sha256 = m.sha256
            return item
          }),
          warnings: warnings.map((w) => ({
            name: w.name,
            similarTo: w.similarTo,
            distance: w.distance,
          })),
          ...(scanStats ? { scan: scanStats } : {}),
          ...(freshness ? { feedAge: freshness } : {}),
        },
        null,
        2,
      ),
    )
  } else {
    if (freshness && freshness.status !== "fresh") {
      console.error(pc.yellow(`\u26a0 ${describeFreshness(freshness)}`))
    }
    if (
      scanStats &&
      (scanStats.skippedLargeFiles > 0 ||
        scanStats.budgetExhausted ||
        scanStats.unreadableEntries > 0)
    ) {
      console.error(
        pc.yellow(
          `\u26a0 scan incomplete: ${scanStats.skippedLargeFiles} oversized, ${scanStats.skippedBudgetFiles} over budget, ${scanStats.unreadableEntries} unreadable`,
        ),
      )
    }
    for (const w of warnings) {
      console.error(
        pc.yellow(
          `\u26a0 possible typosquat: "${w.name}" is ${w.distance} edit(s) away from known-bad "${w.similarTo}"`,
        ),
      )
    }

    if (matches.length === 0) {
      console.log(pc.green(`\u2705 ${checked} skill(s) checked \u2014 no advisories matched`))
    } else {
      console.log(
        pc.red(
          `\u274c ${matches.length} advisory match(es) across ${checked} skill(s) checked:`,
        ),
      )
      for (const m of matches) {
        const identityDetail = `${m.version ? `@${m.version}` : ""} [${m.artifactEcosystems.join(", ")}]`
        const matchedDetail =
          m.matchedBy === "sha256"
            ? ` (file hash ${m.file ? `${m.file}: ` : ""}${m.sha256})`
            : ""
        console.log(
          `  ${pc.bold(m.query)}${identityDetail} \u2192 ${m.advisory.id} [${m.advisory.severity}] ${m.advisory.summary}${matchedDetail}`,
        )
        for (const ref of m.advisory.references) {
          console.log(`      ${ref.url}`)
        }
      }
    }
  }

  let triggerFailure = false
  if (failOn) {
    triggerFailure = matches.some((m) => meetsThreshold(m.advisory.severity, failOn))
  } else {
    triggerFailure = matches.length > 0
  }

  const hasWarnings = warnings.length > 0
  const scanIncomplete =
    scanStats !== undefined &&
    (scanStats.skippedLargeFiles > 0 ||
      scanStats.skippedBudgetFiles > 0 ||
      scanStats.unreadableEntries > 0)
  // A stale feed is an operational fault, not an advisory finding: the data
  // could not be shown to be current, so it joins the exit-2 family rather
  // than reporting a match that was never made. Warn-only by default so an
  // offline run does not start failing builds on its own.
  const feedNotCurrent = freshness !== undefined && freshness.status !== "fresh"
  process.exitCode = (scanIncomplete && !allowIncomplete) || (feedNotCurrent && strict)
    ? 2
    : triggerFailure || (strict && hasWarnings)
      ? 1
      : 0
}

const args = parseArgs(process.argv.slice(2))

if (!args.command) {
  console.log(HELP)
  process.exit(2)
}

const feedOptions = { offline: args.offline, refresh: args.refresh, strict: args.strict }

if (args.command === "check") {
  if (
    args.scanConcurrency !== undefined ||
    args.hashConcurrency !== undefined ||
    args.maxFileBytes !== undefined ||
    args.maxFiles !== undefined ||
    args.maxTotalBytes !== undefined ||
    args.excludeDirectories.length > 0 ||
    args.allowIncomplete
  ) {
    fail("scan resource options are only supported by the scan command")
  }
  if (args.positionals.length === 0) fail("check requires at least one skill name or hash")
  const feed = await loadFeedOrFail(args.feed, feedOptions)
  const freshness = evaluateFreshness(feed, { maxAgeHours: args.maxFeedAgeHours })

  if (args.sha256) {
    if (args.ecosystem) fail("--ecosystem cannot be combined with --sha256")
    if (args.version) fail("--version cannot be combined with --sha256")
    for (const h of args.positionals) {
      if (!/^[0-9a-fA-F]{64}$/.test(h)) {
        fail(`invalid SHA-256 hash "${h}"`)
      }
    }
    const hashHits = matchHashes(feed, args.positionals)
    const advisoryMap = new Map<string, Advisory>()
    for (const adv of feed.advisories) advisoryMap.set(adv.id, adv)

    const matches: ScanMatch[] = []
    for (const hh of hashHits) {
      for (const advId of hh.advisoryIds) {
        const adv = advisoryMap.get(advId)
        if (adv) {
          matches.push({
            query: hh.sha256,
            advisory: adv,
            artifactNames: adv.artifacts.map((a) => a.name),
            artifactEcosystems: [...new Set(adv.artifacts.map((a) => a.ecosystem))],
            matchedBy: "sha256",
            sha256: hh.sha256,
          })
        }
      }
    }
    report(
      args.positionals.length,
      matches,
      [],
      args.format,
      args.strict,
      args.failOn,
      undefined,
      false,
      freshness,
    )
  } else {
    const nameHits = matchNames(feed, args.positionals, {
      ecosystem: args.ecosystem,
      version: args.version,
    })
    const matches: ScanMatch[] = nameHits.map((nh) => ({
      query: nh.query,
      advisory: nh.advisory,
      artifactNames: nh.artifactNames,
      artifactEcosystems: nh.artifactEcosystems,
      version: nh.version,
      matchedBy: "name",
    }))

    const matchedQueries = new Set(matches.map((m) => m.query.toLowerCase()))
    const knownNames = collectKnownNames(feed, args.ecosystem)
    const warnings: ScanWarning[] = []

    for (const q of args.positionals) {
      if (!matchedQueries.has(q.toLowerCase())) {
        const near = findNearMatches(q, knownNames)
        for (const nm of near) {
          warnings.push({
            name: q,
            similarTo: nm.name,
            distance: nm.distance,
          })
        }
      }
    }

    report(
      args.positionals.length,
      matches,
      warnings,
      args.format,
      args.strict,
      args.failOn,
      undefined,
      false,
      freshness,
    )
  }
} else if (args.command === "scan") {
  if (args.version) fail("--version is only supported by the check command")
  const dirs = args.positionals.length > 0 ? args.positionals : defaultSkillDirs()
  const feed = await loadFeedOrFail(args.feed, feedOptions)
  const freshness = evaluateFreshness(feed, { maxAgeHours: args.maxFeedAgeHours })
  const result = await scanSkills(dirs, feed, {
    ecosystem: args.ecosystem,
    concurrency: args.scanConcurrency,
    hash: {
      concurrency: args.hashConcurrency,
      maxFileBytes: args.maxFileBytes,
      maxFiles: args.maxFiles,
      maxTotalBytes: args.maxTotalBytes,
      excludeDirectories: args.excludeDirectories,
    },
  })

  if (args.format === "human") {
    for (const d of result.installed) {
      console.log(pc.dim(`scanning ${d.dir} (${d.names.length} skills)`))
    }
    if (result.installed.length === 0) {
      console.log(pc.yellow("no skill directories found"))
    }
  }

  report(
    result.scannedCount,
    result.matches,
    result.warnings,
    args.format,
    args.strict,
    args.failOn,
    result.stats,
    args.allowIncomplete,
    freshness,
  )
} else if (args.command === "verify") {
  if (
    args.scanConcurrency !== undefined ||
    args.hashConcurrency !== undefined ||
    args.maxFileBytes !== undefined ||
    args.maxFiles !== undefined ||
    args.maxTotalBytes !== undefined ||
    args.excludeDirectories.length > 0 ||
    args.allowIncomplete
  ) {
    fail("scan resource options are only supported by the scan command")
  }
  if (args.sha256) fail("--sha256 is only supported by the check command")
  if (args.ecosystem) fail("--ecosystem is only supported by the check and scan commands")
  if (args.version) fail("--version is only supported by the check command")
  // verify reads a directory on disk, so the flags that decide where a feed
  // comes from have nothing to act on.
  if (args.offline || args.refresh) fail("verify reads a local directory and never fetches a feed")
  if (args.format === "sarif") {
    fail("verify reports on a feed directory, not on artifacts, so it has no SARIF form")
  }
  if (args.positionals.length > 1) fail("verify accepts at most one directory")

  let result: VerifyResult
  try {
    result = await verifyFeedDirectory(args.positionals[0] ?? "feed", {
      maxAgeHours: args.maxFeedAgeHours,
    })
  } catch (error) {
    // The check could not run at all. That is the same class of fault as an
    // unreachable feed, so it exits 2 rather than claiming a failed verification.
    if (error instanceof VerifyUnavailableError) fail(error.message)
    throw error
  }

  if (args.format === "json") {
    console.log(JSON.stringify({ schemaVersion: "1", ...result }, null, 2))
  } else {
    if (result.freshness.status !== "fresh") {
      console.error(pc.yellow(`\u26a0 ${describeFreshness(result.freshness)}`))
    }
    if (result.problems.length === 0) {
      console.log(
        pc.green(
          `\u2705 ${result.dir} verified \u2014 ${result.advisoryCount} advisories, ${result.checkedFiles} file(s) checked`,
        ),
      )
      console.log(pc.dim(`   digest ${result.digest}`))
      console.log(pc.dim(`   cursor ${result.cursor}`))
    } else {
      console.log(
        pc.red(
          `\u274c ${result.dir} failed verification \u2014 ${result.problems.length} problem(s):`,
        ),
      )
      for (const problem of result.problems) {
        console.log(`  ${problem}`)
      }
    }
  }

  const feedNotCurrent = result.freshness.status !== "fresh"
  process.exitCode = feedNotCurrent && args.strict ? 2 : result.problems.length > 0 ? 1 : 0
} else if (args.command === "lock") {
  if (args.sha256) fail("--sha256 is only supported by the check command")
  if (args.version) fail("--version is only supported by the check command")
  if (args.failOn) fail("--fail-on decides about advisories, and lock reads no feed")
  if (args.maxFeedAgeHours !== undefined) fail("--max-feed-age is not meaningful without a feed")
  // A lockfile answers a question about the disk alone, so nothing here needs
  // the network and the flags that decide where a feed comes from have nothing
  // to act on.
  if (args.offline || args.refresh) fail("lock reads local directories and never fetches a feed")
  if (args.format === "sarif") {
    fail("lock reports on approved identities, not on findings, so it has no SARIF form")
  }
  // An artifact whose hash stopped short cannot be approved and cannot be
  // compared, so a flag that waves budget exhaustion through would either
  // record a digest covering part of a directory or hide drift behind it.
  if (args.allowIncomplete) fail("lock cannot approve or compare a partially hashed artifact")

  const lockfile = args.lockfile ?? LOCK_FILE_NAME
  const policy = args.policy
    ? await loadPolicy(args.policy).catch((error: unknown) =>
        fail(error instanceof Error ? error.message : String(error)),
      )
    : parsePolicy({ schemaVersion: "1" })

  const dirs = args.positionals.length > 0 ? args.positionals : defaultSkillDirs()
  const observation = await observeArtifacts(dirs, {
    ecosystem: args.ecosystem,
    concurrency: args.scanConcurrency,
    hash: {
      concurrency: args.hashConcurrency,
      maxFileBytes: args.maxFileBytes,
      maxFiles: args.maxFiles,
      maxTotalBytes: args.maxTotalBytes,
      excludeDirectories: args.excludeDirectories,
    },
  })

  if (args.format === "human") {
    for (const d of observation.installed) {
      console.log(pc.dim(`reading ${d.dir} (${d.names.length} skills)`))
    }
    if (observation.installed.length === 0) {
      console.log(pc.yellow("no skill directories found"))
    }
  }

  const existing = await readFile(lockfile, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    return fail(`cannot read ${lockfile}: ${error.message}`)
  })
  let previous: ArtifactLock | undefined
  if (existing !== undefined) {
    try {
      previous = parseArtifactLock(JSON.parse(existing))
    } catch (error) {
      fail(`invalid lockfile ${lockfile}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (args.check) {
    // Without a lockfile there is nothing to compare against. That is a check
    // that could not run rather than a check that found drift, so it exits 2.
    if (!previous) fail(`cannot check against ${lockfile}: the lockfile does not exist`)
    const drift = diffLock(previous, observation.artifacts)
    const decision = evaluateLockDrift(drift, policy)
    // review reports drift without failing, which is what lets a repository
    // adopt a lockfile before it is ready to enforce one. --strict is the
    // existing way a caller says it wants the softer signal to count.
    const rejected = decision.decision === "block" || (decision.decision === "review" && args.strict)

    if (args.format === "json") {
      console.log(
        JSON.stringify(
          {
            schemaVersion: "1",
            lockfile,
            decision: decision.decision,
            reasons: decision.reasons,
            drift,
            stats: observation.stats,
          },
          null,
          2,
        ),
      )
    } else if (decision.reasons.length === 0) {
      console.log(
        pc.green(
          `\u2705 ${lockfile} matches the artifacts installed \u2014 ${drift.matched.length} approved`,
        ),
      )
      if (drift.missing.length > 0) {
        console.log(pc.dim(`   ${drift.missing.length} approved artifact(s) are not installed`))
      }
    } else {
      const colour = rejected ? pc.red : pc.yellow
      const mark = rejected ? "\u274c" : "\u26a0"
      console.log(colour(`${mark} ${lockfile} \u2014 ${decision.reasons.length} problem(s):`))
      for (const reason of decision.reasons) {
        console.log(`  ${reason}`)
      }
    }

    process.exitCode = rejected ? 1 : 0
  } else {
    let lock: ArtifactLock
    try {
      lock = buildLock(observation.artifacts, new Date().toISOString(), previous)
    } catch (error) {
      // Locking a digest that covers part of a directory, or one of two
      // artifacts that share an identity, would approve something nobody read.
      fail(error instanceof Error ? error.message : String(error))
    }

    const serialised = `${JSON.stringify(lock, null, 2)}\n`
    // Rewriting identical bytes would dirty a working tree on every run, so a
    // lock that changes nothing leaves the file alone.
    const changed = serialised !== existing
    if (changed) await writeFile(lockfile, serialised, "utf8")

    if (args.format === "json") {
      console.log(
        JSON.stringify(
          {
            schemaVersion: "1",
            lockfile,
            written: changed,
            generated: lock.generated,
            artifacts: lock.artifacts.length,
            stats: observation.stats,
          },
          null,
          2,
        ),
      )
    } else if (changed) {
      console.log(
        pc.green(`\u2705 wrote ${lockfile} \u2014 ${lock.artifacts.length} artifact(s) approved`),
      )
    } else {
      console.log(
        pc.dim(`${lockfile} already approves these ${lock.artifacts.length} artifact(s)`),
      )
    }
  }
} else {
  fail(`unknown command "${args.command}"`)
}
