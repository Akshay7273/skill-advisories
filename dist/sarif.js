export function severityToLevel(severity) {
    switch (severity) {
        case "critical":
        case "high":
            return "error";
        case "medium":
            return "warning";
        default:
            return "note";
    }
}
export function buildSarif(findings, toolVersion) {
    const rules = new Map();
    for (const f of findings) {
        if (!rules.has(f.advisoryId)) {
            rules.set(f.advisoryId, {
                id: f.advisoryId,
                shortDescription: { text: f.summary },
                helpUri: "https://github.com/Akshay7273/skill-advisories",
            });
        }
    }
    return {
        $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
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
    };
}
const SEVERITY_ORDER = ["low", "medium", "high", "critical"];
export function meetsThreshold(severity, failOn) {
    const s = SEVERITY_ORDER.indexOf(severity);
    const t = SEVERITY_ORDER.indexOf(failOn);
    if (s === -1 || t === -1)
        return true; // unknown severities always fail safe
    return s >= t;
}
