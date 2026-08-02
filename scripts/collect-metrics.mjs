/**
 * Collect the readiness signals into a dated, append-only log.
 *
 * The readiness report promised "an automated, dated report rather than
 * overwritten without history" and delivered a hand-typed table, which had
 * drifted from 823 npm downloads to a recorded 303 by the time anyone checked.
 * This replaces the typing. Every value carries the URL it came from, so the
 * claim can be re-derived rather than trusted.
 *
 * Like `check-references.mjs`, this exits 0 no matter what the network says. A
 * rate-limited API is not a broken build, and the failure mode it guards
 * against is worse than a missing row: a source that does not answer records
 * `null`, never the previous run's value carried forward. `--check` does no
 * network I/O at all and only validates the committed log, so CI never depends
 * on three third parties being up.
 *
 * On what is deliberately absent: there is no "dependents" signal. The registry
 * search API accepts `depends:<pkg>` and ignores it -- `depends:express`
 * returns 0 while an unencoded query returns tens of thousands of full-text
 * matches. No public endpoint answers "who depends on this", so the honest
 * option is to omit it rather than log a number that means something else.
 * Adoption is what `adopters.json` records, and that is filled in by hand from
 * evidence a person checked.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { appendMetrics, parseMetricsHistory, verifyMetricsChain } from "../dist/metrics.js"

const USER_AGENT = "skill-advisories-metrics (+https://github.com/Akshay7273/skill-advisories)"
const PACKAGE = "@akshay7273/skill-advisories"
const REPO = "Akshay7273/skill-advisories"

const options = {
  out: "metrics/history.json",
  timeoutMs: 15_000,
  check: false,
}

const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  const value = () => {
    const next = argv[++i]
    if (next === undefined) throw new Error(`${arg} requires a value`)
    return next
  }
  if (arg === "--out") options.out = value()
  else if (arg === "--timeout-ms") options.timeoutMs = Number(value())
  else if (arg === "--check") options.check = true
  else throw new Error(`unknown option: ${arg}`)
}
if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1) {
  throw new Error("--timeout-ms must be a positive integer")
}

async function readHistory({ allowMissing }) {
  try {
    return parseMetricsHistory(JSON.parse(await readFile(options.out, "utf8")))
  } catch (error) {
    if (error.code === "ENOENT" && allowMissing) return { schema_version: "1", entries: [] }
    throw error
  }
}

/**
 * `--check` is the CI path: the log is already committed, so validating it is
 * reading a file. A malformed or reordered log is a real failure -- unlike an
 * unreachable API, it is entirely within this repository's control. So is a
 * missing one: the collector may start from nothing, but a check that found no
 * file to read has not passed, it has failed to run.
 */
if (options.check) {
  let history
  try {
    history = await readHistory({ allowMissing: false })
  } catch (error) {
    console.error(`❌ ${options.out} is not a usable metrics log`)
    console.error(`   ${error.message}`)
    process.exit(1)
  }
  const problems = verifyMetricsChain(history)
  for (const problem of problems) console.error(`❌ ${problem}`)
  if (problems.length > 0) process.exit(1)
  const latest = history.entries.at(-1)
  console.log(
    `metrics: ${history.entries.length} collection(s), latest ${latest?.collected ?? "none"}`,
  )
  process.exit(0)
}

/**
 * Fetch one signal, returning `null` rather than throwing. `extract` runs
 * inside the try because a source that answers with an unexpected shape has
 * told us as little as one that did not answer at all.
 */
async function signal(source, extract) {
  try {
    const response = await fetch(source, {
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
    })
    if (!response.ok) {
      return { value: null, source, note: `HTTP ${response.status}` }
    }
    const value = extract(await response.json())
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { value: null, source, note: "response did not carry the expected field" }
    }
    return { value, source }
  } catch (error) {
    const note = error.name === "TimeoutError" ? `no response within ${options.timeoutMs}ms` : error.message
    return { value: null, source, note }
  }
}

const [downloads, stars, scorecard] = await Promise.all([
  signal(
    `https://api.npmjs.org/downloads/point/last-month/${PACKAGE}`,
    (body) => body.downloads,
  ),
  signal(`https://api.github.com/repos/${REPO}`, (body) => body.stargazers_count),
  signal(
    `https://api.securityscorecards.dev/projects/github.com/${REPO}`,
    (body) => body.score,
  ),
])

const entry = {
  collected: new Date().toISOString(),
  source_commit: process.env.GITHUB_SHA ?? "local",
  signals: {
    npm_downloads_last_month: downloads,
    github_stars: stars,
    openssf_scorecard: scorecard,
  },
}

const history = appendMetrics(await readHistory({ allowMissing: true }), entry)
await mkdir(path.dirname(options.out), { recursive: true })
await writeFile(options.out, `${JSON.stringify(history, null, 2)}\n`)

console.log(`metrics: collected ${entry.collected} → ${options.out}`)
for (const [name, metric] of Object.entries(entry.signals)) {
  const reading = metric.value === null ? `unavailable (${metric.note})` : String(metric.value)
  console.log(`  ${name.padEnd(26)} ${reading}`)
}
const missing = Object.values(entry.signals).filter((metric) => metric.value === null).length
if (missing > 0) {
  console.log(
    `\n${missing} source(s) did not answer and were recorded as null, not carried forward.`,
  )
}
