import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const feed = JSON.parse(await readFile("feed/feed.json", "utf8"))
const outDir = "site"
await mkdir(path.join(outDir, "advisory"), { recursive: true })

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
<input id="q" placeholder="Filter by id, name, or summary…">
<table><tr><th>ID</th><th>Severity</th><th>Type</th><th>Summary</th></tr>${rows}</table>
<script>document.getElementById("q").addEventListener("input",(e)=>{const q=e.target.value.toLowerCase();for(const tr of document.querySelectorAll("tr[data-search]"))tr.style.display=tr.dataset.search.includes(q)?"":"none"})</script>`
await writeFile(path.join(outDir, "index.html"), page("skill-advisories", index))
console.log(`site: ${feed.advisories.length} advisory pages + index written to ${outDir}/`)
