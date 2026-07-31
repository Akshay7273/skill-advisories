# Correction and withdrawal runbook

## Trigger

New evidence shows that a published field is inaccurate, scope changed, a
reference disappeared, an identifier conflicts, or the advisory should no
longer be treated as active.

## Procedure

1. Open a correction record linking the original advisory and new evidence.
2. Assess whether the error can cause false negatives. If so, use the incident
   response timeline and publish a warning promptly.
3. Correct factual fields in place, advance `modified`, and describe the change
   in the pull request and release notes.
4. For a retracted finding, retain the record and set `withdrawn`; never recycle
   or silently delete an SKA identifier.
5. Recompile native and OSV feeds and verify all checksums.
6. Add a regression test when the correction exposed a validation or matching
   weakness.

## Verification

Run `npm run validate`, `npm test`, `npm run compile`, and
`npm run health:check`. Confirm withdrawn advisories remain available for audit
but do not appear in active lookup indexes.

## Communication

Credit the person who identified the error when they consent. Link corrections
from the original report when possible, notify known downstream consumers for
material false-negative changes, and preserve the complete Git history.
