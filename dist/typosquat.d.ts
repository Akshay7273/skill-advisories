/**
 * Bounded Levenshtein distance. Returns Infinity when the distance
 * exceeds `max`, letting callers early-exit cheaply.
 */
export declare function levenshtein(a: string, b: string, max: number): number;
export type NearMatch = {
    name: string;
    distance: number;
};
/**
 * Distance budget by name length. Short names produce meaningless
 * proximity noise, so they are excluded entirely.
 */
export declare function maxDistanceForLength(length: number): number;
/**
 * Find known-bad names that are suspiciously close to `candidate`.
 * Exact matches are excluded — those are real matches, not typosquats.
 * Case-insensitive.
 */
export declare function findNearMatches(candidate: string, knownNames: Iterable<string>): NearMatch[];
