# Last-known-good feed recovery

## Selecting a recovery point

Run `skill-advisories rollback` over every copy of the feed you hold, judged
against the history log you trust:

```
skill-advisories rollback feed ./mirror-a ./mirror-b --history feed/history.json
```

It reports the newest copy the evidence proves good, and reports every copy it
rejected with the reason. Exit `0` means a recovery point was selected, `1` that
no candidate is provably good, and `2` that the history itself could not be
read — which is an outage in the evidence, not a verdict on the copies.

Two properties of the selection matter when reading the output. Ordering comes
from the log rather than from the copies, because a tampered feed can claim any
timestamp it likes and the only trustworthy answer to *which of these is newer*
is the order in which they were published. And the log is supplied separately on
purpose: a copy carrying its own `history.json` verifies perfectly against
evidence of its own making, which is exactly what a forged release looks like,
so `--history` must point at a log you obtained independently of the candidates.

Age is deliberately not a fault. A recovery point is chosen because the current
state is suspect, so the copy worth landing on is normally an old one.

The command writes nothing. Confirm the selected copy against the immutable
release tag it should correspond to — the GitHub commit, the npm package, and
the attestation — before acting on it. A successful download alone is not
evidence of integrity. Record the selected tag, the reported cursor and digest,
and every verification step.

## Recovery procedure

1. Compare the suspect feed with the selected release; identify unauthorized or
   defective advisory and generator changes.
2. Create a new recovery branch from current `main`. Revert only the defective
   changes while preserving unrelated valid advisories and history.
3. Restore affected generated files from validated advisory sources by running
   `npm run compile`; do not manually edit generated JSON.
4. Run `npm run validate`, `npm test`, `npm run health:check`, and
   `npm run benchmark:ci`.
5. Review the diff against both the suspect revision and selected recovery tag.
6. Merge and publish a new patch version using the release runbook.

## Downstream guidance

Publish the known-good and replacement version, affected time range, manifest
checksum, cache invalidation guidance, and whether consumers must rescan local
artifacts. Keep the compromised or incorrect release visible with an explicit
warning so mirrors and historical installations remain identifiable.

## Validation

The recovery is complete only when public feed health is healthy, all checksums
match, `skill-advisories rollback` selects the newly published state, registry
and GitHub artifacts resolve to the documented commits, and known downstream
consumers have received the correction.
