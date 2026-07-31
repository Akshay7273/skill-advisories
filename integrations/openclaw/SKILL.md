---
name: skill-advisories-check
description: Check an OpenClaw or ClawHub skill against public security advisories before installation.
---

# Skill advisory check

Use this skill before installing or updating an untrusted OpenClaw/ClawHub
skill. Ask for the exact registry identity and version when the request is
ambiguous.

Run from this skill directory:

```sh
node scripts/check-artifact.mjs <skill-name> --version <version>
```

Exit code `0` means no matching advisory is currently known; it does not prove
the artifact is safe. Exit code `1` means policy found a known advisory. Exit
code `2` means the check could not complete and installation must stop.

Report the SKA identifier, severity, summary, and evidence URLs to the user. Do
not proceed automatically after a warning or operational failure.
