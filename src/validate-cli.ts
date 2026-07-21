import pc from "picocolors"
import { loadAdvisories } from "./load.js"
import { validateAdvisories } from "./validate.js"

const dir = process.argv[2] ?? "advisories"

const loaded = await loadAdvisories(dir)
const problems = await validateAdvisories(loaded)

if (problems.length === 0) {
  console.log(pc.green(`\u2705 ${loaded.length} advisor${loaded.length === 1 ? "y" : "ies"} valid in "${dir}"`))
} else {
  console.log(pc.red(`\u274c ${problems.length} problem(s) in "${dir}":`))
  for (const p of problems) {
    console.log(`  ${pc.bold(p.file)} \u2014 ${p.problem}`)
  }
  process.exitCode = 1
}
