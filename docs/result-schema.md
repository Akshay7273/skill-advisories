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
  "warnings": []
}
```

`version` is present when an installed or requested version was known. `file`
and `sha256` are present for file-hash findings. Warnings describe proximity to
known-bad names and are not matches unless policy enables strict mode.

## Exit codes

- `0`: no finding met the configured failure threshold.
- `1`: at least one finding met the threshold, or a typosquat warning was found
  with `--strict`.
- `2`: invalid arguments, an unreadable feed, or another operational error.

JSON is written to stdout. Diagnostics, cache warnings, and human-readable
errors are written to stderr.
