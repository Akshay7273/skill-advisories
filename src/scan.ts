import { readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Feed } from "./compile.js"
import { hashSkillDir } from "./hash.js"
import type { Advisory } from "./types.js"
import { collectKnownNames, matchHashes, matchNames } from "./lookup.js"
import { findNearMatches } from "./typosquat.js"

/** Known agent skill install locations, relative to the home directory. */
export const KNOWN_SKILL_DIRS = [
  ".claude/skills",
  ".openclaw/skills",
  ".clawdbot/skills",
  ".moltbot/skills",
]

export function defaultSkillDirs(): string[] {
  return KNOWN_SKILL_DIRS.map((d) => join(homedir(), d))
}

/**
 * List installed skills (subdirectory names) in each existing directory.
 * Missing or unreadable directories are silently skipped.
 */
export async function listInstalledSkills(
  dirs: string[],
): Promise<Array<{ dir: string; names: string[] }>> {
  const found: Array<{ dir: string; names: string[] }> = []
  for (const dir of dirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const names = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
      found.push({ dir, names })
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
  installed: Array<{ dir: string; names: string[] }>
  scannedCount: number
  matches: ScanMatch[]
  warnings: ScanWarning[]
}

export async function scanSkills(dirs: string[], feed: Feed): Promise<ScanResult> {
  const installed = await listInstalledSkills(dirs)
  const knownNames = collectKnownNames(feed)
  const matches: ScanMatch[] = []
  const warnings: ScanWarning[] = []
  const advisoryMap = new Map<string, Advisory>()
  for (const adv of feed.advisories) {
    advisoryMap.set(adv.id, adv)
  }

  let scannedCount = 0

  for (const group of installed) {
    for (const name of group.names) {
      scannedCount++
      const skillPath = join(group.dir, name)
      let matchedInSkill = false
      const matchedAdvisoryIds = new Set<string>()

      // 1. Name match
      const nameHits = matchNames(feed, [name])
      for (const nh of nameHits) {
        matchedInSkill = true
        matchedAdvisoryIds.add(nh.advisory.id)
        matches.push({
          query: name,
          advisory: nh.advisory,
          artifactNames: nh.artifactNames,
          matchedBy: "name",
        })
      }

      // 2. Hash match
      const hashedFiles = await hashSkillDir(skillPath)
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
    }
  }

  return { installed, scannedCount, matches, warnings }
}
