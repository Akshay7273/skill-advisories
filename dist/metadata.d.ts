import type { Ecosystem } from "./types.js";
export type InstalledSkill = {
    path: string;
    name: string;
    version?: string;
    ecosystem?: Ecosystem;
};
export declare function inferEcosystemFromDirectory(dir: string): Ecosystem | undefined;
export declare function detectSkillMetadata(skillPath: string, fallbackName: string, ecosystem?: Ecosystem): Promise<InstalledSkill>;
