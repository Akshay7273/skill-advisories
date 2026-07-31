# MCP server and Claude Code integration

The v0.5 MCP server lets an agent check an artifact before installation without
giving the advisory service write access. Its tools are declared read-only,
non-destructive, and idempotent:

- `check_artifact` evaluates a name and optional ecosystem, version, or SHA-256;
- `get_advisory` retrieves the evidence for an SKA identifier or alias; and
- `search_advisories` filters the public feed by text, ecosystem, and severity.

Every negative result includes an explicit warning that absence from the feed
is not proof of safety.

## Add it to Claude Code

After the npm package is available, add a user-scoped stdio server:

```sh
claude mcp add --transport stdio --scope user skill-advisories -- \
  npx -y -p @akshay7273/skill-advisories skill-advisories-mcp
```

For a repository-owned configuration, copy
[`examples/claude-code/.mcp.json`](../examples/claude-code/.mcp.json) to the
repository root. It also demonstrates `--policy`; paths are resolved from the
server process's working directory.

Other server options are `--feed <url-or-path>`, `--offline`, and `--refresh`.
`--offline` fails closed when no valid cached feed exists.

## Enforce a project policy

Copy [`examples/policy.json`](../examples/policy.json) into a repository and
commit it. The policy can:

- block advisories at or above a severity threshold;
- deny entire artifact ecosystems;
- require a SHA-256 identity; and
- allow, review, or block typosquat warnings.

Unknown policy keys and invalid values are rejected. Editors can validate the
file with [`schema/policy.schema.json`](../schema/policy.schema.json).

## Pre-install hook example

The reference [Claude Code settings](../examples/claude-code/.claude/settings.json)
runs a `PreToolUse` command hook before Bash calls. Its companion
[`check-npm-install.mjs`](../examples/claude-code/check-npm-install.mjs) blocks
direct `npm install`, `npm i`, and `npm add` commands when a high-or-critical
advisory matches. It fails closed if the advisory check cannot complete.

The example deliberately ignores compound shell expressions and non-npm
package managers. Production integrations should parse their own install plan
instead of attempting to infer every shell grammar.

## Programmatic API

The package exposes side-effect-free entry points:

```js
import { loadFeed } from "@akshay7273/skill-advisories"
import { assessArtifact } from "@akshay7273/skill-advisories/intelligence"
import { evaluatePolicy, parsePolicy } from "@akshay7273/skill-advisories/policy"

const feed = await loadFeed("feed/feed.json")
const assessment = assessArtifact(feed, { name: "example", ecosystem: "npm" })
const decision = evaluatePolicy(assessment, parsePolicy({ schemaVersion: "1" }))
```

Applications that already manage an MCP transport can import
`createAdvisoryMcpServer` from `@akshay7273/skill-advisories/mcp`.
