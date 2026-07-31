import { createHash } from "node:crypto";
/** Stable semantic cursor independent of JSON whitespace. */
export function feedCursor(feed) {
    return createHash("sha256").update(JSON.stringify(feed)).digest("hex");
}
export function buildFeedDelta(previous, current) {
    const oldById = new Map(previous.advisories.map((advisory) => [advisory.id, advisory]));
    const currentIds = new Set(current.advisories.map((advisory) => advisory.id));
    return {
        schema_version: "1",
        from: feedCursor(previous),
        to: feedCursor(current),
        generated: current.generated,
        upserts: current.advisories.filter((advisory) => {
            const old = oldById.get(advisory.id);
            return old === undefined || JSON.stringify(old) !== JSON.stringify(advisory);
        }),
        removed: previous.advisories
            .filter((advisory) => !currentIds.has(advisory.id))
            .map((advisory) => advisory.id),
    };
}
export function applyFeedDelta(previous, delta) {
    if (feedCursor(previous) !== delta.from) {
        throw new Error("feed delta cursor does not match the local feed");
    }
    const advisories = new Map(previous.advisories.map((advisory) => [advisory.id, advisory]));
    for (const id of delta.removed)
        advisories.delete(id);
    for (const advisory of delta.upserts)
        advisories.set(advisory.id, advisory);
    const next = {
        ...previous,
        generated: delta.generated,
        advisories: [...advisories.values()].sort((left, right) => left.id.localeCompare(right.id)),
        advisory_count: advisories.size,
    };
    if (feedCursor(next) !== delta.to)
        throw new Error("feed delta result failed cursor verification");
    return next;
}
export function buildCompactFeed(feed) {
    return {
        schema_version: "1",
        generated: feed.generated,
        cursor: feedCursor(feed),
        advisory_count: feed.advisory_count,
        advisories: feed.advisories.map((advisory) => ({
            id: advisory.id,
            type: advisory.type,
            severity: advisory.severity,
            artifacts: advisory.artifacts,
            references: advisory.references,
            ...(advisory.withdrawn ? { withdrawn: advisory.withdrawn } : {}),
        })),
    };
}
