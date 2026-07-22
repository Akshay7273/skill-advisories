import { describe, expect, it } from "vitest"
import { buildSarif, meetsThreshold, severityToLevel } from "../src/sarif.js"

describe("severityToLevel", () => {
	it("maps critical and high to error", () => {
		expect(severityToLevel("critical")).toBe("error")
		expect(severityToLevel("high")).toBe("error")
	})
	it("maps medium to warning and low to note", () => {
		expect(severityToLevel("medium")).toBe("warning")
		expect(severityToLevel("low")).toBe("note")
	})
})

describe("meetsThreshold", () => {
	it("passes severities at or above the threshold", () => {
		expect(meetsThreshold("critical", "high")).toBe(true)
		expect(meetsThreshold("high", "high")).toBe(true)
	})
	it("filters severities below the threshold", () => {
		expect(meetsThreshold("medium", "high")).toBe(false)
	})
})

describe("buildSarif", () => {
	const sarif = buildSarif(
		[
			{
				advisoryId: "SKA-2026-0008",
				severity: "critical",
				summary: "malicious skill",
				artifactName: "omnicogg",
				matchedBy: "name",
			},
		],
		"0.2.0",
	) as any
	it("emits sarif 2.1.0 with one result", () => {
		expect(sarif.version).toBe("2.1.0")
		expect(sarif.runs[0].results).toHaveLength(1)
	})
	it("maps the finding to ruleId and level", () => {
		expect(sarif.runs[0].results[0].ruleId).toBe("SKA-2026-0008")
		expect(sarif.runs[0].results[0].level).toBe("error")
	})
	it("declares the rule once in the driver", () => {
		expect(sarif.runs[0].tool.driver.rules).toHaveLength(1)
	})
})
