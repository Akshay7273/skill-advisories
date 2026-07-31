# skill-advisories

[![CI](https://github.com/Akshay7273/skill-advisories/actions/workflows/ci.yml/badge.svg)](https://github.com/Akshay7273/skill-advisories/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40akshay7273%2Fskill-advisories)](https://www.npmjs.com/package/@akshay7273/skill-advisories)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Akshay7273/skill-advisories/badge)](https://scorecard.dev/viewer/?uri=github.com/Akshay7273/skill-advisories)
[![advisories](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FAkshay7273%2Fskill-advisories%2Fmain%2Ffeed%2Ffeed.json&query=%24.advisory_count&label=advisories&color=red)](https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json)

Open advisory database for AI agent skills, plugins, and MCP servers — OSV-style, machine-readable threat data for the agent ecosystem.

**Browse advisories:** https://akshay7273.github.io/skill-advisories/

**Feed health:** https://akshay7273.github.io/skill-advisories/health.html

Every advisory documents a malicious, vulnerable, or typosquatted agent skill, backed by at least one published public reference (vendor report, researcher writeup, or registry takedown).

## Roadmap

The project is moving toward precise version-aware detection, verifiable threat
feeds, OSV interoperability, and agent-native pre-install checks through MCP.
See the [public roadmap](ROADMAP.md) for milestones and acceptance criteria.

## The feed (public API)

Consume the database directly — no install needed:

- Full feed: `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json`
- Feed SHA-256 digest: `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json.sha256`
- Fast lookup index (`ecosystem:name` → advisory ids): `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/index.json`
- Compact feed: `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/compact.json`
- Cursor-verified incremental update: `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/delta.json`
- Advisory schema: [`schema/advisory.schema.json`](schema/advisory.schema.json)
- OSV-compatible index: [`feed/osv/index.json`](feed/osv/index.json)
- Multi-file checksum manifest: [`feed/checksums.txt`](feed/checksums.txt)

See the [OSV export and verification guide](docs/osv-export.md) for field mapping and integrity checks.
Incremental consumers should follow the [compact feed and delta protocol](docs/feed-updates.md).
References may carry archival [evidence provenance](docs/evidence-provenance.md).

## CLI

```bash
# Check specific skill names
npx @akshay7273/skill-advisories check omnicogg my-other-skill

# Avoid cross-ecosystem name collisions
npx @akshay7273/skill-advisories check --ecosystem mcp-server my-server

# Evaluate a specific installed version when an advisory lists affected versions
npx @akshay7273/skill-advisories check --ecosystem npm --version 1.2.3 my-package

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

Common options: `--format <human|json|sarif>`, `--fail-on <severity>`,
`--ecosystem <id>`, `--version <value>`, `--sha256`, `--strict`,
`--offline`, `--refresh`, and `--feed <url-or-path>`.

Filesystem scans also support bounded execution with `--concurrency`,
`--hash-concurrency`, `--max-file-bytes`, `--max-files`,
`--max-total-bytes`, and repeatable `--exclude-dir` options. An incomplete scan
fails closed with exit code 2; `--allow-incomplete` explicitly permits a partial
result. See the [JSON result contract](docs/result-schema.md) for scan telemetry.

Exit codes: `0` no advisories matched · `1` findings met policy · `2` usage,
feed, or incomplete-scan error.

Automation consumers can rely on the [versioned JSON result contract](docs/result-schema.md).

## MCP and Claude Code

Run the read-only MCP server so agents can check an artifact before installing
it:

```bash
claude mcp add --transport stdio --scope user skill-advisories -- \
  npx -y -p @akshay7273/skill-advisories skill-advisories-mcp
```

The server provides `check_artifact`, `get_advisory`, and
`search_advisories`. A repository can add `--policy examples/policy.json` to
enforce severity thresholds, denied ecosystems, immutable hashes, and warning
handling. See the [MCP, policy, and Claude Code integration guide](docs/mcp.md).
OpenClaw, VS Code, and GitHub Action examples are covered by the
[integration contract](docs/integrations.md).

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

Inputs: `names` (space-separated skill names), `scan-dir` (directory to scan), `ecosystem` (restrict name checks), `version` (installed version for name checks), `feed` (alternate feed URL or path), `format` (output format), `sarif-file` (SARIF output path), `fail-on` (minimum severity threshold).

## Data integrity

1. Every advisory cites at least one published public reference.
2. No hearsay: submissions without a published report or reproducible evidence are not listed.
3. Advisories can be withdrawn; disputes are handled via GitHub issues.

## Accuracy & performance

Performance results are generated from a deterministic synthetic corpus and
record the exact commit and environment. On the checked-in Windows/Node 24
baseline, 100,000 name lookups completed in 125 ms, a 100,000-name synthetic
false-positive sweep produced zero warnings in 479 ms, and 10,000 one-file
artifacts were scanned in 10.36 seconds with 214 MB peak RSS. This is a reproducible
baseline, not a guarantee for other hardware or real-world artifact layouts.

See the [benchmark method and results](benchmarks/README.md). Accuracy claims
require a redistributable corpus or a documented generator; downloads and
unpublished third-party collections are not used as evidence.

## License

Code: MIT. Advisory data: CC-BY-4.0 — free to use with attribution.
