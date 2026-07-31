# Evidence provenance

Every advisory cites published evidence. Published pages get edited, moved, and
deleted, so a bare URL degrades over time: a reader who follows a dead link
cannot tell whether the claim was ever supported, and a reader who follows a
live link cannot tell whether the page still says what the advisory says it
said.

Three optional reference fields record that context at the moment the evidence
was read.

## Fields

| Field | Meaning |
| --- | --- |
| `archive_url` | Archived copy of `url`, for when the original rots |
| `retrieved` | RFC 3339 timestamp at which `url` was read and any hash taken |
| `content_sha256` | SHA-256 of the retrieved body, so later readers detect edits |

All three are optional and `schema_version` remains `"1"`. Advisories written
before these fields existed stay valid, and consumers that ignore the fields
keep working.

```json
{
  "type": "REPORT",
  "url": "https://vendor.example/report",
  "archive_url": "https://web.archive.org/web/20260722000000/https://vendor.example/report",
  "retrieved": "2026-07-22T09:14:03Z",
  "content_sha256": "3b1f...c07a"
}
```

## Rules

1. **Record, do not invent.** `retrieved` means the page was actually fetched at
   that time. If the fetch did not happen, omit the field.
2. **`content_sha256` requires `retrieved`.** A hash with no timestamp cannot be
   acted on, because a reader has no way to know which revision it describes.
3. **SHA-256 of the response body as received**, lowercase hex, no
   normalization. A hash that depends on a cleanup step nobody recorded is not
   reproducible.
4. **`url` and `archive_url` must be absolute `http(s)`.** JSON Schema's
   `format: uri` also accepts `ftp:` and `about:blank`; evidence must be
   fetchable by an ordinary reader.
5. **Archiving is a maintainer action.** Submitting a URL to a public archive
   publishes it to a third party, so it is never done automatically during
   validation or CI.

Validation enforces rules 1–4 offline on every pull request. Nothing here
requires network access, so an unreachable page never fails an unrelated change.

## Hashing a reference

```bash
curl -sSL https://vendor.example/report | shasum -a 256
date -u +%Y-%m-%dT%H:%M:%SZ
```

A changed hash is a signal, not a verdict: pages legitimately gain navigation
chrome, ads, and CSRF tokens. Treat a mismatch as a prompt to re-read the page
and confirm the cited claim still holds, then restamp `retrieved` and
`content_sha256` in the same commit.

## Consumers

Native feed advisories carry the fields inline on each reference. OSV records
keep `references` entries spec-clean and re-emit provenance as
`database_specific.reference_provenance`, joinable by `url` — see the
[OSV export guide](osv-export.md).
