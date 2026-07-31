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

## Exit codes

- `0`: no finding met the configured failure threshold.
- `1`: at least one finding met the threshold, or a typosquat warning was found
  with `--strict`.
- `2`: invalid arguments, an unreadable feed, an incomplete filesystem scan,
  or another operational error.

JSON is written to stdout. Diagnostics, cache warnings, and human-readable
errors are written to stderr.
