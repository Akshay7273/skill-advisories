# skill-advisories

[![CI](https://github.com/Akshay7273/skill-advisories/actions/workflows/ci.yml/badge.svg)](https://github.com/Akshay7273/skill-advisories/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40akshay7273%2Fskill-advisories)](https://www.npmjs.com/package/@akshay7273/skill-advisories)
[![advisories](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FAkshay7273%2Fskill-advisories%2Fmain%2Ffeed%2Ffeed.json&query=%24.advisory_count&label=advisories&color=red)](https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json)

Open advisory database for AI agent skills, plugins, and MCP servers — OSV-style, machine-readable threat data for the agent ecosystem.

Every advisory documents a malicious, vulnerable, or typosquatted agent skill, backed by at least one published public reference (vendor report, researcher writeup, or registry takedown).

## The feed (public API)

Consume the database directly — no install needed:

- Full feed: `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json`
- Fast lookup index (`ecosystem:name` → advisory ids): `https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/index.json`
- Advisory schema: [`schema/advisory.schema.json`](schema/advisory.schema.json)

## CLI

```

# Check specific skill names

npx @akshay7273/skill-advisories check omnicogg my-other-skill

# Scan installed skill directories (~/.claude/skills, ~/.openclaw/skills, ...)

npx @akshay7273/skill-advisories scan

# Scan a specific directory, machine-readable output

npx @akshay7273/skill-advisories scan ./skills --json

```

Options: `--json` (machine-readable output), `--feed <url-or-path>` (alternate feed source).

Exit codes: `0` no advisories matched · `1` matches found (CI-friendly) · `2` usage or feed error.

## GitHub Action

Fail your CI when a skill you ship or install matches a published advisory:

```

- uses: Akshay7273/skill-advisories@v1
    
    with:
    
    names: my-skill-name
    

```

Or scan a directory of skills:

```

- uses: Akshay7273/skill-advisories@v1
    
    with:
    
    scan-dir: ./skills
    

```

Inputs: `names` (space-separated skill names), `scan-dir` (directory to scan), `feed` (alternate feed URL or path).

## Data integrity

1. Every advisory cites at least one published public reference.
2. No hearsay: submissions without a published report or reproducible evidence are not listed.
3. Advisories can be withdrawn; disputes are handled via GitHub issues.

## License

Code: MIT. Advisory data: CC-BY-4.0 — free to use with attribution.
