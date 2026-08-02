/**
 * Validate the committed adoption ledger.
 *
 * The adoption gate is the last open item on the v0.6 milestone, so the file
 * that answers it is worth checking on every pull request rather than when
 * somebody remembers. This runs the same parser the library exports, so the
 * published schema, the runtime schema, and the committed document cannot
 * drift apart quietly.
 *
 * It reports the gate's state without judging it. Zero verified integrations
 * is the honest answer today and must not fail a build -- the check is that
 * the ledger is well formed and says what it means, not that it is full.
 */
import { readFile } from "node:fs/promises"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import { adoptionGateMet, parseAdopters, verifiedAdopters } from "../dist/adopters.js"

const document = JSON.parse(await readFile("adopters.json", "utf8"))

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(JSON.parse(await readFile("schema/adopters.schema.json", "utf8")))
if (!validate(document)) {
  console.error(`❌ adopters.json does not match its published schema`)
  console.error(ajv.errorsText(validate.errors, { separator: "\n   " }))
  process.exit(1)
}

// The parser enforces what the published schema cannot say: that no two
// entries claim the same integration URL. A contributor adding a row is the
// likeliest person to trip it, so it is reported rather than thrown.
let adopters
try {
  adopters = parseAdopters(document)
} catch (error) {
  console.error(`❌ adopters.json is not a usable ledger`)
  console.error(`   ${error.message}`)
  process.exit(1)
}

const counted = verifiedAdopters(adopters)
const pending = adopters.entries.filter((entry) => !counted.includes(entry))

for (const entry of counted) {
  console.log(`✅ ${entry.name} — ${entry.integration} — ${entry.url}`)
}
for (const entry of pending) {
  const missing = !entry.verified ? "not yet verified" : "no public consent link"
  console.log(`⚠ ${entry.name} — ${missing}, not counted`)
}

console.log(
  `adopters: ${counted.length} verifiable integration(s), ${pending.length} recorded but not counted`,
)
console.log(
  adoptionGateMet(adopters)
    ? "   the v0.6 adoption gate is met"
    : "   the v0.6 adoption gate is open — see https://github.com/Akshay7273/skill-advisories/issues/12",
)
