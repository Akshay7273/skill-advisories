import type { Advisory, Ecosystem, Reference } from "./types.js";
export type OsvAdvisory = {
    id: string;
    aliases?: string[];
    summary: string;
    details?: string;
    published: string;
    modified: string;
    withdrawn?: string;
    affected: Array<{
        package: {
            ecosystem: string;
            name: string;
        };
        versions?: string[];
        database_specific: {
            native_ecosystem: Ecosystem;
            publisher?: string;
            sha256?: string[];
        };
    }>;
    references: Reference[];
    database_specific: {
        type: Advisory["type"];
        severity: Advisory["severity"];
        behaviors?: Advisory["behaviors"];
        credits?: string[];
        source: string;
    };
};
/** Convert a native SKA advisory into an OSV-compatible record. */
export declare function toOsv(advisory: Advisory): OsvAdvisory;
