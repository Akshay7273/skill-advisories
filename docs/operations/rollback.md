# Last-known-good feed recovery

## Selecting a recovery point

Choose the newest immutable release tag whose GitHub commit, npm package,
attestation, and `feed/checksums.txt` all verify. A successful download alone is
not evidence of integrity. Record the selected tag and every verification step.

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
match, registry and GitHub artifacts resolve to the documented commits, and
known downstream consumers have received the correction.
