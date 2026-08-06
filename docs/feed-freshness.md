# Feed freshness and verification

An advisory feed is only useful if it is current. A consumer that pinned a copy
six months ago, or a mirror whose cron job died in April, still answers every
query — and answers them with silence about everything published since. A clean
result from a stale feed looks exactly like a clean result from a live one.

Two independent facts close that gap. Freshness answers *how old is this data*.
Verification answers *is this data one we published, unaltered*. Neither implies
the other: a faithful copy of last spring's feed verifies perfectly, and a
freshly generated forgery is current and worthless.

## Freshness

Every `check`, `scan`, and `verify` run evaluates the feed's `generated`
timestamp against a maximum age. `check` and `scan` report it as `feedAge`;
`verify` reports the same object as `freshness`.

| Status | Meaning |
| --- | --- |
| `fresh` | Generated within the age limit |
| `stale` | Older than the limit |
| `unknown` | No parseable `generated` timestamp |

```json
{
  "status": "stale",
  "ageHours": 241.6,
  "generated": "2026-07-22T05:03:11.482Z",
  "maxAgeHours": 48
}
```

`unknown` is deliberately not folded into `stale`. A feed with no usable
timestamp has not been shown to be old; it has failed to say anything, which is
a different defect and points at a different repair. Both are non-`fresh`, so a
consumer that only cares whether to trust the data can test `status !== "fresh"`
and get fail-closed behaviour without enumerating the cases.

## Rules

1. **The default limit is 48 hours.** The feed is republished daily, so two days
   of silence is one missed run plus a full grace period — long enough that a
   single failed cron does not cry wolf, short enough that an abandoned mirror
   is noticed within a working day.
2. **Staleness warns; `--strict` fails.** By default a stale feed prints a
   warning and leaves the exit code to the advisory findings, so an offline or
   air-gapped run does not start failing builds on its own. Under `--strict` it
   exits 2.
3. **A stale feed exits 2, not 1.** Exit 1 means an advisory matched. Nothing
   matched here; the data could not be shown to be current, which is the same
   class of fault as an unreachable feed.
4. **Future timestamps are not clamped.** A feed dated next year reports a
   negative age rather than zero. A mirror with a broken clock is a real problem
   and reporting it as perfectly fresh would hide it.
5. **The limit travels with the repository.** `maxFeedAgeHours` in the policy
   file is the durable place to set it, so the rule does not live in whichever
   CI invocation happens to run the check.

The daily feed-refresh workflow runs `npm run compile:refresh`, proposes every
changed publication artifact in one pull request, and merges only after full CI
and CodeQL workflow runs on the exact refresh commit pass. Ordinary
`npm run compile` remains byte-stable when no advisory changed, so local builds
and unrelated pull requests do not churn the feed timestamp. The workflow uses
the masked `FEED_REFRESH_TOKEN` repository secret for its branch and pull
request because GitHub deliberately suppresses workflow events created with the
default `GITHUB_TOKEN`; without a separate token the required checks would
never start. It explicitly dispatches and waits for CI and CodeQL against the
refresh branch, then uses the maintainer token's administrative merge permission
only after both complete successfully. A failed job leaves the PR open and the
feed unchanged.

## Setting the limit

```bash
# Warn when the feed is more than 12 hours old
skill-advisories scan --max-feed-age 12

# Fail the build instead of warning
skill-advisories scan --max-feed-age 12 --strict
```

`--max-feed-age` takes a positive integer number of hours. In a policy file:

```json
{
  "schemaVersion": "1",
  "maxFeedAgeHours": 12
}
```

The MCP server computes `feedAge` on every `check_artifact` call rather than
once at startup, because a long-lived server hands out answers for as long as it
runs and a feed that was fresh at boot will not stay that way.

## Verification

Freshness reads one field. Verification checks that the whole published
directory is internally consistent and matches what this project actually
published:

```bash
skill-advisories verify feed
```

It confirms the `feed.json` digest against `feed.json.sha256`, every entry in
`checksums.txt` against the bytes on disk, `compact.json` against the compact
projection of the feed, `delta.json`'s target cursor against the feed's own
cursor, and the feed's cursor against `history.json`.

`--format json` reports the same run as a machine-readable object:

```json
{
  "schemaVersion": "1",
  "dir": "feed",
  "digest": "9f2c...41ab",
  "cursor": "7d10...bc93",
  "advisoryCount": 14,
  "checkedFiles": 19,
  "freshness": { "status": "fresh", "ageHours": 3.2, "maxAgeHours": 48 },
  "problems": []
}
```

`feed/history.json` is an append-only log of every published state, recording
`cursor`, `generated`, `advisory_count`, and the `digest` of the exact bytes
served. The cursor identifies the complete publication state, including its
generation timestamp, so a freshness heartbeat is independently verifiable
even when no advisory changed. An ordinary unchanged local rebuild remains a
no-op. A feed whose cursor never appears in the log is the signal that matters
most: it was not published here.

| Exit code | Meaning |
| --- | --- |
| 0 | The directory matches its own evidence |
| 1 | It does not |
| 2 | The check could not run |

The split between 1 and 2 is the point. A missing `feed.json` or an unparseable
`checksums.txt` disproves nothing — the check had nowhere to look, and reporting
that as a failed verification would be a false accusation. Everything else is a
finding: each one is collected and reported together rather than aborting on the
first, so an operator sees the whole picture in a single run.

This is the automated form of the manual comparison in the
[last-known-good recovery runbook](operations/rollback.md). Run it against a
downloaded release before trusting it, and against your own `feed/` directory
after any recovery.

## Consumers

`feedAge` is an additive field on the JSON result contract; `schemaVersion`
stays `"1"` and consumers that ignore it keep working — see the
[result schema](result-schema.md). The MCP `check_artifact` tool returns the same
object. The [feed health page](https://akshay7273.github.io/skill-advisories/health.html)
publishes the current age so a consumer can check the source before pinning it.
