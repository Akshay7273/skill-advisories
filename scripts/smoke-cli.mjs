import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(root, "dist", "cli.js")
const packageVersion = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  })
}

const affected = run([
  "check",
  "rankaj",
  "--feed",
  "feed/feed.json",
  "--ecosystem",
  "clawhub",
  "--version",
  "1.0.0",
  "--json",
])
assert.equal(affected.status, 1, affected.stderr)
const result = JSON.parse(affected.stdout)
assert.equal(result.schemaVersion, "1")
assert.equal(result.matches[0].version, "1.0.0")
assert.deepEqual(result.matches[0].ecosystems, ["clawhub"])

const unaffected = run([
  "check",
  "rankaj",
  "--feed",
  "feed/feed.json",
  "--ecosystem",
  "clawhub",
  "--version",
  "2.0.0",
  "--json",
])
assert.equal(unaffected.status, 0, unaffected.stderr)

const invalid = run(["check", "rankaj", "--ecosystem", "not-real"])
assert.equal(invalid.status, 2)

const version = run(["--version"])
assert.equal(version.status, 0, version.stderr)
assert.equal(version.stdout.trim(), packageVersion)

const scanRoot = mkdtempSync(path.join(tmpdir(), "ska-smoke-"))
try {
  const artifact = path.join(scanRoot, "bounded-smoke-artifact")
  mkdirSync(artifact)
  writeFileSync(path.join(artifact, "a.txt"), "a")
  writeFileSync(path.join(artifact, "b.txt"), "b")
  const bounded = run([
    "scan",
    scanRoot,
    "--feed",
    "feed/feed.json",
    "--max-files",
    "1",
    "--json",
  ])
  assert.equal(bounded.status, 2, bounded.stderr)
  const boundedResult = JSON.parse(bounded.stdout)
  assert.equal(boundedResult.scan.hashedFiles, 1)
  assert.equal(boundedResult.scan.skippedBudgetFiles, 1)
  assert.equal(boundedResult.scan.budgetExhausted, true)

  const allowed = run([
    "scan",
    scanRoot,
    "--feed",
    "feed/feed.json",
    "--max-files",
    "1",
    "--allow-incomplete",
    "--json",
  ])
  assert.equal(allowed.status, 0, allowed.stderr)

  // A feed dated well past --max-feed-age must be reported but must not fail a
  // build on its own; only --strict promotes staleness to an exit code.
  const staleFeedPath = path.join(scanRoot, "stale-feed.json")
  const staleFeed = JSON.parse(readFileSync(path.join(root, "feed", "feed.json"), "utf8"))
  staleFeed.generated = new Date(Date.now() - 240 * 60 * 60 * 1000).toISOString()
  writeFileSync(staleFeedPath, JSON.stringify(staleFeed))

  const staleWarn = run(["check", "rankaj", "--feed", staleFeedPath, "--json"])
  assert.equal(staleWarn.status, 1, staleWarn.stderr)
  const staleResult = JSON.parse(staleWarn.stdout)
  assert.equal(staleResult.feedAge.status, "stale")
  assert.equal(staleResult.feedAge.maxAgeHours, 48)
  assert.ok(staleResult.feedAge.ageHours >= 240)

  const staleStrict = run(["check", "omnicog", "--feed", staleFeedPath, "--strict", "--json"])
  assert.equal(staleStrict.status, 2, staleStrict.stderr)

  const staleTolerated = run([
    "check",
    "omnicog",
    "--feed",
    staleFeedPath,
    "--strict",
    "--max-feed-age",
    "480",
    "--json",
  ])
  assert.notEqual(staleTolerated.status, 2)
  assert.equal(JSON.parse(staleTolerated.stdout).feedAge.status, "fresh")

  // verify has to agree with the publisher: a straight copy of what compile
  // wrote is the only input that should come back clean.
  const published = path.join(scanRoot, "published-feed")
  cpSync(path.join(root, "feed"), published, { recursive: true })

  const verified = run(["verify", published, "--format", "json"])
  assert.equal(verified.status, 0, verified.stderr)
  const verifyResult = JSON.parse(verified.stdout)
  assert.equal(verifyResult.schemaVersion, "1")
  assert.deepEqual(verifyResult.problems, [])
  assert.ok(verifyResult.checkedFiles > 0)

  // Editing a single severity leaves every byte of the surrounding evidence
  // intact, so this is the narrowest tamper the checks have to survive.
  const tamperedFeed = JSON.parse(readFileSync(path.join(published, "feed.json"), "utf8"))
  tamperedFeed.advisories[0].severity =
    tamperedFeed.advisories[0].severity === "low" ? "critical" : "low"
  writeFileSync(path.join(published, "feed.json"), JSON.stringify(tamperedFeed))

  const tampered = run(["verify", published, "--format", "json"])
  assert.equal(tampered.status, 1, tampered.stderr)
  assert.ok(JSON.parse(tampered.stdout).problems.length > 0)

  // Nothing was disproved here, the check simply had nowhere to look.
  const unreadable = run(["verify", path.join(scanRoot, "no-such-feed")])
  assert.equal(unreadable.status, 2)

  // A lockfile is a claim about the disk alone, so the whole round trip runs
  // against a tree this script builds rather than against the feed.
  const lockRoot = path.join(scanRoot, "lock-skills")
  const lockfile = path.join(scanRoot, "lock.json")
  for (const name of ["lock-alpha", "lock-beta"]) {
    mkdirSync(path.join(lockRoot, name), { recursive: true })
    writeFileSync(path.join(lockRoot, name, "SKILL.md"), `# ${name}\n`)
  }

  const written = run(["lock", lockRoot, "--lockfile", lockfile, "--format", "json"])
  assert.equal(written.status, 0, written.stderr)
  const writtenResult = JSON.parse(written.stdout)
  assert.equal(writtenResult.schemaVersion, "1")
  assert.equal(writtenResult.written, true)
  assert.equal(writtenResult.artifacts, 2)

  // Approving the same bytes twice must not rewrite the file, or every run
  // would dirty a working tree.
  const rewritten = run(["lock", lockRoot, "--lockfile", lockfile, "--format", "json"])
  assert.equal(rewritten.status, 0, rewritten.stderr)
  assert.equal(JSON.parse(rewritten.stdout).written, false)

  // The same guarantee has to survive an entry carrying an ecosystem and a
  // version, and a file whose keys are ordered the way the published schema
  // declares them rather than the way the writer happens to emit them. Both
  // reach buildLock through the lockfile parser, and comparing serialised
  // bytes read either as a changed approval set. This runs against its own
  // tree so the drift checks below still see the one they built.
  const versionedRoot = path.join(scanRoot, "versioned-skills")
  mkdirSync(path.join(versionedRoot, "versioned-alpha"), { recursive: true })
  writeFileSync(
    path.join(versionedRoot, "versioned-alpha", "SKILL.md"),
    "---\nname: versioned-alpha\nversion: 1.2.0\n---\n\n# versioned-alpha\n",
  )
  const versionedLockfile = path.join(scanRoot, "versioned-lock.json")
  const seeded = run([
    "lock",
    versionedRoot,
    "--lockfile",
    versionedLockfile,
    "--ecosystem",
    "npm",
    "--format",
    "json",
  ])
  assert.equal(seeded.status, 0, seeded.stderr)
  const seededLock = JSON.parse(readFileSync(versionedLockfile, "utf8"))
  assert.equal(seededLock.artifacts[0].ecosystem, "npm")
  assert.equal(seededLock.artifacts[0].version, "1.2.0")

  // Rewrite the file with its keys in the published schema's declared order,
  // plus the $schema reference the schema permits. Same approvals.
  writeFileSync(
    versionedLockfile,
    `${JSON.stringify(
      {
        $schema:
          "https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/schema/lock.schema.json",
        schema_version: "1",
        generated: seededLock.generated,
        artifacts: seededLock.artifacts.map((artifact) => ({
          name: artifact.name,
          ecosystem: artifact.ecosystem,
          version: artifact.version,
          sha256: artifact.sha256,
          files: artifact.files,
        })),
      },
      null,
      2,
    )}\n`,
  )
  const reordered = run([
    "lock",
    versionedRoot,
    "--lockfile",
    versionedLockfile,
    "--ecosystem",
    "npm",
    "--format",
    "json",
  ])
  assert.equal(reordered.status, 0, reordered.stderr)
  const reorderedResult = JSON.parse(reordered.stdout)
  assert.equal(reorderedResult.written, false, "a key reordering must not rewrite the lockfile")
  assert.equal(reorderedResult.generated, seededLock.generated)
  // A $schema reference the file carried is the repository's, not ours to drop.
  assert.ok(
    JSON.parse(readFileSync(versionedLockfile, "utf8")).$schema,
    "lock must preserve a $schema reference",
  )

  const clean = run(["lock", "--check", lockRoot, "--lockfile", lockfile, "--format", "json"])
  assert.equal(clean.status, 0, clean.stderr)
  const cleanResult = JSON.parse(clean.stdout)
  assert.equal(cleanResult.decision, "allow")
  assert.deepEqual(cleanResult.reasons, [])
  assert.equal(cleanResult.drift.matched.length, 2)

  // Adding a file changes an approved artifact. Under the default policy that
  // is reported without failing; --strict is what makes the softer signal count.
  writeFileSync(path.join(lockRoot, "lock-alpha", "extra.md"), "more\n")
  const drifted = run(["lock", "--check", lockRoot, "--lockfile", lockfile, "--format", "json"])
  assert.equal(drifted.status, 0, drifted.stderr)
  const driftedResult = JSON.parse(drifted.stdout)
  assert.equal(driftedResult.decision, "review")
  assert.equal(driftedResult.drift.changed.length, 1)
  assert.equal(driftedResult.drift.changed[0].key, "lock-alpha")

  const strictDrift = run(["lock", "--check", lockRoot, "--lockfile", lockfile, "--strict"])
  assert.equal(strictDrift.status, 1)

  // An artifact nobody approved is the case a policy is most likely to want
  // to block outright.
  rmSync(path.join(lockRoot, "lock-alpha", "extra.md"))
  mkdirSync(path.join(lockRoot, "lock-gamma"), { recursive: true })
  writeFileSync(path.join(lockRoot, "lock-gamma", "SKILL.md"), "# lock-gamma\n")

  const unlocked = run(["lock", "--check", lockRoot, "--lockfile", lockfile, "--format", "json"])
  assert.equal(unlocked.status, 0, unlocked.stderr)
  const unlockedResult = JSON.parse(unlocked.stdout)
  assert.equal(unlockedResult.decision, "review")
  assert.deepEqual(
    unlockedResult.drift.unlocked.map((artifact) => artifact.key),
    ["lock-gamma"],
  )

  const blockPolicy = path.join(scanRoot, "lock-policy.json")
  writeFileSync(blockPolicy, JSON.stringify({ schemaVersion: "1", unlockedArtifacts: "block" }))
  const blocked = run([
    "lock",
    "--check",
    lockRoot,
    "--lockfile",
    lockfile,
    "--policy",
    blockPolicy,
  ])
  assert.equal(blocked.status, 1)

  // A machine with a smaller install set is not drift, so a locked artifact
  // that is simply absent stays clean under the default policy.
  rmSync(path.join(lockRoot, "lock-gamma"), { recursive: true })
  rmSync(path.join(lockRoot, "lock-beta"), { recursive: true })
  const absent = run(["lock", "--check", lockRoot, "--lockfile", lockfile, "--format", "json"])
  assert.equal(absent.status, 0, absent.stderr)
  const absentResult = JSON.parse(absent.stdout)
  assert.deepEqual(
    absentResult.drift.missing.map((artifact) => artifact.key),
    ["lock-beta"],
  )

  // Checking against a lockfile that is not there is a check that could not
  // run, which is exit 2, not drift.
  const noLockfile = run([
    "lock",
    "--check",
    lockRoot,
    "--lockfile",
    path.join(scanRoot, "no-such-lock.json"),
  ])
  assert.equal(noLockfile.status, 2)

  // lock reads no feed and reports no findings, so the flags that only make
  // sense for those are refused rather than quietly ignored.
  for (const flag of [["--offline"], ["--refresh"], ["--format", "sarif"], ["--allow-incomplete"]]) {
    const refused = run(["lock", lockRoot, "--lockfile", lockfile, ...flag])
    assert.equal(refused.status, 2, `expected lock to refuse ${flag[0]}`)
  }

  // rollback judges copies against the history the operator trusts, so the
  // candidates here are copies of the published feed and the log they are
  // measured against is the one this repository ships.
  const history = path.join(root, "feed", "history.json")
  const intact = path.join(scanRoot, "recovery-intact")
  cpSync(path.join(root, "feed"), intact, { recursive: true })

  const selected = run(["rollback", intact, "--history", history, "--format", "json"])
  assert.equal(selected.status, 0, selected.stderr)
  const selectedResult = JSON.parse(selected.stdout)
  assert.equal(selectedResult.schemaVersion, "1")
  assert.equal(selectedResult.selected.dir, intact)
  assert.deepEqual(selectedResult.selected.problems, [])
  assert.equal(selectedResult.selected.position, selectedResult.published - 1)

  // The copy tampered with above still describes itself consistently enough to
  // be worth reporting, but nothing in it is provably good, so there is
  // nowhere safe to land and that is a finding rather than an outage.
  const nowhere = run(["rollback", published, "--history", history, "--format", "json"])
  assert.equal(nowhere.status, 1)
  const nowhereResult = JSON.parse(nowhere.stdout)
  assert.equal(nowhereResult.selected, undefined)
  assert.ok(nowhereResult.candidates[0].problems.length > 0)

  // A bad copy alongside a good one must not cost the good one its place.
  const mixed = run(["rollback", published, intact, "--history", history, "--format", "json"])
  assert.equal(mixed.status, 0, mixed.stderr)
  assert.equal(JSON.parse(mixed.stdout).selected.dir, intact)

  // With no readable log there is no authority to judge any copy against, so
  // this is a selection that could not run rather than one that found nothing.
  const noHistory = run(["rollback", intact, "--history", path.join(scanRoot, "no-such-log.json")])
  assert.equal(noHistory.status, 2)

  // Age is refused rather than ignored: a recovery point is normally old, and
  // a threshold that looked like it applied here would mislead.
  for (const flag of [["--offline"], ["--format", "sarif"], ["--max-feed-age", "48"]]) {
    const refused = run(["rollback", intact, "--history", history, ...flag])
    assert.equal(refused.status, 2, `expected rollback to refuse ${flag[0]}`)
  }
} finally {
  rmSync(scanRoot, { recursive: true, force: true })
}

console.log(
  "cli smoke: version, detection, validation, bounded scan, feed freshness, feed verification, lockfile, and recovery selection paths passed",
)
