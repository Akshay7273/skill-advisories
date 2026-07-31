# Release runbook

## Preconditions

- The milestone acceptance criteria are checked against merged behavior.
- `CHANGELOG.md`, schemas, generated feeds, examples, and public API declarations
  describe the same version.
- The worktree is clean and `main` equals `origin/main`.
- CI, Scorecard, feed health, tests, build, smoke, and benchmark regression jobs
  pass at the candidate commit.

## Candidate verification

Run:

```sh
npm ci
npm run validate
npm test
npm run build
npm run smoke
npm run health:check
npm run benchmark:ci
npm pack --dry-run
```

Version with `npm version <version> --no-git-tag-version`, rebuild committed
distribution files, commit once, and create an annotated `v<version>` tag.

## Publication

1. Push the reviewed commit and tag.
2. Run the protected `Publish release` workflow against that exact tag.
3. Confirm npm version, dist-tag, package contents, and provenance.
4. Create the GitHub release with user-facing changes, compatibility notes,
   verification results, and comparison link.
5. For a stable major Action release, update the moving major tag only after
   the immutable version tag is verified.

## Post-release verification

Install from the public registry in a clean directory. Exercise the CLI version,
one known match, one clean result, and MCP binary startup. Verify attestations
with `gh attestation verify <artifact> --repo Akshay7273/skill-advisories` and
record links to the workflow, npm package, GitHub release, and health page.

Never rewrite an immutable semantic-version tag or reuse a published npm
version. Patch forward when a released artifact is defective.
