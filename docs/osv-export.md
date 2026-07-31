# OSV-compatible export

Every native SKA advisory is also published as an individual OSV-compatible
JSON record under `feed/osv/`. The native feed remains authoritative; the OSV
view exists for interoperability with vulnerability databases and security
tooling.

## Endpoints

- `feed/osv/index.json` lists every exported advisory and relative path.
- `feed/osv/SKA-YYYY-NNNN.json` contains one OSV record.
- `feed/checksums.txt` contains SHA-256 hashes for the native feed, indexes, and
  every OSV record.

## Field mapping

| Native SKA field | OSV field |
| --- | --- |
| `id` | `id` |
| `aliases` | `aliases` |
| `summary`, `details` | `summary`, `details` |
| `published`, `modified`, `withdrawn` | same OSV fields |
| artifact ecosystem and name | `affected[].package` |
| explicit artifact versions | `affected[].versions` |
| references | `references` |
| type, severity, behaviors, credits | `database_specific` |
| publisher and SHA-256 hashes | `affected[].database_specific` |

The wildcard native version (`"*"`) is represented by omitting OSV `versions`,
which indicates the advisory applies without an explicit version allow-list.
Agent-specific ecosystems use readable OSV ecosystem identifiers while their
canonical SKA identifier is retained as `native_ecosystem`.

## Verification

After downloading files, calculate SHA-256 for each path and compare it with
`feed/checksums.txt`. Release automation additionally creates Sigstore-backed
GitHub artifact attestations for the checksum manifest and npm package.
