# Running a pilot

This project needs downstream integrations more than it needs features. If you
maintain an agent skill, a plugin registry, an MCP server, or CI that installs
any of those, this page describes what a pilot involves and what is asked of
you afterwards.

It is deliberately specific about the cost, because a pilot that turns out to
be open-ended is one nobody agrees to.

## What a pilot is

Run one of the integrations below against your real artifacts for one release
cycle, and say publicly whether it was useful. That is the whole commitment.

There is no agreement to sign, no telemetry, and nothing is sent anywhere: the
CLI downloads a published feed and does its work locally. You can stop at any
point without telling anyone.

## What is asked at the end

One public link showing the integration -- a workflow file, a config, a
comment, a post -- plus your consent to be listed. Both are needed, and a link
without consent is not enough.

Accepted pilots are recorded in [`adopters.json`](../adopters.json), which is
validated in CI on every pull request. Nothing else counts as adoption here: a
download is not a dependent, and the [readiness
report](claude-oss-readiness.md) says so in the same terms.

If the answer is "we tried it and it was not worth it", that is a genuinely
useful result and is welcome in the [pilot
issue](https://github.com/Akshay7273/skill-advisories/issues/12). It will not
be recorded as an adoption.

## Three ways in

### Command line, no install

```
npx @akshay7273/skill-advisories check better-polymarket
```

A name with a published advisory exits 1 and prints the advisory with its
sources; a clean name exits 0. Add `--ecosystem clawhub` to restrict matching
to one registry, and `--json` or `--format sarif` for machine-readable output.

To check what is already installed rather than a name you type:

```
npx @akshay7273/skill-advisories scan
```

### GitHub Actions

```yaml
- uses: Akshay7273/skill-advisories@v1
  with:
    names: your-skill-name
    ecosystem: clawhub
```

The step fails when an advisory matches. `v1` follows the latest compatible
release; pin the commit SHA if you would rather approve upgrades yourself.
Inputs are documented in [`action.yml`](../action.yml).

### MCP server

A read-only stdio server, so an agent can check an artifact before installing
it. Configuration for VS Code agent mode and OpenClaw is in
[integrations](integrations.md), and the tool surface is described in
[mcp.md](mcp.md).

## What this project will not claim

- That downloads are adoption. They are recorded separately, with the window
  they cover, and the July 2026 figures show why: one day contributed 520 of
  823 downloads for a package with no dependents.
- That you are an adopter without your consent, even if your integration is
  public and easy to find.
- That a pilot endorses the project. Being listed means the integration
  existed and you agreed to be named.

An entry can be removed on request, with no reason required. Open an issue or
send a pull request deleting the row.

## Before you start

Two things worth knowing rather than discovering:

- The feed currently carries a small number of advisories, concentrated in the
  `clawhub` ecosystem. If your artifacts are elsewhere, expect clean results --
  which tells you about coverage, not about your artifacts.
- Advisory data is only as good as its sources. Every advisory cites public
  reports, and [reachability of those citations](../.github/workflows/references.yml)
  is checked weekly. If you think an advisory is wrong, the
  [dispute process](../.github/ISSUE_TEMPLATE/dispute.yml) exists for that.
