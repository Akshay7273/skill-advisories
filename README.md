# skill-advisories

[![CI](https://github.com/Akshay7273/skill-advisories/actions/workflows/ci.yml/badge.svg)](https://github.com/Akshay7273/skill-advisories/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40akshay7273%2Fskill-advisories)](https://www.npmjs.com/package/@akshay7273/skill-advisories)
[![advisories](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FAkshay7273%2Fskill-advisories%2Fmain%2Ffeed%2Ffeed.json&query=%24.advisory_count&label=advisories&color=red)](https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json)

Open advisory database for AI agent skills, plugins, and MCP servers — OSV-style, machine-readable threat data for the agent ecosystem.

**Browse advisories:** https://akshay7273.github.io/skill-advisories/

Every advisory documents a malicious, vulnerable, or typosquatted agent skill, backed by at least one published public reference (vendor report, researcher writeup, or registry takedown).

## The feed (public API)

Consume the database directly — no install needed:

- Full feed: `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json`
- Feed SHA-256 digest: `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json.sha256`
- Fast lookup index (`ecosystem:name` → advisory ids): `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/index.json`
- Advisory schema: [`schema/advisory.schema.json`](schema/advisory.schema.json)

## CLI

```bash
# Check specific skill names
npx @akshay7273/skill-advisories check omnicogg my-other-skill

# Check file hashes directly (catches renamed malware)
npx @akshay7273/skill-advisories check --sha256 <64-hex-digest>

# Turn typosquat proximity warnings into failures
npx @akshay7273/skill-advisories check omnicog --strict

# Scan installed skill directories (~/.claude/skills, ~/.openclaw/skills, ...)
npx @akshay7273/skill-advisories scan

# Scan with SARIF output for GitHub Code Scanning
npx @akshay7273/skill-advisories scan ./skills --format sarif

# Offline mode using cached feed (1h TTL default)
npx @akshay7273/skill-advisories scan --offline

# Set minimum failure threshold (low, medium, high, critical)
npx @akshay7273/skill-advisories scan ./skills --fail-on high
```

Options: `--format <human|json|sarif>` (output format), `--json` (alias for `--format json`), `--fail-on <severity>` (threshold), `--sha256` (hash lookup), `--strict` (fail on typosquats), `--offline` (use cache), `--refresh` (force download), `--feed <url-or-path>` (alternate feed source).

Exit codes: `0` no advisories matched · `1` matches found (CI-friendly) · `2` usage or feed error.

## GitHub Action

Fail your CI when a skill you ship or install matches a published advisory:

```yaml
- uses: Akshay7273/skill-advisories@v1
  with:
    names: my-skill-name
```

Or scan a directory of skills:

```yaml
- uses: Akshay7273/skill-advisories@v1
  with:
    scan-dir: ./skills
```

Upload SARIF results to GitHub Code Scanning:

```yaml
- uses: Akshay7273/skill-advisories@v1
  with:
    scan-dir: .claude/skills
    sarif-file: skill-advisories.sarif
    fail-on: high
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: skill-advisories.sarif
```

Inputs: `names` (space-separated skill names), `scan-dir` (directory to scan), `feed` (alternate feed URL or path), `format` (output format), `sarif-file` (SARIF output path), `fail-on` (minimum severity threshold).

## Data integrity

1. Every advisory cites at least one published public reference.
2. No hearsay: submissions without a published report or reproducible evidence are not listed.
3. Advisories can be withdrawn; disputes are handled via GitHub issues.

## Performance

Benchmarked on a stock VPS (Node 22): scanning **10,000 installed skills** (7,517 real community skills harvested from public collections, scaled to 10,000 with copies) completes in **1.86 seconds**, including the remote feed fetch. A false-positive sweep across **2,656 unique real-world skill names** — drawn from the anthropics/skills, alirezarezvani/claude-skills, K-Dense scientific skills, and other public collections — produced **zero matches**.

## License

Code: MIT. Advisory data: CC-BY-4.0 — free to use with attribution.
