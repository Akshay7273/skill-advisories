import type { Advisory } from "./types.js"

export type ReferenceProblem = { file: string; problem: string }

export type ReferenceInput = { file: string; advisory: Advisory }

/**
 * Allowance for clock skew between an advisory author and CI. A `retrieved`
 * stamp beyond this is a typo (wrong year, wrong timezone), not a fast clock.
 */
const FUTURE_SKEW_MS = 5 * 60 * 1000

function isHttpUrl(value: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:"
}

/**
 * Identity of a cited page, ignoring differences that do not change what a
 * reader sees: a fragment selects a section of the same document, and a trailing
 * slash is the same path on every server that serves both.
 */
function referenceIdentity(value: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return value
  }
  parsed.hash = ""
  const normalized = parsed.toString()
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized
}

/**
 * A URL with no path, query, or fragment cites a whole site rather than a
 * report. "See snyk.io" does not let a reader check the claim.
 */
function isBareDomain(value: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return (parsed.pathname === "/" || parsed.pathname === "") && !parsed.search && !parsed.hash
}

/**
 * Check reference invariants that JSON Schema cannot express.
 *
 * The schema already constrains shape: `url` and `archive_url` are `format: uri`
 * and `content_sha256` matches lowercase 64-hex. What it cannot say is that a
 * URI must specifically be fetchable over http(s), that a timestamp must not be
 * in the future, that one field's presence requires another's, or that the same
 * page must not be cited twice as if it were two sources.
 *
 * Everything here is offline and deterministic, so it can run on every pull
 * request without a dead link failing an unrelated change.
 */
export function findReferenceProblems(
  entries: ReferenceInput[],
  now: number = Date.now(),
): ReferenceProblem[] {
  const problems: ReferenceProblem[] = []

  for (const { file, advisory } of entries) {
    // Scoped per advisory: several advisories citing one campaign writeup is
    // normal and correct, but citing it twice within one advisory is not.
    const identities = new Set<string>()

    advisory.references.forEach((reference, index) => {
      const at = `references[${index}]`

      if (!isHttpUrl(reference.url)) {
        problems.push({ file, problem: `${at}.url must be an absolute http(s) URL` })
      } else {
        if (isBareDomain(reference.url)) {
          problems.push({
            file,
            problem: `${at}.url cites a bare domain; link the specific report`,
          })
        }
        const identity = referenceIdentity(reference.url)
        if (identities.has(identity)) {
          problems.push({ file, problem: `${at}.url duplicates an earlier reference` })
        }
        identities.add(identity)
      }

      if (reference.archive_url !== undefined && !isHttpUrl(reference.archive_url)) {
        problems.push({
          file,
          problem: `${at}.archive_url must be an absolute http(s) URL`,
        })
      }

      if (reference.retrieved !== undefined) {
        const retrieved = Date.parse(reference.retrieved)
        if (Number.isNaN(retrieved)) {
          problems.push({ file, problem: `${at}.retrieved is not a valid timestamp` })
        } else if (retrieved > now + FUTURE_SKEW_MS) {
          problems.push({ file, problem: `${at}.retrieved is in the future` })
        }
      }

      // A content hash with no retrieval time cannot be acted on: a reader has
      // no way to know which revision of the page it was taken from.
      if (reference.content_sha256 !== undefined && reference.retrieved === undefined) {
        problems.push({
          file,
          problem: `${at}.content_sha256 requires ${at}.retrieved`,
        })
      }
    })
  }

  return problems
}
