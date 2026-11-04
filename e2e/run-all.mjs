// Runs every e2e/*.test.mjs suite and reports one line per suite plus a final summary.
// This exists because the suites were going completely unrun for whole sessions without anyone noticing:
// the default `node` here is 18, Playwright needs 20+, and a wrong node just throws early with no suite
// output at all -- easy to miss in a wall of other text. This script checks the version FIRST, with a
// fix in the error message, instead of letting that failure look like "every suite is broken".
//
// Usage:
//   node e2e/run-all.mjs            all suites, in roughly fast-to-slow order
//   node e2e/run-all.mjs --fast     skips the suites with hundreds of cases (tools1/2, calculator, shell,
//                                   budget, notes-todo, qa-budget-new, qa-cross, qa-notes-due, qa-tools) --
//                                   for a quick sanity check, not a release gate
//   node e2e/run-all.mjs emi gst    only suites whose filename contains one of these words
//
// Each suite already builds and serves its own copy of the app (see lib.mjs startApp), so suites run
// one at a time, not in parallel -- running them in parallel would mean N concurrent production builds.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

// ---- Node version gate -----------------------------------------------------------------------------
const major = Number(process.versions.node.split('.')[0])
if (major < 20) {
  console.error(`\nPlaywright (and these suites) need Node 20 or higher. This shell is running Node ${process.versions.node}.`)
  console.error(`\nFix:`)
  console.error(`  nvm install 20   # or any 20+ version; .nvmrc in this repo pins 22`)
  console.error(`  nvm use`)
  console.error(`\nOr, without changing your default node, just this run:`)
  console.error(`  export PATH="$(nvm_path=$(nvm which 20 2>/dev/null); dirname "$nvm_path" 2>/dev/null || echo /usr/local/bin):$PATH"`)
  console.error(`\nWithout this, the suites below either refuse to start or fail in confusing ways that look`)
  console.error(`like app bugs. Confirm the fix worked with: node -v`)
  process.exit(1)
}

// ---- Which suites --------------------------------------------------------------------------------
const SLOW = new Set(['tools1', 'tools2', 'calculator', 'shell', 'budget', 'notes-todo', 'qa-budget-new', 'qa-cross', 'qa-notes-due', 'qa-tools'])
const args = process.argv.slice(2)
const fast = args.includes('--fast')
const words = args.filter((a) => a !== '--fast')

let files = readdirSync(HERE)
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => f.replace(/\.test\.mjs$/, ''))
  .sort((a, b) => Number(SLOW.has(a)) - Number(SLOW.has(b)) || a.localeCompare(b)) // fast ones first

if (fast) files = files.filter((f) => !SLOW.has(f))
if (words.length) files = files.filter((f) => words.some((w) => f.includes(w)))

if (files.length === 0) {
  console.error('No suites matched.')
  process.exit(1)
}

// ---- Run each suite with THIS process's node (so the version check above actually applies) ---------
console.log(`Running ${files.length} suite${files.length === 1 ? '' : 's'} with node ${process.versions.node}${fast ? ' (--fast: skipping the big ones)' : ''}:\n  ${files.join(', ')}\n`)

const results = []
for (const name of files) {
  const path = join(HERE, `${name}.test.mjs`)
  const started = Date.now()
  process.stdout.write(`\n=== ${name} ===\n`)
  const r = spawnSync(process.execPath, [path], { stdio: 'inherit' })
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  const ok = r.status === 0
  results.push({ name, ok, secs, status: r.status })
  console.log(`--- ${name}: ${ok ? 'PASS' : `FAIL (exit ${r.status})`} in ${secs}s ---`)
}

console.log('\n=============================================')
console.log('Summary')
console.log('=============================================')
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(20)} ${r.secs}s`)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} suites passed.`)
if (failed.length) console.log(`Failed: ${failed.map((r) => r.name).join(', ')}`)
process.exit(failed.length ? 1 : 0)
