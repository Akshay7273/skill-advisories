#!/usr/bin/env node
import { createRequire } from "node:module"
import pc from "picocolors"
import type { Feed } from "./compile.js"
import { DEFAULT_FEED_URL, collectKnownNames, loadFeed, matchHashes, matchNames } from "./lookup.js"
import type { Advisory } from "./types.js"
import { defaultSkillDirs, scanSkills } from "./scan.js"
import type { ScanMatch, ScanWarning } from "./scan.js"
import { findNearMatches } from "./typosquat.js"
import { buildSarif, meetsThreshold } from "./sarif.js"
import type { SarifFinding } from "./sarif.js"

const VERSION: string = createRequire(import.meta.url)("../package.json").version

const HELP = `skill-advisories ${VERSION} — open advisory database for AI agent skills

Usage:
  skill-advisories check <name...>   Check skill names against the advisory feed
  skill-advisories check --sha256 <hash...>  Check SHA-256 file hashes against the advisory feed
  skill-advisories scan [dir...]     Scan installed skill directories (defaults to known locations)

Options:
  --format <format> Output format: human, json, or sarif (default: human)
  --json           Alias for --format json
  --fail-on <sev>  Minimum severity to trigger exit code 1: low, medium, high, critical
  --feed <source>  Feed URL or local file path (default: official feed)
  --sha256         Treat positional arguments as SHA-256 hashes
  --strict         Exit code 1 on typosquat warnings even if no exact match is found
  --offline        Use cached feed only; fail if cache is missing
  --refresh        Ignore cached feed; force network download
  --help, -h       Show this help
  --version, -v    Show version

Exit codes: 0 = no advisories matched (or below threshold), 1 = matches found (or warnings with --strict), 2 = usage or feed error`

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
  failOn?: string
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  let format: "human" | "json" | "sarif" = "human"
  let feed = DEFAULT_FEED_URL
  let sha256 = false
  let strict = false
  let offline = false
  let refresh = false
  let failOn: string | undefined = undefined

  const VALID_FORMATS = ["human", "json", "sarif"]
  const VALID_SEVERITIES = ["low", "medium", "high", "critical"]

  for (let i = 0; i < argv.length; i++) {
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
    } else if (arg === "--sha256") {
      sha256 = true
    } else if (arg === "--strict") {
      strict = true
    } else if (arg === "--offline") {
      offline = true
    } else if (arg === "--refresh") {
      refresh = true
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
  return { command, positionals: rest, format, feed, sha256, strict, offline, refresh, failOn }
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
          checked,
          matchCount: matches.length,
          matches: matches.map((m) => {
            const item: Record<string, any> = {
              query: m.query,
              id: m.advisory.id,
              type: m.advisory.type,
              severity: m.advisory.severity,
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
        },
        null,
        2,
      ),
    )
  } else {
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
        const matchedDetail =
          m.matchedBy === "sha256"
            ? ` (file hash ${m.file ? `${m.file}: ` : ""}${m.sha256})`
            : ""
        console.log(
          `  ${pc.bold(m.query)} \u2192 ${m.advisory.id} [${m.advisory.severity}] ${m.advisory.summary}${matchedDetail}`,
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
  process.exitCode = triggerFailure || (strict && hasWarnings) ? 1 : 0
}

const args = parseArgs(process.argv.slice(2))

if (!args.command) {
  console.log(HELP)
  process.exit(2)
}

const feedOptions = { offline: args.offline, refresh: args.refresh, strict: args.strict }

if (args.command === "check") {
  if (args.positionals.length === 0) fail("check requires at least one skill name or hash")
  const feed = await loadFeedOrFail(args.feed, feedOptions)

  if (args.sha256) {
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
            matchedBy: "sha256",
            sha256: hh.sha256,
          })
        }
      }
    }
    report(args.positionals.length, matches, [], args.format, args.strict, args.failOn)
  } else {
    const nameHits = matchNames(feed, args.positionals)
    const matches: ScanMatch[] = nameHits.map((nh) => ({
      query: nh.query,
      advisory: nh.advisory,
      artifactNames: nh.artifactNames,
      matchedBy: "name",
    }))

    const matchedQueries = new Set(matches.map((m) => m.query.toLowerCase()))
    const knownNames = collectKnownNames(feed)
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

    report(args.positionals.length, matches, warnings, args.format, args.strict, args.failOn)
  }
} else if (args.command === "scan") {
  const dirs = args.positionals.length > 0 ? args.positionals : defaultSkillDirs()
  const feed = await loadFeedOrFail(args.feed, feedOptions)
  const result = await scanSkills(dirs, feed)

  if (args.format === "human") {
    for (const d of result.installed) {
      console.log(pc.dim(`scanning ${d.dir} (${d.names.length} skills)`))
    }
    if (result.installed.length === 0) {
      console.log(pc.yellow("no skill directories found"))
    }
  }

  report(result.scannedCount, result.matches, result.warnings, args.format, args.strict, args.failOn)
} else {
  fail(`unknown command "${args.command}"`)
}
