# Claude for Open Source readiness

The project is being developed as useful public security infrastructure first.
Claude for Open Source eligibility is a useful external benchmark, not a reason
to manufacture activity.

## Published qualification paths

Anthropic currently lists these paths:

- 500 dependent repositories;
- 100 dependent packages;
- 200,000 combined monthly registry downloads;
- 100 pull requests merged into repositories the applicant does not own during
  the previous 12 months;
- 20 unique external contributors with merged pull requests during the previous
  12 months; or
- an OpenSSF criticality score of at least 0.4.

Anthropic also explicitly invites maintainers to apply when an ecosystem
quietly depends on their work, even when these thresholds do not fit. The
official program page is
[Claude for Open Source](https://claude.com/contact-sales/claude-for-oss).

## Measured signals

Signals are collected by `npm run metrics:collect` and appended to
[`metrics/history.json`](../metrics/history.json), one entry per collection,
each value carrying the URL it came from. The log is append-only and a
[monthly workflow](../.github/workflows/metrics.yml) proposes each new
collection as a pull request, so figures are dated and re-derivable rather
than typed in and overwritten.

A `null` means the source did not answer during that run. It never means the
signal is zero, and no previous value is carried forward in its place.

| Signal | 2026-08-02 | Source |
| --- | ---: | --- |
| npm downloads, rolling last month | 823 | npm downloads API |
| GitHub stars | 0 | GitHub repository metadata |
| OpenSSF Scorecard | 6.2 | OpenSSF Scorecard API |
| Public downstream integrations | 0 confirmed | [`adopters.json`](../adopters.json), checked in CI |

Two signals are collected by hand because no API answers them honestly.
**Dependent packages** has no public endpoint: the npm registry search accepts
a `depends:<pkg>` qualifier and silently ignores it, so `depends:express`
returns zero while the same query unencoded returns tens of thousands of
unrelated full-text matches. **Repository contributors** reads 2 from the API,
of which one is Dependabot; the human count is 1.

### Reading the download figure

The earlier baseline recorded 303 downloads for 2026-07-01 through 2026-07-30,
and that is still exactly what the API returns for those dates. The rolling
month reads 823 because a single day, 2026-07-31, contributed 520 downloads
against single digits on the days either side of it. For a package with no
dependents and no stars, that shape is mirror or scanner traffic rather than
adoption, and it is the reason this file records the window next to the number.

Downloads are not dependents, and generated Dependabot pull requests are not
external community contributions.

## Evidence we need to earn

The most credible near-term application is the “quietly depends on” path. A
strong application would link to:

1. independent projects or teams using the feed, CLI, Action, or MCP server;
2. evidence that the project prevents a real agent supply-chain failure mode;
3. reproducible scale and false-positive results;
4. public security, correction, release, and incident processes;
5. external advisory submissions or integration contributions; and
6. an OpenSSF Scorecard report with remediated findings.

The public [downstream pilot issue](https://github.com/Akshay7273/skill-advisories/issues/12)
is the intake point for independently verifiable integrations. A comment or
download is not sufficient: accepted evidence requires a public integration
link and maintainer consent. Accepted entries are recorded in
[`adopters.json`](../adopters.json), which CI validates on every pull request;
the count there is the answer to this question, and it is currently zero.

## Reporting rules

- Keep source links and collection dates for every adoption claim.
- Report the window a figure covers, not just the figure.
- Distinguish downloads, direct dependents, transitive dependents, and pilots.
- Count people, not automated accounts, for contributor reporting.
- Never buy, exchange, or script engagement.
- Apply when the evidence tells a coherent infrastructure story, even if no
  numeric threshold has been crossed.
