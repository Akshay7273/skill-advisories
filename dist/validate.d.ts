import type { LoadedAdvisory } from "./load.js";
export type ValidationProblem = {
    file: string;
    problem: string;
};
/**
 * Validate advisories against the JSON Schema, then enforce repo invariants:
 * filename matches id, ids are unique, modified is not earlier than published.
 */
export declare function validateAdvisories(loaded: LoadedAdvisory[]): Promise<ValidationProblem[]>;
