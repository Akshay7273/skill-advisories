# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
