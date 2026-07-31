# Integration contract

Supported examples are runnable compatibility surfaces, not endorsements from
the upstream projects. Every integration must pin or identify the package it
executes, preserve advisory evidence, distinguish “no known advisory” from
“safe,” and fail closed when the check cannot complete.

## Claude Code

[`examples/claude-code`](../examples/claude-code) contains a project MCP server
and a `PreToolUse` hook for direct npm install commands. See the detailed
[Claude Code guide](mcp.md).

## OpenClaw and ClawHub

[`integrations/openclaw`](../integrations/openclaw) is an Agent Skill with a
shell-free Node launcher. Copy the directory into an OpenClaw skill location.
The skill checks the `clawhub` ecosystem and treats an operational failure as a
blocked installation.

## VS Code agent mode

Copy [`integrations/vscode/mcp.json`](../integrations/vscode/mcp.json) to
`.vscode/mcp.json`. It launches the same read-only stdio MCP server used by
Claude Code. Repository policy can be added by appending `--policy` and a local
policy path to `args`.

## GitHub Actions

The root [`action.yml`](../action.yml) provides name, version, ecosystem,
directory scan, SARIF, and severity policy inputs. Use an immutable semantic
version for reproducibility; the moving `v1` tag follows the latest compatible
major release.

## Compatibility policy

- Configuration examples are tested for syntax on every pull request.
- Launchers are tested against the local release candidate CLI.
- Upstream configuration changes are handled in a patch release when behavior
  remains compatible, or documented as a migration for breaking changes.
- A downstream project is listed as an adopter only with a public integration
  link or the maintainer's explicit consent.
