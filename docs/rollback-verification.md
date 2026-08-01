# Verified recovery points

`verify` asks whether a feed directory matches its own evidence. That is the
right question when you have one copy and want to know if it survived transit
intact, but it is the wrong question during an incident, because a directory
assembled by an attacker answers it perfectly. Checksums, cursor, and history
are all part of the same tree; recomputing them over substituted advisories
produces a copy that is internally consistent and entirely fraudulent.

`rollback` asks the question an operator holding a suspect feed actually has:
*of the copies I hold, which is the newest one the published history proves
good?* It reads the history as a separate input, examines every candidate, and
reports the newest copy the evidence justifies.

It writes nothing. Selecting a recovery point and performing the recovery are
separate decisions, and the second one belongs to a human. The procedure for
the second is [last-known-good feed recovery](operations/rollback.md).

## Selecting

```
# The shipped feed, judged against the shipped log
skill-advisories rollback

# Several mirrors, judged against a log obtained independently
skill-advisories rollback ./mirror-a ./mirror-b ./mirror-c \
  --history ./trusted/history.json
```

Candidates default to `feed` and the history to `feed/history.json`. Output
names the selected copy, its cursor, and the state the log says it is, and lists
every rejected copy with the reason it was rejected.

Exit `0` means a recovery point was selected, `1` that no candidate is provably
good, and `2` that the history could not be read at all — an outage in the
evidence rather than a verdict on the copies.

## What the history has to be

The separation of the log from the candidates is the entire security property.
A copy carrying its own `history.json` will verify against it, because both were
written by whoever assembled the copy. Pointing `--history` at a log inside a
candidate directory therefore reduces the check to `verify` with extra steps.

Supply a log you obtained independently: from the repository, from a mirror you
control, or from a release you had already verified before the incident began.
The log is append-only and each entry records a cursor, a publication timestamp,
an advisory count, and the digest of the exact `feed.json` bytes published under
that cursor, so an older copy of it still covers every state up to the point it
was taken.

A log that has been rewritten disqualifies everything in it. When the chain
itself fails — a duplicated cursor, an unparseable timestamp, an entry that
predates the one before it — every candidate is still examined and reported, but
none is selected, because the authority that would vouch for them is broken.

## What decides a candidate

Each copy is verified against its own evidence first, exactly as `verify` would.
A copy that fails there is rejected before the log is consulted.

The copy's cursor is then located in the log. A cursor the log never published
is rejected however consistent the copy is with itself; this is the case that
catches a forged release. When the cursor is found, the copy's digest is
compared against the digest published under it. The digest covers every byte of
the document, so agreement there already settles the timestamp and the advisory
count — comparing those separately would report one substituted file as three
faults.

Two things are deliberately not considered.

Ordering does not come from the copies. Candidates are ranked by their position
in the log, not by the `generated` timestamp they carry, because a tampered feed
can claim any date it likes and the only trustworthy answer to *which of these
is newer* is the order in which they were published.

Age is not a fault. A recovery point is chosen precisely because the current
state is suspect, so the copy worth landing on is normally an old one, and
treating age as a fault would reject every candidate worth having. `rollback`
refuses `--max-feed-age` rather than ignoring it.

## In CI

```yaml
- name: Published feed is a usable recovery point
  run: npx skill-advisories rollback feed --history feed/history.json
```

This catches a class of fault the surrounding checks cannot. `validate`,
`verify`, and the feed-in-sync check each compare a document against evidence
generated in the same run, so a compile that appended a history entry while
leaving the feed bytes at an older digest would pass all three. Only a
comparison against the accumulated log notices.

## JSON output

```json
{
  "schemaVersion": "1",
  "history": "feed/history.json",
  "published": 3,
  "candidates": [
    {
      "dir": "./mirror-a",
      "cursor": "19f7bc9e...",
      "digest": "94b61c93...",
      "advisoryCount": 13,
      "position": 2,
      "generated": "2026-07-31T21:10:29.393Z",
      "problems": []
    }
  ],
  "selected": { "dir": "./mirror-a", "...": "..." },
  "problems": []
}
```

`candidates` is ordered newest published state first, with copies the log does
not know about sorted to the end. `generated` is the timestamp the log records
for that state, not the one the copy claims. `problems` at the top level holds
faults in the log itself; `selected` is absent whenever it is non-empty. Per
candidate, `cursor`, `digest`, `advisoryCount`, `position`, and `generated` are
present only as far as the copy could be read and located.

The full contract is in [the JSON result schema](result-schema.md#exit-codes).
