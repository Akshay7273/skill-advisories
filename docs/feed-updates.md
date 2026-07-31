# Compact feed and incremental updates

`feed/compact.json` is intended for install-time checks that need identities,
severity, evidence links, and hashes but not narrative details. The current file
is approximately half the size of the full native feed.

Every compact feed includes a semantic SHA-256 cursor for the corresponding full
feed. The cursor hashes normalized feed data, not transport whitespace; it is
separate from the byte-level values in `feed/checksums.txt`.

`feed/delta.json` describes the transition from one cursor to the next:

- `upserts` contains complete new or changed native advisories;
- `removed` contains identifiers no longer in the feed;
- `from` must match the consumer's local cursor; and
- the reconstructed feed must match `to` before it replaces local data.

Consumers with a different `from` cursor must download a complete feed. They
must not apply a delta approximately or ignore a failed `to` verification.
Updates should be written atomically so interruption leaves the last-known-good
feed available.

The package exports `feedCursor`, `buildFeedDelta`, `applyFeedDelta`, and
`buildCompactFeed` from `@akshay7273/skill-advisories/delta`.

```js
import { applyFeedDelta, feedCursor } from "@akshay7273/skill-advisories/delta"

if (feedCursor(localFeed) !== delta.from) throw new Error("full refresh required")
const next = applyFeedDelta(localFeed, delta)
```

All compact and delta files are covered by the multi-file checksum manifest and
the release attestation workflow.
