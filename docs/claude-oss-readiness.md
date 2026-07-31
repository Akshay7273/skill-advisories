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

## Baseline on 2026-07-31

| Signal | Baseline | Evidence policy |
| --- | ---: | --- |
| GitHub stars | 0 | GitHub repository metadata |
| GitHub forks | 0 | GitHub repository metadata |
| Repository contributors | 1 | GitHub contributors API |
| npm downloads, previous reported month | 303 | npm downloads API, 2026-07-01 through 2026-07-30 |
| Public downstream integrations | 0 confirmed | Only independently verifiable integrations count |

Downloads are not dependents, and generated Dependabot pull requests are not
external community contributions. This baseline should be updated with an
automated, dated report rather than overwritten without history.

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
link and maintainer consent.

## Reporting rules

- Keep source links and collection dates for every adoption claim.
- Distinguish downloads, direct dependents, transitive dependents, and pilots.
- Count people, not automated accounts, for contributor reporting.
- Never buy, exchange, or script engagement.
- Apply when the evidence tells a coherent infrastructure story, even if no
  numeric threshold has been crossed.
