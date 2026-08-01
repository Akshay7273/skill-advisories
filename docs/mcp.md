# MCP server and Claude Code integration

The v0.5 MCP server lets an agent check an artifact before installation without
giving the advisory service write access. Its tools are declared read-only,
non-destructive, and idempotent:

- `check_artifact` evaluates a name and optional ecosystem, version, or SHA-256;
- `get_advisory` retrieves the evidence for an SKA identifier or alias; and
- `search_advisories` filters the public feed by text, ecosystem, and severity.

Every negative result includes an explicit warning that absence from the feed
is not proof of safety. `check_artifact` also returns a `feedAge` object
(`status`, `ageHours`, `generated`, `maxAgeHours`) so an agent can tell a
confident answer from one backed by evidence that stopped updating days ago.
A long-lived server evaluates this per call, not once at startup.

Given a lockfile, `check_artifact` also returns a `lock` object (`key`,
`status`, and the `approved` digest and `version` when there is an entry). This
is the half of the question the feed cannot answer: the feed is silent about
anything not yet disclosed, which is precisely the case an agent installing
something for the first time is asking about. `status` is `approved`,
`changed`, `unapproved`, or `unverified` -- the last meaning the name is locked
but no digest was supplied, so only the name has been checked. See
[approved artifact identities](lockfile.md).

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

Other server options are `--feed <url-or-path>`, `--offline`, `--refresh`, and
`--lockfile <path>`. `--offline` fails closed when no valid cached feed exists.
The lockfile is read once at startup rather than per call: it is a committed
document that does not change under a running server, and re-reading it would
let a mid-session edit silently change what the server approves.

## Enforce a project policy

Copy [`examples/policy.json`](../examples/policy.json) into a repository and
commit it. The policy can:

- block advisories at or above a severity threshold;
- deny entire artifact ecosystems;
- require a SHA-256 identity;
- allow, review, or block typosquat warnings;
- allow, review, or block artifacts no lockfile approved, via
  `unlockedArtifacts` (see [approved artifact identities](lockfile.md)); and
- set `maxFeedAgeHours`, the age at which the repository stops treating the
  feed as current (default 48).

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
`createAdvisoryMcpServer` from `@akshay7273/skill-advisories/mcp`. It takes a
feed, a version string, and optionally a policy and a parsed lockfile; supplying
the lockfile is what makes `check_artifact` report a `lock` status and weigh it
in the policy decision.
