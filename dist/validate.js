import { readFile } from "node:fs/promises";
import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";
// ajv and ajv-formats are CommonJS. Under module=NodeNext, TypeScript types
// their default import as the module namespace, while Node/tsx resolve it to
// the class/function at runtime. These casts bridge that gap - do not simplify.
const Ajv2020 = _Ajv2020;
const addFormats = _addFormats;
const SCHEMA_URL = new URL("../schema/advisory.schema.json", import.meta.url);
/**
 * Validate advisories against the JSON Schema, then enforce repo invariants:
 * filename matches id, ids are unique, modified is not earlier than published.
 */
export async function validateAdvisories(loaded) {
    const schema = JSON.parse(await readFile(SCHEMA_URL, "utf8"));
    const ajv = new Ajv2020({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const problems = [];
    const seen = new Set();
    for (const { file, advisory } of loaded) {
        if (!validate(advisory)) {
            for (const err of validate.errors ?? []) {
                problems.push({ file, problem: `schema: ${err.instancePath || "/"} ${err.message}` });
            }
            continue;
        }
        if (file !== `${advisory.id}.json`) {
            problems.push({ file, problem: `filename must be ${advisory.id}.json` });
        }
        if (seen.has(advisory.id)) {
            problems.push({ file, problem: `duplicate id ${advisory.id}` });
        }
        seen.add(advisory.id);
        if (Date.parse(advisory.modified) < Date.parse(advisory.published)) {
            problems.push({ file, problem: "modified is earlier than published" });
        }
    }
    return problems;
}
