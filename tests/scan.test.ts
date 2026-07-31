import { createHash } from "node:crypto"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { scanSkills } from "../src/scan.js"

const digest = (value: string) => createHash("sha256").update(value).digest("hex")

describe("bounded skill scanning", () => {
  it("hashes the installed path even when metadata declares a different name", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ska-scan-"))
    const installedPath = path.join(root, "renamed-folder")
    await mkdir(installedPath)
    await writeFile(
      path.join(installedPath, "package.json"),
      JSON.stringify({ name: "declared-name", version: "1.0.0" }),
    )
    await writeFile(path.join(installedPath, "payload.js"), "known payload")
    const feed = {
      advisories: [
        {
          id: "SKA-2026-9999",
          artifacts: [
            {
              ecosystem: "npm",
              name: "different-name",
              sha256: [digest("known payload")],
            },
          ],
          references: [],
        },
      ],
    } as any

    const result = await scanSkills([root], feed, { ecosystem: "npm", concurrency: 2 })
    expect(result.matches).toEqual([
      expect.objectContaining({
        query: "declared-name",
        matchedBy: "sha256",
        file: "payload.js",
      }),
    ])
    expect(result.stats.hashedFiles).toBe(2)
  })

  it("aggregates exhausted resource budgets across artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ska-budget-"))
    for (const name of ["one", "two"]) {
      const installedPath = path.join(root, name)
      await mkdir(installedPath)
      await writeFile(path.join(installedPath, "a.txt"), "1")
      await writeFile(path.join(installedPath, "b.txt"), "2")
    }
    const result = await scanSkills([root], { advisories: [] } as any, {
      concurrency: 2,
      hash: { maxFiles: 1 },
    })
    expect(result.stats).toMatchObject({
      discoveredFiles: 4,
      hashedFiles: 2,
      skippedBudgetFiles: 2,
      budgetExhausted: true,
      artifactsWithExhaustedBudgets: 2,
    })
  })

  it("rejects zero scan concurrency", async () => {
    await expect(scanSkills([], { advisories: [] } as any, { concurrency: 0 })).rejects.toThrow(
      "positive integer",
    )
  })
})
