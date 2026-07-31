/**
 * Reachability check for cited evidence.
 *
 * Advisories are only as good as the reports they cite, and published pages get
 * moved and deleted. This probes every distinct `url` and `archive_url` in the
 * feed and writes a machine-readable status file.
 *
 * It is deliberately not part of `npm run validate`: a vendor blog being down
 * for ten minutes must never fail an unrelated pull request. The default exit
 * code is 0 no matter what the network says. `--fail-on-gone` opts into exit 1
 * when a link returns a permanent 404/410, which is what the weekly workflow
 * uses to raise a signal.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { mapConcurrent } from "../dist/concurrency.js"

const USER_AGENT =
  "skill-advisories-link-check (+https://github.com/Akshay7273/skill-advisories)"

const options = {
  feed: "feed/feed.json",
  out: "site/references.json",
  concurrency: 4,
  timeoutMs: 15_000,
  failOnGone: false,
}

const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  const value = () => {
    const next = argv[++i]
    if (next === undefined) throw new Error(`${arg} requires a value`)
    return next
  }
  if (arg === "--feed") options.feed = value()
  else if (arg === "--out") options.out = value()
  else if (arg === "--concurrency") options.concurrency = Number(value())
  else if (arg === "--timeout-ms") options.timeoutMs = Number(value())
  else if (arg === "--fail-on-gone") options.failOnGone = true
  else throw new Error(`unknown option: ${arg}`)
}
if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1) {
  throw new Error("--concurrency must be a positive integer")
}
if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1) {
  throw new Error("--timeout-ms must be a positive integer")
}

/**
 * Collect distinct URLs, remembering every advisory that cites each one. A
 * campaign writeup cited by five advisories is one request, and one dead link
 * reported against all five.
 */
const feed = JSON.parse(await readFile(options.feed, "utf8"))
const cited = new Map()
for (const advisory of feed.advisories ?? []) {
  for (const reference of advisory.references ?? []) {
    for (const field of ["url", "archive_url"]) {
      const url = reference[field]
      if (!url) continue
      const entry = cited.get(url) ?? { url, citedAs: new Set(), advisories: new Set() }
      entry.citedAs.add(field)
      entry.advisories.add(advisory.id)
      cited.set(url, entry)
    }
  }
}
const targets = [...cited.values()].sort((a, b) => a.url.localeCompare(b.url))

function describeError(error) {
  if (error.name === "TimeoutError") return `no response within ${options.timeoutMs}ms`
  return error.cause?.code ?? error.message
}

/**
 * A permanent 404/410 is link rot. A 401/403/429 is usually a CDN refusing a
 * datacenter IP, and a 5xx or a timeout is usually the far end having a bad
 * day; neither is evidence that the report is gone, so they are reported
 * separately and never treated as rot.
 */
function classify(httpStatus) {
  if (httpStatus < 400) return "ok"
  if (httpStatus === 404 || httpStatus === 410) return "gone"
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) return "blocked"
  return "unreachable"
}

/**
 * HEAD first, because the body is not needed. Plenty of servers mishandle it
 * (405, or a bare 404 for a page that GETs fine), so anything short of a clean
 * answer is retried with GET and the body is cancelled unread.
 */
async function probe(url) {
  let lastError
  for (const method of ["HEAD", "GET"]) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: { "user-agent": USER_AGENT, accept: "*/*" },
      })
      await response.body?.cancel().catch(() => {})
      const retryable =
        response.status === 403 ||
        response.status === 404 ||
        response.status === 405 ||
        response.status >= 500
      if (method === "HEAD" && retryable) continue
      return { httpStatus: response.status, finalUrl: response.url }
    } catch (error) {
      lastError = error
    }
  }
  return { error: describeError(lastError) }
}

const results = await mapConcurrent(targets, options.concurrency, async (target) => {
  const { httpStatus, finalUrl, error } = await probe(target.url)
  const redirected = finalUrl && finalUrl !== target.url ? { redirectedTo: finalUrl } : {}
  return {
    url: target.url,
    citedAs: [...target.citedAs].sort(),
    advisories: [...target.advisories].sort(),
    status: error ? "unreachable" : classify(httpStatus),
    ...(error ? { error } : { httpStatus }),
    ...redirected,
  }
})

const count = (status) => results.filter((r) => r.status === status).length
const report = {
  schemaVersion: "1",
  checkedAt: new Date().toISOString(),
  sourceCommit: process.env.GITHUB_SHA ?? "local",
  summary: {
    checked: results.length,
    ok: count("ok"),
    gone: count("gone"),
    blocked: count("blocked"),
    unreachable: count("unreachable"),
  },
  references: results,
}

await mkdir(path.dirname(options.out), { recursive: true })
await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`)

const { checked, ok, gone, blocked, unreachable } = report.summary
console.log(
  `references: ${checked} checked; ${ok} ok, ${gone} gone, ${blocked} blocked, ${unreachable} unreachable → ${options.out}`,
)
for (const result of results) {
  if (result.status === "ok") continue
  console.log(
    `  ${result.status.padEnd(11)} ${result.url} (${result.error ?? `HTTP ${result.httpStatus}`}) — ${result.advisories.join(", ")}`,
  )
}
if (gone > 0 && options.failOnGone) {
  console.error(`\n${gone} cited page(s) returned a permanent 404/410 and need re-sourcing.`)
  process.exitCode = 1
}
