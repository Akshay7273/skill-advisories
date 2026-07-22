export function severityToLevel(
	severity: string,
): "error" | "warning" | "note" {
	switch (severity) {
		case "critical":
		case "high":
			return "error"
		case "medium":
			return "warning"
		default:
			return "note"
	}
}

export type SarifFinding = {
	advisoryId: string
	severity: string
	summary: string
	artifactName: string
	matchedBy: "name" | "sha256"
	file?: string
}

export function buildSarif(
	findings: SarifFinding[],
	toolVersion: string,
): unknown {
	const rules = new Map<
		string,
		{ id: string; shortDescription: { text: string }; helpUri: string }
	>()
	for (const f of findings) {
		if (!rules.has(f.advisoryId)) {
			rules.set(f.advisoryId, {
				id: f.advisoryId,
				shortDescription: { text: f.summary },
				helpUri: "https://github.com/Akshay7273/skill-advisories",
			})
		}
	}
	return {
		$schema:
			"https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "skill-advisories",
						informationUri: "https://github.com/Akshay7273/skill-advisories",
						version: toolVersion,
						rules: [...rules.values()],
					},
				},
				results: findings.map((f) => ({
					ruleId: f.advisoryId,
					level: severityToLevel(f.severity),
					message: {
						text: `${f.artifactName} matches ${f.advisoryId} (matched by ${f.matchedBy}): ${f.summary}`,
					},
					locations: [
						{
							physicalLocation: {
								artifactLocation: { uri: f.file ?? f.artifactName },
							},
						},
					],
				})),
			},
		],
	}
}

const SEVERITY_ORDER = ["low", "medium", "high", "critical"] as const

export function meetsThreshold(severity: string, failOn: string): boolean {
	const s = SEVERITY_ORDER.indexOf(severity as (typeof SEVERITY_ORDER)[number])
	const t = SEVERITY_ORDER.indexOf(failOn as (typeof SEVERITY_ORDER)[number])
	if (s === -1 || t === -1) return true // unknown severities always fail safe
	return s >= t
}
