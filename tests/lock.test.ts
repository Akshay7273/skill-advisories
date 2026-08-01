import { readFile } from "node:fs/promises"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import { describe, expect, it } from "vitest"
import { buildLock, diffLock, lockKey, lockStatus, parseArtifactLock } from "../src/lock.js"
import type { ScannedArtifact } from "../src/scan.js"

const digest = (value: string) => value.repeat(64).slice(0, 64)

function observed(
  name: string,
  sha256: string,
  extra: Partial<ScannedArtifact> = {},
): ScannedArtifact {
  return {
    path: `/home/agent/.claude/skills/${name}`,
    name,
    ecosystem: "claude-skill",
    sha256,
    files: 3,
    incomplete: false,
    ...extra,
  }
}

const NOW = "2026-08-01T00:00:00.000Z"

describe("artifact lock", () => {
  it("records identity and contents, never the install path", () => {
    const lock = buildLock([observed("alpha", digest("a"), { version: "1.2.0" })], NOW)
    expect(lock).toEqual({
      schema_version: "1",
      generated: NOW,
      artifacts: [
        {
          name: "alpha",
          ecosystem: "claude-skill",
          version: "1.2.0",
          sha256: digest("a"),
          files: 3,
        },
      ],
    })
    expect(JSON.stringify(lock)).not.toContain("/home/agent")
  })

  it("validates a built lock against its public schema", async () => {
    const ajv = new Ajv2020({ allErrors: true })
    addFormats(ajv)
    const validate = ajv.compile(JSON.parse(await readFile("schema/lock.schema.json", "utf8")))
    const lock = buildLock(
      [observed("beta", digest("b")), observed("alpha", digest("a"), { ecosystem: undefined })],
      NOW,
    )
    expect(validate(lock), ajv.errorsText(validate.errors)).toBe(true)
  })

  it("orders entries by identity so the file does not churn with scan order", () => {
    const forwards = buildLock([observed("beta", digest("b")), observed("alpha", digest("a"))], NOW)
    const backwards = buildLock([observed("alpha", digest("a")), observed("beta", digest("b"))], NOW)
    expect(forwards).toEqual(backwards)
    expect(forwards.artifacts.map((entry) => entry.name)).toEqual(["alpha", "beta"])
  })

  it("keeps generated stable while the approved set is unchanged", () => {
    const first = buildLock([observed("alpha", digest("a"))], NOW)
    const again = buildLock([observed("alpha", digest("a"))], "2026-09-01T00:00:00.000Z", first)
    expect(again.generated).toBe(NOW)
    const changed = buildLock([observed("alpha", digest("c"))], "2026-09-01T00:00:00.000Z", first)
    expect(changed.generated).toBe("2026-09-01T00:00:00.000Z")
  })

  it("locks one entry for the same artifact installed twice", () => {
    const lock = buildLock(
      [
        observed("alpha", digest("a")),
        observed("alpha", digest("a"), { path: "/home/agent/.openclaw/skills/alpha" }),
      ],
      NOW,
    )
    expect(lock.artifacts).toHaveLength(1)
  })

  it("refuses to lock one identity covering two different artifacts", () => {
    expect(() =>
      buildLock([observed("alpha", digest("a")), observed("alpha", digest("b"))], NOW),
    ).toThrow("two installed copies differ")
  })

  it("refuses to approve a digest that covers only part of an artifact", () => {
    expect(() => buildLock([observed("alpha", digest("a"), { incomplete: true })], NOW)).toThrow(
      "stopped the hash short",
    )
  })

  it("separates identical names in different ecosystems", () => {
    const lock = buildLock(
      [observed("alpha", digest("a")), observed("alpha", digest("b"), { ecosystem: "npm" })],
      NOW,
    )
    expect(lock.artifacts.map(lockKey)).toEqual(["claude-skill:alpha", "npm:alpha"])
  })

  it("round-trips through the parser and rejects malformed documents", () => {
    const lock = buildLock([observed("alpha", digest("a"))], NOW)
    expect(parseArtifactLock(JSON.parse(JSON.stringify(lock)))).toEqual(lock)
    expect(() => parseArtifactLock({ ...lock, unexpected: true })).toThrow()
    expect(() =>
      parseArtifactLock({ ...lock, artifacts: [{ name: "alpha", sha256: "short", files: 1 }] }),
    ).toThrow()
  })
})

describe("lock drift", () => {
  const lock = buildLock([observed("alpha", digest("a")), observed("beta", digest("b"))], NOW)

  it("reports an unchanged install as matched", () => {
    const drift = diffLock(lock, [observed("alpha", digest("a")), observed("beta", digest("b"))])
    expect(drift.matched).toEqual(["claude-skill:alpha", "claude-skill:beta"])
    expect(drift.unlocked).toEqual([])
    expect(drift.changed).toEqual([])
    expect(drift.missing).toEqual([])
  })

  it("reports an artifact nobody approved", () => {
    const drift = diffLock(lock, [
      observed("alpha", digest("a")),
      observed("beta", digest("b")),
      observed("gamma", digest("c")),
    ])
    expect(drift.unlocked).toEqual([{ key: "claude-skill:gamma", sha256: digest("c") }])
  })

  it("reports an approved artifact whose contents changed", () => {
    const drift = diffLock(lock, [
      observed("alpha", digest("z"), { version: "2.0.0" }),
      observed("beta", digest("b")),
    ])
    expect(drift.changed).toEqual([
      {
        key: "claude-skill:alpha",
        expected: digest("a"),
        actual: digest("z"),
        version: "2.0.0",
      },
    ])
    expect(drift.matched).toEqual(["claude-skill:beta"])
  })

  it("reports an approved artifact that was not installed", () => {
    const drift = diffLock(lock, [observed("alpha", digest("a"))])
    expect(drift.missing).toEqual([{ key: "claude-skill:beta", sha256: digest("b") }])
  })

  it("never calls a truncated hash agreement or drift", () => {
    const drift = diffLock(lock, [
      observed("alpha", digest("a"), { incomplete: true }),
      observed("beta", digest("b")),
    ])
    expect(drift.indeterminate).toEqual([
      { key: "claude-skill:alpha", reason: "the scan's resource budgets stopped the hash short" },
    ])
    expect(drift.matched).toEqual(["claude-skill:beta"])
    expect(drift.changed).toEqual([])
    expect(drift.missing).toEqual([])
  })
})

describe("lock status", () => {
  const lock = buildLock(
    [observed("alpha", digest("a"), { version: "1.2.0" }), observed("beta", digest("b"))],
    NOW,
  )

  it("approves an artifact whose digest is the one recorded", () => {
    expect(lockStatus(lock, { name: "alpha", ecosystem: "claude-skill", sha256: digest("a") })).toEqual({
      key: "claude-skill:alpha",
      status: "approved",
      approved: digest("a"),
      version: "1.2.0",
    })
  })

  it("reports a locked identity carrying different bytes as changed", () => {
    const status = lockStatus(lock, {
      name: "alpha",
      ecosystem: "claude-skill",
      sha256: digest("z"),
    })
    expect(status.status).toBe("changed")
    expect(status.approved).toBe(digest("a"))
  })

  it("does not call a name alone approved", () => {
    // The whole reason the lockfile stores digests is that one name can carry
    // different bytes, so answering approved here would hand back the
    // reassurance without having done the check.
    expect(lockStatus(lock, { name: "beta", ecosystem: "claude-skill" })).toEqual({
      key: "claude-skill:beta",
      status: "unverified",
      approved: digest("b"),
    })
  })

  it("reports an identity the lockfile never approved", () => {
    expect(lockStatus(lock, { name: "gamma", ecosystem: "claude-skill", sha256: digest("c") })).toEqual({
      key: "claude-skill:gamma",
      status: "unapproved",
    })
  })

  it("distinguishes the same name in different ecosystems", () => {
    // Approving a Claude skill called alpha says nothing about an npm package
    // that happens to share the name.
    expect(lockStatus(lock, { name: "alpha", ecosystem: "npm", sha256: digest("a") }).status).toBe(
      "unapproved",
    )
    expect(lockStatus(lock, { name: "alpha", sha256: digest("a") }).status).toBe("unapproved")
  })

  it("compares digests without regard to case", () => {
    const status = lockStatus(lock, {
      name: "alpha",
      ecosystem: "claude-skill",
      sha256: digest("a").toUpperCase(),
    })
    expect(status.status).toBe("approved")
  })
})
