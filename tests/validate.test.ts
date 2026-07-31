import { describe, expect, it } from "vitest"
import { loadAdvisories } from "../src/load.js"
import { validateAdvisories } from "../src/validate.js"

describe("advisory validation", () => {
  it("accepts the live advisories directory", async () => {
    const problems = await validateAdvisories(await loadAdvisories("advisories"))
    expect(problems).toHaveLength(0)
  })

  it("accepts the valid fixture", async () => {
    const problems = await validateAdvisories(await loadAdvisories("fixtures/valid"))
    expect(problems).toHaveLength(0)
  })

  it("rejects an unknown ecosystem", async () => {
    const problems = await validateAdvisories(await loadAdvisories("fixtures/invalid"))
    expect(
      problems.some(
        (p) => p.file === "SKA-2026-9902.json" && p.problem.includes("allowed values"),
      ),
    ).toBe(true)
  })

  it("rejects a filename that does not match the id", async () => {
    const problems = await validateAdvisories(await loadAdvisories("fixtures/invalid"))
    expect(
      problems.some(
        (p) => p.file === "wrong-name.json" && p.problem.includes("must be SKA-2026-9903.json"),
      ),
    ).toBe(true)
  })

  it("rejects duplicate artifact identities within an advisory", async () => {
    const loaded = await loadAdvisories("fixtures/valid")
    loaded[0].advisory.artifacts.push({
      ...loaded[0].advisory.artifacts[0],
      name: loaded[0].advisory.artifacts[0].name.toUpperCase(),
    })
    const problems = await validateAdvisories(loaded)
    expect(problems.some((p) => p.problem.includes("duplicate artifact"))).toBe(true)
  })
})
