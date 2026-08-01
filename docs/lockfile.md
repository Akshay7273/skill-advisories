# Approved artifact identities

`scan` asks whether an installed artifact is known bad. That question can only
ever be answered about things the feed already knows, and every advisory has a
period — often a long one — where the artifact is already installed and nobody
has published anything about it yet. A clean scan during that window is honest
and useless.

A lockfile asks the complementary question: *is this the artifact that was
reviewed?* It knows nothing about severity or disclosure and needs no feed. It
notices that the skill in `~/.claude/skills/deploy-helper` is no longer the one
somebody read before approving it, which is true from the moment the bytes
change rather than from the moment the ecosystem catches up.

Neither replaces the other. A pinned artifact can still turn out to be
malicious, and an unpinned one can be perfectly fine.

## The file

```json
{
  "schema_version": "1",
  "generated": "2026-08-01T02:03:55.565Z",
  "artifacts": [
    {
      "name": "skill-advisories-check",
      "sha256": "a8291cc1d24c01a280dda4405eb1035e06f12dc769c6b0b303dcf0f1c5ad8ce6",
      "files": 2
    },
    {
      "name": "vscode",
      "sha256": "d9d17f44c857134fbb5acfea38174254cc295e1738724f3fed339586019af2d6",
      "files": 1
    }
  ]
}
```

It is committed. `skill-advisories.lock.json` is the default name, and
[`schema/lock.schema.json`](../schema/lock.schema.json) is the published
structure.

`sha256` is a digest over the sorted `(path, file digest)` pairs of the whole
artifact directory — the same construction `scan` reports per artifact, so a
lock entry and a scan result can be compared directly. `files` is
informational; the digest is the identity.

**Install paths are deliberately absent.** They are the one property of a scan
that differs on every machine, and a shared file keyed on them would report
drift for two checkouts of the same approved set. Artifacts are tracked by
`ecosystem:name`, or by bare `name` when the ecosystem is unknown.

**Version is recorded but not part of the identity.** An upgrade should read as
*the approved artifact changed*, which is a fact worth putting in front of
someone, rather than as one artifact vanishing and an unrelated one appearing.

**`generated` is stable across re-runs.** It moves only when the approved set
actually changes, so re-locking an unchanged tree produces byte-identical
output and CI can diff it. Two files approving the same artifacts are the same
approval whatever order their keys sit in: the comparison reads field values
rather than serialised bytes, so a lockfile written by hand or by another tool
does not read as a change.

Fields are written in the order the schema declares them — `name`,
`ecosystem`, `version`, `sha256`, `files` — so a file produced by anything
implementing that schema is left alone rather than reordered on first contact.

An optional `$schema` reference is preserved across rewrites. Adding one points
an editor at the published schema and gets the file validated as it is edited;
`lock` never adds one on its own, because what a committed file references is
the repository's decision.

## Recording approvals

```bash
# Approve what is installed in the default skill directories
skill-advisories lock

# Approve a specific tree, under a specific lockfile
skill-advisories lock integrations --lockfile integrations/skill-advisories.lock.json
```

Writing is always explicit. No other subcommand touches the lockfile, and in
particular `scan` never writes one: a scan that quietly re-approved whatever it
found would approve the exact substitution the file exists to catch.

Two conditions refuse to write rather than writing something misleading:

- **A truncated hash.** If the scan's resource budgets stopped short, the
  digest covers part of a directory. Recording it would approve a file set
  nobody read, and every later check would pass against that subset. Raise the
  budgets and run again. `--allow-incomplete` is rejected outright here for the
  same reason.
- **Two different artifacts under one identity.** The same artifact installed
  in two skill directories is normal and locks once. Two copies with different
  digests is not: the file could only approve one of them, silently.

## Checking

```bash
skill-advisories lock --check
skill-advisories lock --check --strict
```

| Exit code | Meaning |
| --- | --- |
| 0 | Installed artifacts match the lockfile, or drift the policy tolerates |
| 1 | Drift the policy rejects |
| 2 | The check could not run |

The split between 1 and 2 matters, and follows the rule `verify` already uses. A
lockfile that does not exist, or does not parse, is not evidence of drift — the
check had nowhere to look. Reporting that as a failed comparison would send an
operator looking for a change that never happened.

**A lockfile approving one identity twice with two different digests is refused
the same way.** `lock` never writes one, but a botched merge or another tool
can produce one, and such a file has not said which of the two artifacts it
approves. Resolving it by position would be worse than refusing it: the drift
comparison and the lookup behind the MCP server read the entry list
differently, so one file could report drift to `lock --check` while telling an
agent the same digest was approved — the exact substitution the lockfile exists
to catch. Repeating an identity with the *same* digest is redundant rather than
contradictory and is accepted.

Four kinds of drift are reported together rather than stopping at the first,
because they mean different things:

| Category | What it means |
| --- | --- |
| `unlocked` | Installed with no entry in the lockfile — nobody approved this |
| `changed` | Approved, still installed, contents no longer match |
| `missing` | Approved but not installed here |
| `indeterminate` | Installed, but budgets truncated the hash, so neither agreement nor drift can be claimed |

`missing` never fails. A lockfile describes what is allowed, not what is
required, and the usual cause is a developer machine with a smaller install set
than the one the lock was generated on.

`indeterminate` is not folded into either agreement or drift. A resource limit
must not read as a clean result, which is the same fail-closed rule the scanner
already applies to exhausted budgets.

## Deciding what fails

The comparison reports; the policy decides. `unlockedArtifacts` governs all
three failing categories, because they are one question asked from different
angles — *is something installed here that this repository did not approve?*

```json
{
  "schemaVersion": "1",
  "unlockedArtifacts": "review"
}
```

| Value | Behaviour |
| --- | --- |
| `allow` | Drift is not reported as a problem |
| `review` | Drift is reported; the exit code stays 0 unless `--strict` |
| `block` | Drift exits 1 |

**The default is `review`, not `block`.** Adopting a lockfile mid-project would
otherwise fail the next unrelated pull request on artifacts that were already
installed and were never in question. `review` lets a repository see the
reports first and enforce when the set is clean. `--strict` promotes `review`
to exit 1 for a single run, which is the same idiom `--max-feed-age` uses, so
CI can enforce before the committed policy does.

## In CI

This repository locks the integrations it ships:

```yaml
- name: Shipped integrations match their approved contents
  run: npm run lock:check
```

```
lock:check = skill-advisories lock --check integrations \
  --lockfile integrations/skill-advisories.lock.json --strict
```

Two things make a committed lockfile safe to verify on a matrix of runners:

1. **Line endings must be normalised.** Digests are over bytes, so a lockfile
   generated from a CRLF checkout fails on Linux and macOS. A
   [`.gitattributes`](../.gitattributes) rule of `* text=auto eol=lf` is what
   makes the committed digests portable across ubuntu, windows, and macos.
2. **The lockfile does not hash itself.** It sits inside the tree it locks,
   which is safe because artifacts are the skill subdirectories rather than the
   parent, so it is never part of either digest.

## JSON output

`lock --format json` reports a write:

```json
{
  "schemaVersion": "1",
  "lockfile": "skill-advisories.lock.json",
  "written": true,
  "generated": "2026-08-01T02:03:55.565Z",
  "artifacts": 2,
  "stats": { "discoveredFiles": 3, "hashedFiles": 3, "hashedBytes": 2061 }
}
```

`stats` is the same scan telemetry object `scan` reports, described in the
[JSON result contract](result-schema.md); the fields above are an excerpt.

`written` is `false` when the approved set was already recorded. The writer
compares serialised bytes before touching the file, so a no-op `lock` does not
dirty a working tree.

`lock --check --format json` reports a comparison:

```json
{
  "schemaVersion": "1",
  "lockfile": "skill-advisories.lock.json",
  "decision": "review",
  "reasons": ["deploy-helper does not match its approved contents (expected a829...8ce6)"],
  "drift": {
    "unlocked": [],
    "changed": [{ "key": "deploy-helper", "expected": "a829...8ce6", "actual": "4c17...09fd" }],
    "missing": [],
    "indeterminate": [],
    "matched": ["vscode"]
  },
  "stats": { "discoveredFiles": 3, "hashedFiles": 3, "hashedBytes": 2061 }
}
```

Note that the lockfile document uses `schema_version` while the CLI result
wrapper uses `schemaVersion`. They are different surfaces with different
version lines: the first versions the file format, the second versions the
[JSON result contract](result-schema.md).

`decision` is the policy's verdict, not the exit code. Under `review` without
`--strict` the process still exits 0 while reporting reasons, which is what
lets a consumer record drift without failing on it.
