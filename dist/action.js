#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS({
  "node_modules/picocolors/picocolors.js"(exports, module) {
    var p = process || {};
    var argv = p.argv || [];
    var env = p.env || {};
    var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
    var formatter = (open, close, replace = open) => (input) => {
      let string = "" + input, index = string.indexOf(close, open.length);
      return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
    };
    var replaceClose = (string, close, replace, index) => {
      let result = "", cursor = 0;
      do {
        result += string.substring(cursor, index) + replace;
        cursor = index + close.length;
        index = string.indexOf(close, cursor);
      } while (~index);
      return result + string.substring(cursor);
    };
    var createColors = (enabled = isColorSupported) => {
      let f = enabled ? formatter : () => String;
      return {
        isColorSupported: enabled,
        reset: f("\x1B[0m", "\x1B[0m"),
        bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
        dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
        italic: f("\x1B[3m", "\x1B[23m"),
        underline: f("\x1B[4m", "\x1B[24m"),
        inverse: f("\x1B[7m", "\x1B[27m"),
        hidden: f("\x1B[8m", "\x1B[28m"),
        strikethrough: f("\x1B[9m", "\x1B[29m"),
        black: f("\x1B[30m", "\x1B[39m"),
        red: f("\x1B[31m", "\x1B[39m"),
        green: f("\x1B[32m", "\x1B[39m"),
        yellow: f("\x1B[33m", "\x1B[39m"),
        blue: f("\x1B[34m", "\x1B[39m"),
        magenta: f("\x1B[35m", "\x1B[39m"),
        cyan: f("\x1B[36m", "\x1B[39m"),
        white: f("\x1B[37m", "\x1B[39m"),
        gray: f("\x1B[90m", "\x1B[39m"),
        bgBlack: f("\x1B[40m", "\x1B[49m"),
        bgRed: f("\x1B[41m", "\x1B[49m"),
        bgGreen: f("\x1B[42m", "\x1B[49m"),
        bgYellow: f("\x1B[43m", "\x1B[49m"),
        bgBlue: f("\x1B[44m", "\x1B[49m"),
        bgMagenta: f("\x1B[45m", "\x1B[49m"),
        bgCyan: f("\x1B[46m", "\x1B[49m"),
        bgWhite: f("\x1B[47m", "\x1B[49m"),
        blackBright: f("\x1B[90m", "\x1B[39m"),
        redBright: f("\x1B[91m", "\x1B[39m"),
        greenBright: f("\x1B[92m", "\x1B[39m"),
        yellowBright: f("\x1B[93m", "\x1B[39m"),
        blueBright: f("\x1B[94m", "\x1B[39m"),
        magentaBright: f("\x1B[95m", "\x1B[39m"),
        cyanBright: f("\x1B[96m", "\x1B[39m"),
        whiteBright: f("\x1B[97m", "\x1B[39m"),
        bgBlackBright: f("\x1B[100m", "\x1B[49m"),
        bgRedBright: f("\x1B[101m", "\x1B[49m"),
        bgGreenBright: f("\x1B[102m", "\x1B[49m"),
        bgYellowBright: f("\x1B[103m", "\x1B[49m"),
        bgBlueBright: f("\x1B[104m", "\x1B[49m"),
        bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
        bgCyanBright: f("\x1B[106m", "\x1B[49m"),
        bgWhiteBright: f("\x1B[107m", "\x1B[49m")
      };
    };
    module.exports = createColors();
    module.exports.createColors = createColors;
  }
});

// src/cli.ts
var import_picocolors2 = __toESM(require_picocolors(), 1);
import { createRequire } from "node:module";

// src/lookup.ts
var import_picocolors = __toESM(require_picocolors(), 1);
import { createHash as createHash2 } from "node:crypto";
import { readFile } from "node:fs/promises";

// src/cache.ts
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
var DEFAULT_TTL_MS = 60 * 60 * 1e3;
function cacheDir() {
  const base = process.env.XDG_CACHE_HOME && process.env.XDG_CACHE_HOME !== "" ? process.env.XDG_CACHE_HOME : path.join(os.homedir(), ".cache");
  return path.join(base, "skill-advisories");
}
function cacheFileFor(feedUrl) {
  const key = createHash("sha256").update(feedUrl).digest("hex").slice(0, 16);
  return path.join(cacheDir(), `feed-${key}.json`);
}
async function readCache(feedUrl) {
  try {
    const raw = await fs.readFile(cacheFileFor(feedUrl), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.fetchedAt !== "number" || typeof parsed.body !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
async function writeCache(feedUrl, body) {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    const entry = { fetchedAt: Date.now(), body };
    await fs.writeFile(cacheFileFor(feedUrl), JSON.stringify(entry));
  } catch {
  }
}
function isFresh(entry, ttlMs = DEFAULT_TTL_MS) {
  return Date.now() - entry.fetchedAt < ttlMs;
}

// src/lookup.ts
var DEFAULT_FEED_URL = "https://raw.githubusercontent.com/Akshay7273/skill-advisories/main/feed/feed.json";
function normalizeVersion(version) {
  return version.trim().replace(/^v(?=\d)/i, "");
}
function artifactAffectsVersion(artifact, version) {
  if (!version || !artifact.versions || artifact.versions.length === 0) return true;
  if (artifact.versions.includes("*")) return true;
  const wanted = normalizeVersion(version);
  return artifact.versions.some((candidate) => normalizeVersion(candidate) === wanted);
}
async function loadFeed(source = DEFAULT_FEED_URL, options = {}) {
  if (!source.startsWith("http://") && !source.startsWith("https://")) {
    return JSON.parse(await readFile(source, "utf8"));
  }
  if (options.offline) {
    const cached = await readCache(source);
    if (!cached) {
      throw new Error(`offline mode: no cached feed available for ${source}`);
    }
    return JSON.parse(cached.body);
  }
  if (!options.refresh) {
    const cached = await readCache(source);
    if (cached && isFresh(cached)) {
      return JSON.parse(cached.body);
    }
  }
  try {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bodyText = await res.text();
    try {
      const digestRes = await fetch(`${source}.sha256`);
      if (digestRes.ok) {
        const digestText = await digestRes.text();
        const expectedHash = digestText.trim().split(/\s+/)[0]?.toLowerCase();
        const actualHash = createHash2("sha256").update(bodyText).digest("hex").toLowerCase();
        if (expectedHash && actualHash !== expectedHash) {
          console.error(
            import_picocolors.default.yellow(
              "\u26A0 feed digest mismatch \u2014 feed may be tampered with or mid-update"
            )
          );
          if (options.strict) {
            throw new Error("feed digest mismatch (strict mode)");
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("strict mode")) {
        throw err;
      }
    }
    await writeCache(source, bodyText);
    return JSON.parse(bodyText);
  } catch (err) {
    if (err instanceof Error && err.message.includes("strict mode")) {
      throw err;
    }
    const fallback = await readCache(source);
    if (fallback) {
      const dateStr = new Date(fallback.fetchedAt).toISOString();
      console.error(
        import_picocolors.default.yellow(`\u26A0 network unavailable \u2014 using cached feed from ${dateStr}`)
      );
      return JSON.parse(fallback.body);
    }
    throw new Error(`failed to fetch feed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function appendIndexEntry(index, key, entry) {
  const entries = index.get(key) ?? [];
  entries.push(entry);
  index.set(key, entries);
}
function buildArtifactIndex(feed) {
  const byName = /* @__PURE__ */ new Map();
  const byEcosystemAndName = /* @__PURE__ */ new Map();
  for (const advisory of feed.advisories) {
    if (advisory.withdrawn) continue;
    for (const artifact of advisory.artifacts) {
      const normalizedName = artifact.name.toLowerCase();
      const entry = { advisory, artifact };
      appendIndexEntry(byName, normalizedName, entry);
      appendIndexEntry(
        byEcosystemAndName,
        `${artifact.ecosystem}:${normalizedName}`,
        entry
      );
    }
  }
  return { byName, byEcosystemAndName };
}
function matchNames(feed, names, options = {}) {
  const index = options.index ?? buildArtifactIndex(feed);
  const matches = [];
  for (const query of names) {
    const q = query.toLowerCase();
    const entries = options.ecosystem ? index.byEcosystemAndName.get(`${options.ecosystem}:${q}`) ?? [] : index.byName.get(q) ?? [];
    const grouped = /* @__PURE__ */ new Map();
    for (const { advisory, artifact } of entries) {
      if (!artifactAffectsVersion(artifact, options.version)) continue;
      const group = grouped.get(advisory.id) ?? {
        advisory,
        names: /* @__PURE__ */ new Set(),
        ecosystems: /* @__PURE__ */ new Set()
      };
      group.names.add(artifact.name);
      group.ecosystems.add(artifact.ecosystem);
      grouped.set(advisory.id, group);
    }
    for (const group of grouped.values()) {
      matches.push({
        query,
        advisory: group.advisory,
        artifactNames: [...group.names],
        artifactEcosystems: [...group.ecosystems],
        version: options.version
      });
    }
  }
  return matches;
}
function collectKnownNames(feed, ecosystem) {
  const names = /* @__PURE__ */ new Set();
  for (const adv of feed.advisories) {
    if (adv.withdrawn) continue;
    for (const art of adv.artifacts) {
      if (!ecosystem || art.ecosystem === ecosystem) names.add(art.name);
    }
  }
  return [...names];
}
function matchHashes(feed, hashes) {
  const wanted = /* @__PURE__ */ new Map();
  for (const adv of feed.advisories) {
    if (adv.withdrawn) continue;
    for (const art of adv.artifacts) {
      for (const h of art.sha256 ?? []) {
        const key = h.toLowerCase();
        const ids = wanted.get(key) ?? [];
        if (!ids.includes(adv.id)) ids.push(adv.id);
        wanted.set(key, ids);
      }
    }
  }
  const out = [];
  for (const h of hashes) {
    const ids = wanted.get(h.toLowerCase());
    if (ids) out.push({ sha256: h.toLowerCase(), advisoryIds: ids });
  }
  return out;
}

// src/types.ts
var ECOSYSTEMS = [
  "claude-skill",
  "claude-plugin",
  "clawhub",
  "mcp-server",
  "npm",
  "pypi",
  "vscode-extension",
  "github-action"
];

// src/scan.ts
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// src/hash.ts
import { createHash as createHash3 } from "node:crypto";
import { promises as fs2 } from "node:fs";
import path2 from "node:path";
var MAX_HASHABLE_FILE_BYTES = 10 * 1024 * 1024;
async function sha256File(filePath) {
  const data = await fs2.readFile(filePath);
  return createHash3("sha256").update(data).digest("hex");
}
async function hashSkillDir(dir) {
  const out = [];
  async function walk(current) {
    let entries;
    try {
      entries = await fs2.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path2.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const stat = await fs2.stat(full);
          if (stat.size > MAX_HASHABLE_FILE_BYTES) continue;
          out.push({
            file: path2.relative(dir, full),
            sha256: await sha256File(full)
          });
        } catch {
        }
      }
    }
  }
  await walk(dir);
  return out;
}

// src/metadata.ts
import { readFile as readFile2 } from "node:fs/promises";
import path3 from "node:path";
function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
async function readPackageMetadata(skillPath) {
  try {
    const parsed = JSON.parse(await readFile2(path3.join(skillPath, "package.json"), "utf8"));
    return {
      name: nonEmptyString(parsed.name),
      version: nonEmptyString(parsed.version)
    };
  } catch {
    return {};
  }
}
async function readSkillFrontmatter(skillPath) {
  try {
    const contents = await readFile2(path3.join(skillPath, "SKILL.md"), "utf8");
    const frontmatter = contents.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    if (!frontmatter) return {};
    const fields = {};
    for (const line of frontmatter.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z][\w-]*):\s*(.*?)\s*$/);
      if (!match) continue;
      fields[match[1].toLowerCase()] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
    return {
      name: nonEmptyString(fields.name),
      version: nonEmptyString(fields.version)
    };
  } catch {
    return {};
  }
}
function inferEcosystemFromDirectory(dir) {
  const normalized = dir.replaceAll("\\", "/").toLowerCase().replace(/\/$/, "");
  if (normalized.endsWith("/.claude/skills")) return "claude-skill";
  if (normalized.endsWith("/.openclaw/skills") || normalized.endsWith("/.clawdbot/skills") || normalized.endsWith("/.moltbot/skills")) {
    return "clawhub";
  }
  return void 0;
}
async function detectSkillMetadata(skillPath, fallbackName, ecosystem) {
  const [skill, pkg] = await Promise.all([
    readSkillFrontmatter(skillPath),
    readPackageMetadata(skillPath)
  ]);
  return {
    path: skillPath,
    name: skill.name ?? pkg.name ?? fallbackName,
    version: skill.version ?? pkg.version,
    ecosystem
  };
}

// src/typosquat.ts
function levenshtein(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return Infinity;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n <= max ? n : Infinity;
  if (n === 0) return m <= max ? m : Infinity;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return Infinity;
    [prev, curr] = [curr, prev];
  }
  return prev[n] <= max ? prev[n] : Infinity;
}
function maxDistanceForLength(length) {
  if (length < 5) return 0;
  if (length <= 7) return 1;
  return 2;
}
function findNearMatches(candidate, knownNames) {
  const c = candidate.toLowerCase();
  const results = [];
  for (const known of knownNames) {
    const k = known.toLowerCase();
    if (k === c) continue;
    const max = maxDistanceForLength(Math.max(k.length, c.length));
    if (max === 0) continue;
    const d = levenshtein(c, k, max);
    if (d !== Infinity && d >= 1 && d <= max) {
      results.push({ name: known, distance: d });
    }
  }
  return results.sort((x, y) => x.distance - y.distance);
}

// src/scan.ts
var KNOWN_SKILL_DIRS = [
  ".claude/skills",
  ".openclaw/skills",
  ".clawdbot/skills",
  ".moltbot/skills"
];
function defaultSkillDirs() {
  return KNOWN_SKILL_DIRS.map((d) => join(homedir(), d));
}
async function listInstalledSkills(dirs, ecosystem) {
  const found = [];
  for (const dir of dirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
      const inferredEcosystem = ecosystem ?? inferEcosystemFromDirectory(dir);
      const skills = await Promise.all(
        folders.map(
          (name) => detectSkillMetadata(join(dir, name), name, inferredEcosystem)
        )
      );
      found.push({ dir, names: skills.map((skill) => skill.name), skills });
    } catch {
    }
  }
  return found;
}
async function scanSkills(dirs, feed, options = {}) {
  const installed = await listInstalledSkills(dirs, options.ecosystem);
  const knownNames = collectKnownNames(feed);
  const artifactIndex = buildArtifactIndex(feed);
  const matches = [];
  const warnings = [];
  const advisoryMap = /* @__PURE__ */ new Map();
  for (const adv of feed.advisories) {
    advisoryMap.set(adv.id, adv);
  }
  let scannedCount = 0;
  for (const group of installed) {
    for (const skill of group.skills) {
      const { name, version, ecosystem } = skill;
      scannedCount++;
      const skillPath = join(group.dir, name);
      let matchedInSkill = false;
      const matchedAdvisoryIds = /* @__PURE__ */ new Set();
      const nameHits = matchNames(feed, [name], {
        index: artifactIndex,
        ecosystem,
        version
      });
      for (const nh of nameHits) {
        matchedInSkill = true;
        matchedAdvisoryIds.add(nh.advisory.id);
        matches.push({
          query: name,
          advisory: nh.advisory,
          artifactNames: nh.artifactNames,
          artifactEcosystems: nh.artifactEcosystems,
          version,
          matchedBy: "name"
        });
      }
      const hashedFiles = await hashSkillDir(skillPath);
      const hashHits = matchHashes(
        feed,
        hashedFiles.map((h) => h.sha256)
      );
      for (const hh of hashHits) {
        const matchingFile = hashedFiles.find((hf) => hf.sha256 === hh.sha256);
        for (const advId of hh.advisoryIds) {
          if (!matchedAdvisoryIds.has(advId)) {
            matchedInSkill = true;
            matchedAdvisoryIds.add(advId);
            const adv = advisoryMap.get(advId);
            if (adv) {
              matches.push({
                query: name,
                advisory: adv,
                artifactNames: adv.artifacts.map((a) => a.name),
                artifactEcosystems: [...new Set(adv.artifacts.map((a) => a.ecosystem))],
                version,
                matchedBy: "sha256",
                file: matchingFile?.file,
                sha256: hh.sha256
              });
            }
          }
        }
      }
      if (!matchedInSkill) {
        const near = findNearMatches(name, knownNames);
        for (const nm of near) {
          warnings.push({
            name,
            similarTo: nm.name,
            distance: nm.distance
          });
        }
      }
    }
  }
  return { installed, scannedCount, matches, warnings };
}

// src/sarif.ts
function severityToLevel(severity) {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    default:
      return "note";
  }
}
function buildSarif(findings, toolVersion) {
  const rules = /* @__PURE__ */ new Map();
  for (const f of findings) {
    if (!rules.has(f.advisoryId)) {
      rules.set(f.advisoryId, {
        id: f.advisoryId,
        shortDescription: { text: f.summary },
        helpUri: "https://github.com/Akshay7273/skill-advisories"
      });
    }
  }
  return {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "skill-advisories",
            informationUri: "https://github.com/Akshay7273/skill-advisories",
            version: toolVersion,
            rules: [...rules.values()]
          }
        },
        results: findings.map((f) => ({
          ruleId: f.advisoryId,
          level: severityToLevel(f.severity),
          message: {
            text: `${f.artifactName} matches ${f.advisoryId} (matched by ${f.matchedBy}): ${f.summary}`
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.file ?? f.artifactName }
              }
            }
          ]
        }))
      }
    ]
  };
}
var SEVERITY_ORDER = ["low", "medium", "high", "critical"];
function meetsThreshold(severity, failOn) {
  const s = SEVERITY_ORDER.indexOf(severity);
  const t = SEVERITY_ORDER.indexOf(failOn);
  if (s === -1 || t === -1) return true;
  return s >= t;
}

// src/cli.ts
var VERSION = createRequire(import.meta.url)("../package.json").version;
var HELP = `skill-advisories ${VERSION} \u2014 open advisory database for AI agent skills

Usage:
  skill-advisories check <name...>   Check skill names against the advisory feed
  skill-advisories check --sha256 <hash...>  Check SHA-256 file hashes against the advisory feed
  skill-advisories scan [dir...]     Scan installed skill directories (defaults to known locations)

Options:
  --format <format> Output format: human, json, or sarif (default: human)
  --json           Alias for --format json
  --fail-on <sev>  Minimum severity to trigger exit code 1: low, medium, high, critical
  --feed <source>  Feed URL or local file path (default: official feed)
  --ecosystem <id> Restrict name checks to one artifact ecosystem
  --version <value> Restrict name checks to an installed artifact version
  --sha256         Treat positional arguments as SHA-256 hashes
  --strict         Exit code 1 on typosquat warnings even if no exact match is found
  --offline        Use cached feed only; fail if cache is missing
  --refresh        Ignore cached feed; force network download
  --help, -h       Show this help
  --version, -v    Show version

Exit codes: 0 = no advisories matched (or below threshold), 1 = matches found (or warnings with --strict), 2 = usage or feed error`;
function fail(message) {
  console.error(import_picocolors2.default.red(`error: ${message}`));
  process.exit(2);
}
function parseArgs(argv) {
  const positionals = [];
  let format = "human";
  let feed = DEFAULT_FEED_URL;
  let sha256 = false;
  let strict = false;
  let offline = false;
  let refresh = false;
  let ecosystem = void 0;
  let version = void 0;
  let failOn = void 0;
  const VALID_FORMATS = ["human", "json", "sarif"];
  const VALID_SEVERITIES = ["low", "medium", "high", "critical"];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      format = "json";
    } else if (arg === "--format") {
      i++;
      const value = argv[i];
      if (!value || !VALID_FORMATS.includes(value)) {
        fail(`invalid format "${value ?? ""}", expected human, json, or sarif`);
      }
      format = value;
    } else if (arg === "--fail-on") {
      i++;
      const value = argv[i];
      if (!value || !VALID_SEVERITIES.includes(value.toLowerCase())) {
        fail(`invalid severity threshold "${value ?? ""}", expected low, medium, high, or critical`);
      }
      failOn = value.toLowerCase();
    } else if (arg === "--feed") {
      i++;
      const value = argv[i];
      if (!value) fail("--feed requires a value");
      feed = value;
    } else if (arg === "--ecosystem") {
      i++;
      const value = argv[i];
      if (!value || !ECOSYSTEMS.includes(value)) {
        fail(`invalid ecosystem "${value ?? ""}", expected one of: ${ECOSYSTEMS.join(", ")}`);
      }
      ecosystem = value;
    } else if (arg === "--version") {
      i++;
      const value = argv[i];
      if (!value || value.trim() === "") fail("--version requires a value");
      version = value.trim();
    } else if (arg === "--sha256") {
      sha256 = true;
    } else if (arg === "--strict") {
      strict = true;
    } else if (arg === "--offline") {
      offline = true;
    } else if (arg === "--refresh") {
      refresh = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    } else if (arg === "--version" || arg === "-v") {
      console.log(VERSION);
      process.exit(0);
    } else if (arg.startsWith("--")) {
      fail(`unknown option "${arg}"`);
    } else {
      positionals.push(arg);
    }
  }
  if (offline && refresh) {
    fail("--offline and --refresh are mutually exclusive");
  }
  const [command, ...rest] = positionals;
  return {
    command,
    positionals: rest,
    format,
    feed,
    sha256,
    strict,
    offline,
    refresh,
    ecosystem,
    version,
    failOn
  };
}
async function loadFeedOrFail(source, options) {
  try {
    return await loadFeed(source, options);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}
function report(checked, matches, warnings, format, strict, failOn) {
  if (format === "sarif") {
    const findings = matches.map((m) => ({
      advisoryId: m.advisory.id,
      severity: m.advisory.severity,
      summary: m.advisory.summary,
      artifactName: m.query,
      matchedBy: m.matchedBy,
      file: m.file
    }));
    console.log(JSON.stringify(buildSarif(findings, VERSION), null, 2));
  } else if (format === "json") {
    console.log(
      JSON.stringify(
        {
          schemaVersion: "1",
          checked,
          matchCount: matches.length,
          matches: matches.map((m) => {
            const item = {
              query: m.query,
              id: m.advisory.id,
              type: m.advisory.type,
              severity: m.advisory.severity,
              ecosystems: m.artifactEcosystems,
              ...m.version ? { version: m.version } : {},
              summary: m.advisory.summary,
              references: m.advisory.references.map((r) => r.url)
            };
            if (m.matchedBy) item.matchedBy = m.matchedBy;
            if (m.file) item.file = m.file;
            if (m.sha256) item.sha256 = m.sha256;
            return item;
          }),
          warnings: warnings.map((w) => ({
            name: w.name,
            similarTo: w.similarTo,
            distance: w.distance
          }))
        },
        null,
        2
      )
    );
  } else {
    for (const w of warnings) {
      console.error(
        import_picocolors2.default.yellow(
          `\u26A0 possible typosquat: "${w.name}" is ${w.distance} edit(s) away from known-bad "${w.similarTo}"`
        )
      );
    }
    if (matches.length === 0) {
      console.log(import_picocolors2.default.green(`\u2705 ${checked} skill(s) checked \u2014 no advisories matched`));
    } else {
      console.log(
        import_picocolors2.default.red(
          `\u274C ${matches.length} advisory match(es) across ${checked} skill(s) checked:`
        )
      );
      for (const m of matches) {
        const identityDetail = `${m.version ? `@${m.version}` : ""} [${m.artifactEcosystems.join(", ")}]`;
        const matchedDetail = m.matchedBy === "sha256" ? ` (file hash ${m.file ? `${m.file}: ` : ""}${m.sha256})` : "";
        console.log(
          `  ${import_picocolors2.default.bold(m.query)}${identityDetail} \u2192 ${m.advisory.id} [${m.advisory.severity}] ${m.advisory.summary}${matchedDetail}`
        );
        for (const ref of m.advisory.references) {
          console.log(`      ${ref.url}`);
        }
      }
    }
  }
  let triggerFailure = false;
  if (failOn) {
    triggerFailure = matches.some((m) => meetsThreshold(m.advisory.severity, failOn));
  } else {
    triggerFailure = matches.length > 0;
  }
  const hasWarnings = warnings.length > 0;
  process.exitCode = triggerFailure || strict && hasWarnings ? 1 : 0;
}
var args = parseArgs(process.argv.slice(2));
if (!args.command) {
  console.log(HELP);
  process.exit(2);
}
var feedOptions = { offline: args.offline, refresh: args.refresh, strict: args.strict };
if (args.command === "check") {
  if (args.positionals.length === 0) fail("check requires at least one skill name or hash");
  const feed = await loadFeedOrFail(args.feed, feedOptions);
  if (args.sha256) {
    if (args.ecosystem) fail("--ecosystem cannot be combined with --sha256");
    if (args.version) fail("--version cannot be combined with --sha256");
    for (const h of args.positionals) {
      if (!/^[0-9a-fA-F]{64}$/.test(h)) {
        fail(`invalid SHA-256 hash "${h}"`);
      }
    }
    const hashHits = matchHashes(feed, args.positionals);
    const advisoryMap = /* @__PURE__ */ new Map();
    for (const adv of feed.advisories) advisoryMap.set(adv.id, adv);
    const matches = [];
    for (const hh of hashHits) {
      for (const advId of hh.advisoryIds) {
        const adv = advisoryMap.get(advId);
        if (adv) {
          matches.push({
            query: hh.sha256,
            advisory: adv,
            artifactNames: adv.artifacts.map((a) => a.name),
            artifactEcosystems: [...new Set(adv.artifacts.map((a) => a.ecosystem))],
            matchedBy: "sha256",
            sha256: hh.sha256
          });
        }
      }
    }
    report(args.positionals.length, matches, [], args.format, args.strict, args.failOn);
  } else {
    const nameHits = matchNames(feed, args.positionals, {
      ecosystem: args.ecosystem,
      version: args.version
    });
    const matches = nameHits.map((nh) => ({
      query: nh.query,
      advisory: nh.advisory,
      artifactNames: nh.artifactNames,
      artifactEcosystems: nh.artifactEcosystems,
      version: nh.version,
      matchedBy: "name"
    }));
    const matchedQueries = new Set(matches.map((m) => m.query.toLowerCase()));
    const knownNames = collectKnownNames(feed, args.ecosystem);
    const warnings = [];
    for (const q of args.positionals) {
      if (!matchedQueries.has(q.toLowerCase())) {
        const near = findNearMatches(q, knownNames);
        for (const nm of near) {
          warnings.push({
            name: q,
            similarTo: nm.name,
            distance: nm.distance
          });
        }
      }
    }
    report(args.positionals.length, matches, warnings, args.format, args.strict, args.failOn);
  }
} else if (args.command === "scan") {
  if (args.version) fail("--version is only supported by the check command");
  const dirs = args.positionals.length > 0 ? args.positionals : defaultSkillDirs();
  const feed = await loadFeedOrFail(args.feed, feedOptions);
  const result = await scanSkills(dirs, feed, { ecosystem: args.ecosystem });
  if (args.format === "human") {
    for (const d of result.installed) {
      console.log(import_picocolors2.default.dim(`scanning ${d.dir} (${d.names.length} skills)`));
    }
    if (result.installed.length === 0) {
      console.log(import_picocolors2.default.yellow("no skill directories found"));
    }
  }
  report(result.scannedCount, result.matches, result.warnings, args.format, args.strict, args.failOn);
} else {
  fail(`unknown command "${args.command}"`);
}
