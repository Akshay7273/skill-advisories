# JSON result contract

The `--format json` output is a stable automation interface. Consumers should
check `schemaVersion` before interpreting fields and ignore unknown fields for
forward compatibility.

## Version 1

```json
{
  "schemaVersion": "1",
  "checked": 1,
  "matchCount": 1,
  "matches": [
    {
      "query": "rankaj",
      "id": "SKA-2026-0012",
      "type": "malicious",
      "severity": "critical",
      "ecosystems": ["clawhub"],
      "version": "1.0.0",
      "summary": "...",
      "references": ["https://example.com/report"],
      "matchedBy": "name"
    }
  ],
  "warnings": [],
  "scan": {
    "discoveredFiles": 2,
    "hashedFiles": 1,
    "hashedBytes": 128,
    "skippedLargeFiles": 0,
    "skippedBudgetFiles": 1,
    "skippedSymlinks": 0,
    "skippedExcludedDirectories": 0,
    "unreadableEntries": 0,
    "budgetExhausted": true,
    "artifactsWithExhaustedBudgets": 1
  },
  "feedAge": {
    "status": "fresh",
    "ageHours": 3.2,
    "generated": "2026-07-31T22:41:07.913Z",
    "maxAgeHours": 48
  }
}
```

`version` is present when an installed or requested version was known. `file`
and `sha256` are present for file-hash findings. Warnings describe proximity to
known-bad names and are not matches unless policy enables strict mode.

`scan` is present only for filesystem scans. It reports exactly what was hashed
or skipped. Oversized, over-budget, or unreadable files make the scan incomplete
and produce exit code `2` by default, even when no advisory matches. Callers may
use `--allow-incomplete` only when partial coverage is an explicit policy choice.

`feedAge` reports how current the feed backing the result is. `status` is
`fresh`, `stale`, or `unknown`; `ageHours` and `generated` are absent for
`unknown`, because a feed with no parseable timestamp has not been shown to be
old. A non-`fresh` feed warns by default and produces exit code `2` under
`--strict`. This field was added after version 1 was published: it is additive,
`schemaVersion` remains `"1"`, and consumers that ignore it are unaffected. See
[feed freshness](feed-freshness.md).

## Exit codes

- `0`: no finding met the configured failure threshold.
- `1`: at least one finding met the threshold, or a typosquat warning was found
  with `--strict`.
- `2`: invalid arguments, an unreadable feed, an incomplete filesystem scan, a
  non-`fresh` feed under `--strict`, or another operational error.

The `verify` subcommand reports on a feed directory rather than on artifacts, so
its codes carry a different meaning: `0` the directory matches its own evidence,
`1` it does not, `2` the check could not run at all. It emits its own JSON shape
under the same `schemaVersion`, described in
[feed freshness](feed-freshness.md#verification).

The `lock` subcommand reports on the disk rather than on the feed and likewise
carries its own codes: for `lock --check`, `0` the installed artifacts match the
lockfile or drift the policy tolerates, `1` drift the policy rejects, `2` the
check could not run. Its JSON shape reuses `schemaVersion`, and reports the same
scan telemetry under a `stats` key rather than a `scan` one, because a lock run
is only ever a filesystem walk. It is described in
[approved artifact identities](lockfile.md#json-output).

The `rollback` subcommand reports on copies of a feed: `0` a recovery point was
selected, `1` no candidate is provably good, `2` the history it judges against
could not be read. Its JSON reuses `schemaVersion` and reports `history`,
`published`, a `candidates` array ordered newest published state first, an
optional `selected` naming the copy the evidence justifies, and `problems`
holding faults in the log itself. A `selected` is absent whenever `problems` is
non-empty, because a rewritten log cannot vouch for anything in it. Each
candidate carries `dir` and its own `problems`; `cursor`, `digest`,
`advisoryCount`, `position`, and `generated` are present only as far as the copy
could be read and located in the log. Note that `generated` is the timestamp the
log records for that state, not the one the copy claims. See
[last-known-good feed recovery](operations/rollback.md#selecting-a-recovery-point).

JSON is written to stdout. Diagnostics, cache warnings, and human-readable
errors are written to stderr.
