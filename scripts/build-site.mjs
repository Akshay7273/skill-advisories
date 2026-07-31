import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const feed = JSON.parse(await readFile("feed/feed.json", "utf8"))
const checksumManifest = await readFile("feed/checksums.txt", "utf8")
const outDir = "site"
await mkdir(path.join(outDir, "advisory"), { recursive: true })

const checksumEntries = checksumManifest
	.trim()
	.split("\n")
	.map((line) => {
		const match = line.match(/^([a-f0-9]{64})  (.+)$/)
		if (!match || path.isAbsolute(match[2]) || match[2].split(/[\\/]/).includes("..")) {
			throw new Error(`invalid checksum manifest entry: ${line}`)
		}
		return { expected: match[1], file: match[2] }
	})
const checksumResults = await Promise.all(
	checksumEntries.map(async ({ expected, file }) => {
		const actual = createHash("sha256")
			.update(await readFile(path.join("feed", file)))
			.digest("hex")
		return { file, valid: actual === expected, expected, actual }
	}),
)
const checkedAt = new Date()
const feedAgeHours = (checkedAt.getTime() - new Date(feed.generated).getTime()) / 3_600_000
const maxFeedAgeHours = Number(process.env.MAX_FEED_AGE_HOURS ?? 24 * 30)
if (!Number.isFinite(feedAgeHours) || !Number.isFinite(maxFeedAgeHours) || maxFeedAgeHours < 1) {
	throw new Error("invalid feed freshness timestamp or threshold")
}
const mismatches = checksumResults.filter(({ valid }) => !valid)
const health = {
	schemaVersion: "1",
	status: mismatches.length === 0 && feedAgeHours <= maxFeedAgeHours ? "healthy" : "degraded",
	checkedAt: checkedAt.toISOString(),
	sourceCommit: process.env.GITHUB_SHA ?? "local",
	feed: {
		generated: feed.generated,
		ageHours: Number(feedAgeHours.toFixed(2)),
		maxAgeHours: maxFeedAgeHours,
		advisoryCount: feed.advisory_count,
	},
	integrity: {
		checkedFiles: checksumResults.length,
		validFiles: checksumResults.length - mismatches.length,
		mismatches: mismatches.map(({ file, expected, actual }) => ({ file, expected, actual })),
	},
}
await writeFile(path.join(outDir, "health.json"), `${JSON.stringify(health, null, 2)}\n`)

const esc = (s) =>
	String(s ?? "").replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
	)

const SEV_COLOR = {
	critical: "#b91c1c",
	high: "#ea580c",
	medium: "#ca8a04",
	low: "#65a30d",
}

const css = `body{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#111}
a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb;padding:.5rem;text-align:left;vertical-align:top}
.sev{display:inline-block;padding:.1rem .5rem;border-radius:.25rem;color:#fff;font-size:.85rem}
input{width:100%;padding:.5rem;margin:1rem 0;border:1px solid #d1d5db;border-radius:.375rem}
code{background:#f3f4f6;padding:.1rem .3rem;border-radius:.25rem;word-break:break-all}
footer{margin-top:3rem;color:#6b7280;font-size:.85rem}`

const sevBadge = (s) =>
	`<span class="sev" style="background:${SEV_COLOR[s] ?? "#6b7280"}">${esc(s)}</span>`

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${css}</style></head><body>${body}
<footer>Generated from <a href="https://github.com/Akshay7273/skill-advisories">skill-advisories</a> feed.json · ${esc(feed.generated)}</footer></body></html>`

for (const adv of feed.advisories) {
	const artifacts = (adv.artifacts ?? [])
		.map(
			(a) =>
				`<tr><td>${esc(a.ecosystem)}</td><td><code>${esc(a.name)}</code></td><td>${esc(a.publisher ?? "")}</td><td>${(a.sha256 ?? []).map((h) => `<code>${esc(h)}</code>`).join("<br>")}</td></tr>`,
		)
		.join("")
	const refs = (adv.references ?? [])
		.map(
			(r) =>
				`<li><a href="${esc(r.url)}" rel="nofollow">${esc(r.url)}</a> (${esc(r.type)})</li>`,
		)
		.join("")
	const body = `<p><a href="../index.html">← all advisories</a></p>
<h1>${esc(adv.id)}</h1>
<p>${sevBadge(adv.severity)} · type: <strong>${esc(adv.type)}</strong> · published ${esc(adv.published)} · modified ${esc(adv.modified)}</p>
<p>${esc(adv.summary)}</p>
<h2>Behaviors</h2><ul>${(adv.behaviors ?? []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
<h2>Artifacts</h2><table><tr><th>Ecosystem</th><th>Name</th><th>Publisher</th><th>SHA-256</th></tr>${artifacts}</table>
<h2>References</h2><ul>${refs}</ul>`
	await writeFile(path.join(outDir, "advisory", `${adv.id}.html`), page(adv.id, body))
}

const rows = feed.advisories
	.map(
		(adv) => `<tr data-search="${esc(`${adv.id} ${adv.summary} ${(adv.artifacts ?? []).map((a) => a.name).join(" ")}`.toLowerCase())}">
<td><a href="advisory/${esc(adv.id)}.html">${esc(adv.id)}</a></td><td>${sevBadge(adv.severity)}</td><td>${esc(adv.type)}</td><td>${esc(adv.summary)}</td></tr>`,
	)
	.join("")
const index = `<h1>skill-advisories</h1>
<p>A public advisory database for the Claude Code / agent-skill ecosystem. ${feed.advisories.length} advisories.</p>
<p>Feed status: <strong>${esc(health.status)}</strong> · ${health.integrity.validFiles}/${health.integrity.checkedFiles} checksums valid · <a href="health.html">details</a> · <a href="health.json">JSON</a></p>
<input id="q" placeholder="Filter by id, name, or summary…">
<table><tr><th>ID</th><th>Severity</th><th>Type</th><th>Summary</th></tr>${rows}</table>
<script>document.getElementById("q").addEventListener("input",(e)=>{const q=e.target.value.toLowerCase();for(const tr of document.querySelectorAll("tr[data-search]"))tr.style.display=tr.dataset.search.includes(q)?"":"none"})</script>`
await writeFile(path.join(outDir, "index.html"), page("skill-advisories", index))
const healthBody = `<h1>Feed health</h1>
<p>Status: <strong>${esc(health.status)}</strong></p>
<table><tr><th>Checked</th><td>${esc(health.checkedAt)}</td></tr>
<tr><th>Source commit</th><td><code>${esc(health.sourceCommit)}</code></td></tr>
<tr><th>Feed generated</th><td>${esc(health.feed.generated)}</td></tr>
<tr><th>Feed age</th><td>${esc(health.feed.ageHours)} hours (limit ${esc(health.feed.maxAgeHours)})</td></tr>
<tr><th>Advisories</th><td>${esc(health.feed.advisoryCount)}</td></tr>
<tr><th>Integrity</th><td>${esc(health.integrity.validFiles)}/${esc(health.integrity.checkedFiles)} files valid</td></tr></table>
<p><a href="health.json">Machine-readable status</a> · <a href="index.html">Advisories</a></p>`
await writeFile(path.join(outDir, "health.html"), page("Feed health", healthBody))
console.log(`site: ${feed.advisories.length} advisory pages + index + ${health.status} health status written to ${outDir}/`)
