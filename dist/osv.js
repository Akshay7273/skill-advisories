const OSV_ECOSYSTEMS = {
    "claude-skill": "Claude Skill",
    "claude-plugin": "Claude Plugin",
    clawhub: "ClawHub",
    "mcp-server": "MCP Server",
    npm: "npm",
    pypi: "PyPI",
    "vscode-extension": "VSCode Extension",
    "github-action": "GitHub Actions",
};
/** Convert a native SKA advisory into an OSV-compatible record. */
export function toOsv(advisory) {
    return {
        id: advisory.id,
        ...(advisory.aliases?.length ? { aliases: advisory.aliases } : {}),
        summary: advisory.summary,
        ...(advisory.details ? { details: advisory.details } : {}),
        published: advisory.published,
        modified: advisory.modified,
        ...(advisory.withdrawn ? { withdrawn: advisory.withdrawn } : {}),
        affected: advisory.artifacts.map((artifact) => {
            const versions = artifact.versions?.filter((version) => version !== "*");
            return {
                package: {
                    ecosystem: OSV_ECOSYSTEMS[artifact.ecosystem],
                    name: artifact.name,
                },
                ...(versions?.length ? { versions } : {}),
                database_specific: {
                    native_ecosystem: artifact.ecosystem,
                    ...(artifact.publisher ? { publisher: artifact.publisher } : {}),
                    ...(artifact.sha256?.length ? { sha256: artifact.sha256 } : {}),
                },
            };
        }),
        references: advisory.references,
        database_specific: {
            type: advisory.type,
            severity: advisory.severity,
            ...(advisory.behaviors?.length ? { behaviors: advisory.behaviors } : {}),
            ...(advisory.credits?.length ? { credits: advisory.credits } : {}),
            source: "https://github.com/Akshay7273/skill-advisories",
        },
    };
}
