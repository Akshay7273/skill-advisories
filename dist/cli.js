#!/usr/bin/env node
import { createRequire } from "node:module";
import pc from "picocolors";
import { DEFAULT_FEED_URL, loadFeed, matchNames } from "./lookup.js";
import { defaultSkillDirs, listInstalledSkills } from "./scan.js";
const VERSION = createRequire(import.meta.url)("../package.json").version;
const HELP = `skill-advisories ${VERSION} — open advisory database for AI agent skills

Usage:
  skill-advisories check <name...>   Check skill names against the advisory feed
  skill-advisories scan [dir...]     Scan installed skill directories (defaults to known locations)

Options:
  --json           Machine-readable JSON output
  --feed <source>  Feed URL or local file path (default: official feed)
  --help, -h       Show this help
  --version, -v    Show version

Exit codes: 0 = no advisories matched, 1 = matches found, 2 = usage or feed error`;
function fail(message) {
    console.error(pc.red(`error: ${message}`));
    process.exit(2);
}
function parseArgs(argv) {
    const positionals = [];
    let json = false;
    let feed = DEFAULT_FEED_URL;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--json") {
            json = true;
        }
        else if (arg === "--feed") {
            i++;
            const value = argv[i];
            if (!value)
                fail("--feed requires a value");
            feed = value;
        }
        else if (arg === "--help" || arg === "-h") {
            console.log(HELP);
            process.exit(0);
        }
        else if (arg === "--version" || arg === "-v") {
            console.log(VERSION);
            process.exit(0);
        }
        else if (arg.startsWith("--")) {
            fail(`unknown option "${arg}"`);
        }
        else {
            positionals.push(arg);
        }
    }
    const [command, ...rest] = positionals;
    return { command, positionals: rest, json, feed };
}
async function loadFeedOrFail(source) {
    try {
        return await loadFeed(source);
    }
    catch (err) {
        fail(err instanceof Error ? err.message : String(err));
    }
}
function report(checked, matches, json) {
    if (json) {
        console.log(JSON.stringify({
            checked,
            matchCount: matches.length,
            matches: matches.map((m) => ({
                query: m.query,
                id: m.advisory.id,
                type: m.advisory.type,
                severity: m.advisory.severity,
                summary: m.advisory.summary,
                references: m.advisory.references.map((r) => r.url),
            })),
        }, null, 2));
    }
    else if (matches.length === 0) {
        console.log(pc.green(`\u2705 ${checked} skill(s) checked \u2014 no advisories matched`));
    }
    else {
        console.log(pc.red(`\u274c ${matches.length} advisory match(es) across ${checked} skill(s) checked:`));
        for (const m of matches) {
            console.log(`  ${pc.bold(m.query)} \u2192 ${m.advisory.id} [${m.advisory.severity}] ${m.advisory.summary}`);
            for (const ref of m.advisory.references) {
                console.log(`      ${ref.url}`);
            }
        }
    }
    process.exitCode = matches.length > 0 ? 1 : 0;
}
const args = parseArgs(process.argv.slice(2));
if (!args.command) {
    console.log(HELP);
    process.exit(2);
}
if (args.command === "check") {
    if (args.positionals.length === 0)
        fail("check requires at least one skill name");
    const feed = await loadFeedOrFail(args.feed);
    report(args.positionals.length, matchNames(feed, args.positionals), args.json);
}
else if (args.command === "scan") {
    const dirs = args.positionals.length > 0 ? args.positionals : defaultSkillDirs();
    const installed = await listInstalledSkills(dirs);
    const names = installed.flatMap((d) => d.names);
    if (!args.json) {
        for (const d of installed) {
            console.log(pc.dim(`scanning ${d.dir} (${d.names.length} skills)`));
        }
        if (installed.length === 0) {
            console.log(pc.yellow("no skill directories found"));
        }
    }
    const feed = await loadFeedOrFail(args.feed);
    report(names.length, matchNames(feed, names), args.json);
}
else {
    fail(`unknown command "${args.command}"`);
}
