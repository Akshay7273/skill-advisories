# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-08-01

### Added
- Optional `archive_url`, `retrieved`, and `content_sha256` provenance fields on advisory references
- Validation of provenance invariants, duplicate references, and bare-domain citations on every pull request
- Weekly network reachability probe for cited evidence, reported on the feed health page
- Feed freshness classification reported as `feedAge` on `check` and `scan` results
- `--max-feed-age` flag and `maxFeedAgeHours` policy key with a documented 48-hour default
- Fail-closed staleness: a non-`fresh` feed warns by default and exits 2 under `--strict`
- Feed age computed per call on every MCP `check_artifact` assessment
- Append-only publication history at `feed/history.json`, covered by the checksum manifest
- `verify` subcommand checking a feed directory against its digest, manifest, compact projection, delta cursor, and history
- Feed freshness, verification, and reference provenance guides

### Changed
- OSV exports keep provenance out of `references` and re-emit it under `database_specific.reference_provenance`

## [0.6.0-rc.1] - 2026-07-31

### Added
- Streaming SHA-256 hashing with bounded file concurrency and memory usage
- Configurable scan concurrency, file-count, file-size, byte, and directory-exclusion limits
- Structured scan telemetry for hashed, skipped, excluded, and unreadable files
- Fail-closed incomplete scans with an explicit `--allow-incomplete` override
- Reproducible synthetic benchmark harness with environment and commit metadata
- CI performance regression ceilings and a checked-in 100,000-identity/10,000-artifact baseline
- Weekly OpenSSF Scorecard analysis with SARIF code-scanning publication
- CodeQL static analysis for JavaScript and TypeScript on pushes, pull requests, and a weekly schedule
- Synthetic false-positive sweep against every committed advisory identity
- Daily machine-readable and human feed health with checksum and freshness verification
- Tested runbooks for triage, correction, release, compromise response, and feed rollback
- Tested OpenClaw/ClawHub and VS Code MCP integrations with a documented compatibility contract
- Compact advisory distribution and cursor-verified incremental feed deltas

### Fixed
- Hash scans now use the actual installed directory when package metadata declares a different name

## [0.5.1] - 2026-07-31

### Fixed
- `--version` without a value reports the CLI version while `--version <value>` remains available for affected-version checks
- CLI smoke coverage now guards both version-reporting and artifact-version behavior

## [0.5.0] - 2026-07-31

### Added
- Read-only MCP server with artifact checks, advisory retrieval, and search tools
- Explainable artifact assessment API with structured evidence and safe disclaimers
- Repository-owned policy files for severity, ecosystem, hash, and warning controls
- Claude Code MCP configuration and fail-closed pre-install hook examples
- Public package entry points for lookup, intelligence, policy, and MCP consumers
- Protocol-level MCP tests using an in-memory client/server transport

## [0.4.0] - 2026-07-31

### Added
- OSV-compatible per-advisory exports with documented native field mapping
- Advisory aliases for CVE, GHSA, and vendor identifiers
- SHA-256 manifest covering native feeds, indexes, and OSV records
- OIDC trusted-publishing workflow with npm and feed provenance attestations
- Dependabot coverage for npm and GitHub Actions dependencies

### Changed
- Advisory validation rejects duplicate identities, versions, and hashes
- GitHub workflows use the current Node 24-based official actions

## [0.3.0] - 2026-07-31

### Added
- Ecosystem-aware name checks through the CLI and GitHub Action
- Exact affected-version checks through `--version`
- Installed name and version discovery from `SKILL.md` and `package.json`
- Reusable artifact indexes for exact-name matching
- Versioned JSON result contract and end-to-end CLI smoke tests
- Cross-platform CI coverage for Linux, Windows, and macOS

### Changed
- Installed dependencies are no longer tracked in Git
- The GitHub Action uses a self-contained runtime bundle

## [0.2.0] - 2026-07-22

### Added
- SHA-256 hash matching in `scan` — renamed malicious skills are caught by file hash, not just name
- `check --sha256` for direct hash lookups
- Typosquat proximity warnings for names within edit distance 2 of a known-bad name; `--strict` turns warnings into failures
- Local feed cache (1h TTL) with `--offline` and `--refresh` flags
- Feed integrity: `feed.json.sha256` published alongside the feed and verified after download
- SARIF 2.1.0 output via `--format sarif` for GitHub code scanning
- `--fail-on <severity>` threshold for CI policies
- GitHub Action: `sarif-file`, `format`, and `fail-on` inputs
- Public advisory browser at https://akshay7273.github.io/skill-advisories/

## [0.1.0] - 2026-07-22

### Added
- Advisory schema, validator, and feed compiler
- 13 seed advisories covering published 2026 reports (36 artifact keys)
- `check` and `scan` CLI with `--json` and `--feed`
- GitHub Action for CI checks
- Contributing guide, security policy, and issue templates
