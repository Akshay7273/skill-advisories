# Compromised release response

## Trigger

A credential, maintainer account, workflow, npm package, Git tag, release asset,
or generated feed may have been modified or published without authorization.

## Containment

1. Stop publication workflows and preserve logs before changing configuration.
2. Revoke the affected token or session using the provider's supported controls;
   do not copy credentials into issues or chat.
3. Restrict repository and registry access only as far as required to contain
   the incident.
4. Identify the first known bad commit, tag, package version, checksum, actor,
   and timestamp. Treat uncertain scope as affected.
5. Deprecate known-bad npm versions with a warning; do not assume deletion
   removes cached or mirrored copies.

## Recovery

Recover the feed using the last-known-good runbook. Patch from a verified clean
commit, rotate affected credentials, review workflow permissions, rebuild on a
clean runner, and publish a new version. Never move or recreate a compromised
immutable release tag to conceal the event.

## Communication

Publish an initial notice once facts are sufficient to help users act. Include
affected versions and time range, known indicators, safe replacement version,
verification instructions, and the next update time. Correct the notice as the
investigation evolves and publish a retrospective with causes and preventive
actions after containment.

## Closure evidence

Record revoked credentials, reviewed audit logs, affected artifacts, replacement
checksums, clean CI and attestation links, user notification channels, and every
follow-up issue with an owner.
