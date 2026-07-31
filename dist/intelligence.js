import { collectKnownNames, matchHashes, matchNames } from "./lookup.js";
import { findNearMatches } from "./typosquat.js";
/** Evaluate an artifact without implying that an absent advisory proves safety. */
export function assessArtifact(feed, query) {
    const byId = new Map();
    for (const match of matchNames(feed, [query.name], {
        ecosystem: query.ecosystem,
        version: query.version,
    })) {
        byId.set(match.advisory.id, {
            id: match.advisory.id,
            severity: match.advisory.severity,
            type: match.advisory.type,
            summary: match.advisory.summary,
            matchedBy: "name",
            references: match.advisory.references.map((reference) => reference.url),
        });
    }
    if (query.sha256) {
        const advisories = new Map(feed.advisories.map((advisory) => [advisory.id, advisory]));
        for (const hashMatch of matchHashes(feed, [query.sha256])) {
            for (const id of hashMatch.advisoryIds) {
                if (byId.has(id))
                    continue;
                const advisory = advisories.get(id);
                if (!advisory)
                    continue;
                byId.set(id, {
                    id,
                    severity: advisory.severity,
                    type: advisory.type,
                    summary: advisory.summary,
                    matchedBy: "sha256",
                    references: advisory.references.map((reference) => reference.url),
                });
            }
        }
    }
    const matches = [...byId.values()];
    const warnings = matches.length === 0
        ? findNearMatches(query.name, collectKnownNames(feed, query.ecosystem)).map(({ name, distance }) => ({ similarTo: name, distance }))
        : [];
    return {
        status: matches.length > 0
            ? "known-risk"
            : warnings.length > 0
                ? "review"
                : "no-known-advisory",
        query,
        matches,
        warnings,
        disclaimer: "No known advisory is not proof of safety. Review provenance, permissions, and source before installation.",
    };
}
export function searchAdvisories(feed, options) {
    const needle = options.query?.trim().toLowerCase();
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    return feed.advisories
        .filter((advisory) => {
        if (options.severity && advisory.severity !== options.severity)
            return false;
        if (options.ecosystem &&
            !advisory.artifacts.some((artifact) => artifact.ecosystem === options.ecosystem)) {
            return false;
        }
        if (!needle)
            return true;
        return [
            advisory.id,
            advisory.summary,
            advisory.details ?? "",
            ...advisory.aliases ?? [],
            ...advisory.artifacts.map((artifact) => artifact.name),
        ].some((value) => value.toLowerCase().includes(needle));
    })
        .slice(0, limit);
}
