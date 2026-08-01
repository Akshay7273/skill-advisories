# Roadmap

`skill-advisories` is building the open threat-intelligence and policy layer for
AI agent extensions. The goal is simple: a user, agent, registry, or CI system
should be able to answer **“is this skill, plugin, or MCP server safe to
install?”** before untrusted code runs.

The roadmap is outcome-driven. Dates are intentionally omitted: milestones ship
when their acceptance criteria are met, and priorities may change in response
to new ecosystem threats.

## Product principles

- **Evidence over inference.** Published advisories require public evidence or
  reproducible technical evidence.
- **Safe by default.** Network failure, malformed data, and unknown values must
  not silently weaken a security policy.
- **Open and interoperable.** Data should be useful without this CLI and should
  integrate with established security formats.
- **Fast enough for install-time checks.** Security checks should fit naturally
  into agent, registry, local development, and CI workflows.
- **Respectful disclosure.** Reports, disputes, corrections, and withdrawals
  follow a documented and auditable process.

## Shipped

- [x] Versioned advisory schema with evidence and withdrawal support
- [x] Validated JSON feed, lookup index, and SHA-256 digest
- [x] Exact-name and file-hash detection
- [x] Typosquat proximity warnings
- [x] Local directory scanning with offline cache support
- [x] Human, JSON, and SARIF output
- [x] GitHub Action and public advisory browser
- [x] Cross-platform CI on Linux, Windows, and macOS

## v0.3 — Precise detection

Reduce false positives and false negatives as the database grows.

- [x] Ecosystem-aware lookup (`--ecosystem`) and indexed matching
- [x] Version-aware advisories and affected-version evaluation
- [x] Detect installed skill metadata instead of relying only on directory names
- [x] Configurable scan exclusions and bounded hashing concurrency
- [x] Stable machine-readable result schema with documented exit semantics
- [x] A regression corpus for name, hash, version, and typosquat detection

**Exit criteria:** every match identifies its ecosystem, evidence, and matching
method; version-scoped advisories do not flag known-unaffected releases; the
public CLI contract is covered by end-to-end tests.

## v0.4 — Verifiable threat intelligence

Make the feed independently consumable and resistant to tampering.

- [x] OSV-compatible export and documented field mapping
- [x] Advisory aliases for CVE, GHSA, and vendor identifiers
- [ ] Structured evidence provenance and source archival metadata
- [x] Keyless Sigstore attestations for feed releases
- [ ] Feed freshness metadata and last-known-good rollback support
- [ ] Automated checks for broken references and duplicate artifacts

**Exit criteria:** consumers can verify feed provenance without trusting the
download channel, and security tools can ingest an OSV-compatible export.

## v0.5 — Agent-native protection

Put safety checks directly in the workflows where agents acquire capabilities.

- [x] Read-only MCP server for advisory search and artifact verification
- [x] Claude Code hook example for pre-install package checks
- [x] Declarative policy file for severity, ecosystem, hash, and warning requirements
- [ ] Lockfile format for approved artifact identities and hashes
- [x] Reusable API package with no CLI side effects
- [x] Reference integrations for at least three agent ecosystems

**Exit criteria:** an agent can check an artifact before installation, explain a
decision with cited evidence, and enforce a repository-owned security policy.

## v0.6 — Dependable at ecosystem scale

- [x] Incremental feed updates and compact index distribution
- [x] Bounded parallel scanning with streaming hashes and explicit resource budgets
- [x] Published performance benchmark harness with synthetic release corpora
- [x] Service-health and feed-freshness status page
- [x] Maintainer runbooks for triage, release, correction, and incident response
- [x] Automated release notes and signed npm provenance
- [x] OpenSSF Scorecard reporting with CodeQL SAST and protected main branch
- [x] Runnable reference integrations for at least three agent ecosystems
- [ ] One independently verifiable downstream integration or pilot

**Exit criteria:** resource usage and performance are reproducibly measured at
100,000 identities and 10,000 generated filesystem artifacts; every release or
data incident has a tested maintainer procedure; and at least one downstream
adopter can be cited publicly. See the [v0.6 release contract](docs/v0.6-plan.md).

## v1.0 — Stable public infrastructure

- [ ] Stable advisory and result schemas with a compatibility policy
- [ ] Independent security review and threat model
- [ ] Documented governance and maintainer succession
- [ ] At least 100 evidence-backed advisories across supported ecosystems
- [ ] At least 20 external contributors with merged work
- [ ] Demonstrated use by registries, security tools, or widely used projects

## Community and adoption

Technical quality alone does not create public infrastructure. Alongside product
work, the project will:

- label small, well-specified issues for first-time contributors;
- publish contributor acknowledgements and response-time expectations;
- collaborate with registries, security researchers, and agent-tool authors;
- report advisory coverage, false-positive results, and feed usage openly; and
- prefer integrations and documented APIs over project-specific lock-in.

Eligibility signals and adoption evidence are tracked transparently in the
[Claude for Open Source readiness document](docs/claude-oss-readiness.md).

## Proposing changes

Open an issue describing the user or ecosystem problem, the security impact,
and a measurable acceptance criterion. Substantial changes should be discussed
before implementation; evidence-backed advisory submissions can go directly to
a pull request.
