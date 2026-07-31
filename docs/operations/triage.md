# Advisory triage runbook

## Trigger

An advisory submission, private report, registry takedown, vendor bulletin, or
maintainer observation identifies a potentially malicious or vulnerable agent
artifact.

## First response

1. Record receipt time and acknowledge the reporter without confirming an
   unverified claim.
2. Preserve URLs, hashes, package coordinates, versions, and original evidence.
3. Do not execute submitted artifacts on a maintainer workstation or CI runner.
4. Move sensitive details to the private reporting channel described in
   `SECURITY.md` when publication could expose users or a reporter.

Target acknowledgement is two business days. Credible active exploitation is
handled immediately under the incident runbook.

## Evidence decision

An advisory needs a stable artifact identity and at least one public source or
reproducible technical record. Confirm ecosystem, publisher, affected versions,
SHA-256 values, behavior, severity, and whether the upstream owner has already
responded. Record disagreements rather than presenting inference as fact.

Reject or defer reports that provide only reputation claims, screenshots with
no provenance, inaccessible private evidence, or an unbounded product name.

## Publication

1. Allocate the next SKA identifier without renumbering existing records.
2. Add a schema-valid advisory and focused regression test when detection logic
   changes.
3. Run `npm run validate`, `npm test`, and `npm run compile`.
4. Confirm `git diff --exit-code feed/` after the generated feed is committed.
5. Obtain review when another maintainer is available; disclose conflicts of
   interest in the pull request.
6. Credit consenting reporters and link the public evidence.

## Completion record

Link the report, decision rationale, advisory identifier, validation run, merge
commit, publication time, and any notifications sent to affected maintainers.
