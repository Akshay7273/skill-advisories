# Contributing

skill-advisories is a community advisory database for AI agent skills, plugins, and MCP servers. The most valuable contribution is a well-sourced advisory.

## Proposing a new advisory

1. Check the [feed](https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json) to make sure the artifact is not already covered.
2. Either open a **"Report a malicious or vulnerable skill"** issue, or send a pull request directly.

### Adding an advisory by pull request

1. Create `advisories/SKA-YYYY-NNNN.json` using the next free sequence number. (`SKA-2026-0000` is reserved for tests and never appears in the feed.)
2. Follow [`schema/advisory.schema.json`](schema/advisory.schema.json). The filename must equal the advisory `id`.
3. Verify and regenerate the feed:

```

npm install

npm run validate

npm test

npm run compile

```

4. Commit the advisory **and** the regenerated `feed/` files — CI fails if the feed is out of sync with the advisories.

## Data integrity rules

1. **Published evidence only.** Every advisory must cite at least one published public reference: a vendor report, researcher writeup, or registry takedown.
2. **No hearsay.** Submissions without a published report or reproducible evidence are not listed.
3. **SHA-256 only** in the `sha256` field. Hashes of other types (e.g. MD5 from older reports) belong in the `details` prose, not in the hash array.
4. **Never guess identities.** If a report redacts a publisher name, leave `publisher` unset.
5. **Summaries are factual.** State what was observed and by whom; avoid speculation about intent beyond what the cited reference establishes.

## Development

| Command | Purpose |
| --- | --- |
| `npm run validate` | Validate all advisories against the schema |
| `npm test` | Run the test suite |
| `npm run compile` | Regenerate `feed/feed.json` and `feed/index.json` |
| `npm run build` | Type-check and compile the CLI |
