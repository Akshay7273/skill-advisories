import { readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { mapConcurrent, positiveInteger } from "./concurrency.js"
import type { Feed } from "./compile.js"
import { hashSkillDirDetailed } from "./hash.js"
import type { HashOptions, HashStats } from "./hash.js"
import { detectSkillMetadata, inferEcosystemFromDirectory } from "./metadata.js"
import type { InstalledSkill } from "./metadata.js"
import type { Advisory, Ecosystem } from "./types.js"
import { buildArtifactIndex, collectKnownNames, matchHashes, matchNames } from "./lookup.js"
import { findNearMatches } from "./typosquat.js"

/** Known agent skill install locations, relative to the home directory. */
export const KNOWN_SKILL_DIRS = [
  ".claude/skills",
  ".openclaw/skills",
  ".clawdbot/skills",
  ".moltbot/skills",
]

export const DEFAULT_SCAN_CONCURRENCY = 4
export const DEFAULT_METADATA_CONCURRENCY = 8

export function defaultSkillDirs(): string[] {
  return KNOWN_SKILL_DIRS.map((d) => join(homedir(), d))
}

/**
 * List installed skills (subdirectory names) in each existing directory.
 * Missing or unreadable directories are silently skipped.
 */
export async function listInstalledSkills(
  dirs: string[],
  ecosystem?: Ecosystem,
  concurrency: number = DEFAULT_METADATA_CONCURRENCY,
): Promise<Array<{ dir: string; names: string[]; skills: InstalledSkill[] }>> {
  positiveInteger(concurrency, "metadata concurrency")
  const found: Array<{ dir: string; names: string[]; skills: InstalledSkill[] }> = []
  for (const dir of dirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const folders = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
      const inferredEcosystem = ecosystem ?? inferEcosystemFromDirectory(dir)
      const skills = await mapConcurrent(
        folders.map((name) => ({ path: join(dir, name), name })),
        concurrency,
        ({ path, name }) => detectSkillMetadata(path, name, inferredEcosystem),
      )
      found.push({ dir, names: skills.map((skill) => skill.name), skills })
    } catch {
      // directory doesn't exist or is unreadable; skip
    }
  }
  return found
}

export type ScanMatch = {
  query: string
  advisory: Advisory
  artifactNames: string[]
  artifactEcosystems: Ecosystem[]
  version?: string
  matchedBy: "name" | "sha256"
  file?: string
  sha256?: string
}

export type ScanWarning = {
  name: string
  similarTo: string
  distance: number
}

export type ScanResult = {
  installed: Array<{ dir: string; names: string[]; skills: InstalledSkill[] }>
  scannedCount: number
  matches: ScanMatch[]
  warnings: ScanWarning[]
  stats: ScanStats
}

export type ScanStats = HashStats & {
  artifactsWithExhaustedBudgets: number
}

export type ScanOptions = {
  ecosystem?: Ecosystem
  concurrency?: number
  metadataConcurrency?: number
  hash?: HashOptions
}

export async function scanSkills(
  dirs: string[],
  feed: Feed,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const concurrency = positiveInteger(
    options.concurrency ?? DEFAULT_SCAN_CONCURRENCY,
    "scan concurrency",
  )
  const installed = await listInstalledSkills(
    dirs,
    options.ecosystem,
    options.metadataConcurrency ?? DEFAULT_METADATA_CONCURRENCY,
  )
  const knownNames = collectKnownNames(feed)
  const artifactIndex = buildArtifactIndex(feed)
  const advisoryMap = new Map<string, Advisory>()
  for (const adv of feed.advisories) {
    advisoryMap.set(adv.id, adv)
  }

  const skills = installed.flatMap((group) => group.skills)
  const artifactResults = await mapConcurrent(skills, concurrency, async (skill) => {
      const { name, version, ecosystem } = skill
      const skillPath = skill.path
      const matches: ScanMatch[] = []
      const warnings: ScanWarning[] = []
      let matchedInSkill = false
      const matchedAdvisoryIds = new Set<string>()

      // 1. Name match
      const nameHits = matchNames(feed, [name], {
        index: artifactIndex,
        ecosystem,
        version,
      })
      for (const nh of nameHits) {
        matchedInSkill = true
        matchedAdvisoryIds.add(nh.advisory.id)
        matches.push({
          query: name,
          advisory: nh.advisory,
          artifactNames: nh.artifactNames,
          artifactEcosystems: nh.artifactEcosystems,
          version,
          matchedBy: "name",
        })
      }

      // 2. Hash match
      const hashResult = await hashSkillDirDetailed(skillPath, options.hash)
      const hashedFiles = hashResult.files
      const hashHits = matchHashes(
        feed,
        hashedFiles.map((h) => h.sha256),
      )

      for (const hh of hashHits) {
        const matchingFile = hashedFiles.find((hf) => hf.sha256 === hh.sha256)
        for (const advId of hh.advisoryIds) {
          if (!matchedAdvisoryIds.has(advId)) {
            matchedInSkill = true
            matchedAdvisoryIds.add(advId)
            const adv = advisoryMap.get(advId)
            if (adv) {
              matches.push({
                query: name,
                advisory: adv,
                artifactNames: adv.artifacts.map((a) => a.name),
                artifactEcosystems: [...new Set(adv.artifacts.map((a) => a.ecosystem))],
                version,
                matchedBy: "sha256",
                file: matchingFile?.file,
                sha256: hh.sha256,
              })
            }
          }
        }
      }

      // 3. Typosquat check if no real match
      if (!matchedInSkill) {
        const near = findNearMatches(name, knownNames)
        for (const nm of near) {
          warnings.push({
            name,
            similarTo: nm.name,
            distance: nm.distance,
          })
        }
      }
      return { matches, warnings, hashStats: hashResult.stats }
  })

  const matches = artifactResults.flatMap((result) => result.matches)
  const warnings = artifactResults.flatMap((result) => result.warnings)
  const stats: ScanStats = {
    discoveredFiles: 0,
    hashedFiles: 0,
    hashedBytes: 0,
    skippedLargeFiles: 0,
    skippedBudgetFiles: 0,
    skippedSymlinks: 0,
    skippedExcludedDirectories: 0,
    unreadableEntries: 0,
    budgetExhausted: false,
    artifactsWithExhaustedBudgets: 0,
  }
  for (const result of artifactResults) {
    const hashStats = result.hashStats
    stats.discoveredFiles += hashStats.discoveredFiles
    stats.hashedFiles += hashStats.hashedFiles
    stats.hashedBytes += hashStats.hashedBytes
    stats.skippedLargeFiles += hashStats.skippedLargeFiles
    stats.skippedBudgetFiles += hashStats.skippedBudgetFiles
    stats.skippedSymlinks += hashStats.skippedSymlinks
    stats.skippedExcludedDirectories += hashStats.skippedExcludedDirectories
    stats.unreadableEntries += hashStats.unreadableEntries
    if (hashStats.budgetExhausted) {
      stats.budgetExhausted = true
      stats.artifactsWithExhaustedBudgets++
    }
  }

  return { installed, scannedCount: skills.length, matches, warnings, stats }
}
