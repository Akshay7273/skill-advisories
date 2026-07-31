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
 * Check reference provenance invariants that JSON Schema cannot express.
 *
 * The schema already constrains shape: `url` and `archive_url` are `format: uri`
 * and `content_sha256` matches lowercase 64-hex. What it cannot say is that a
 * URI must specifically be fetchable over http(s), that a timestamp must not be
 * in the future, or that one field's presence requires another's.
 */
export function findReferenceProblems(
  entries: ReferenceInput[],
  now: number = Date.now(),
): ReferenceProblem[] {
  const problems: ReferenceProblem[] = []

  for (const { file, advisory } of entries) {
    advisory.references.forEach((reference, index) => {
      const at = `references[${index}]`

      if (!isHttpUrl(reference.url)) {
        problems.push({ file, problem: `${at}.url must be an absolute http(s) URL` })
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
