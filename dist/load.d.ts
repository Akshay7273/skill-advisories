import type { Advisory } from "./types.js";
export type LoadedAdvisory = {
    file: string;
    advisory: Advisory;
};
/**
 * Load every .json advisory in a directory (sorted by filename).
 * Throws on unparseable JSON.
 */
export declare function loadAdvisories(dir: string): Promise<LoadedAdvisory[]>;
