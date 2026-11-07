// TEST-SR7-01 (STS §2.12, AC-SR7-01, NFR-14): the coverage script named in STS §3.
//   npm run sts:check
// Checks, from the documents themselves:
//   1. every AC defined in feature-contracts.md appears in STS §3 with at least one test;
//   2. every test named in §3 is a row of §2 whose Result is recorded (Pass or Fail, never Pending);
//   3. every BR in STS §4 has at least one rejection test that is a §2 row;
// then lists the failed rows, so they are reported and not hidden. Exit code 1 when any check fails.
import { readFileSync } from 'node:fs'

const dir = 'docs/sprints/sprint-1'
const contracts = readFileSync(`${dir}/feature-contracts.md`, 'utf8')
const sts = readFileSync(`${dir}/sts.md`, 'utf8')
const section = (n) => sts.slice(sts.indexOf(`\n## ${n}.`), sts.indexOf(`\n## ${n + 1}.`))
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim())
const problems = []

// AC ids are defined in bold in the contract tables: | **AC-X-nn** | …
const acs = [...new Set([...contracts.matchAll(/\|\s*\*\*(AC-[A-Z0-9]+-\d\d)\*\*/g)].map((m) => m[1]))]

// §2: one row per planned test, Result in the last column.
const results = new Map()
for (const line of section(2).split('\n')) {
  const c = cells(line)
  if (/^(TEST-[A-Z0-9]+-\d\d|JRN-\d\d)$/.test(c[0] ?? '')) results.set(c[0], c.at(-1))
}

// "TEST-SR2-01, SR2-04" → TEST-SR2-01, TEST-SR2-04
const testIds = (text) =>
  text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('TEST-') || t.startsWith('JRN-') ? t : `TEST-${t}`))

// §3: three AC | Tests pairs per line.
const acTests = new Map()
for (const line of section(3).split('\n')) {
  const c = cells(line)
  for (let i = 0; i + 1 < c.length; i += 2) if (/^AC-/.test(c[i])) acTests.set(c[i], testIds(c[i + 1]))
}

for (const ac of acs) {
  const tests = acTests.get(ac)
  if (!tests?.length) problems.push(`${ac}: not in STS §3`)
  for (const t of tests ?? []) {
    const r = results.get(t)
    if (!r) problems.push(`${ac}: ${t} is not a row of STS §2`)
    else if (!/^(Pass|Fail)\b/.test(r)) problems.push(`${ac}: ${t} has no recorded result (${r})`)
  }
}
for (const ac of acTests.keys()) if (!acs.includes(ac)) problems.push(`${ac}: in STS §3 but not defined in the contracts`)

// §4: | BR-nn | tests | what |
const brs = []
for (const line of section(4).split('\n')) {
  const c = cells(line)
  if (!/^BR-\d\d$/.test(c[0] ?? '')) continue
  brs.push(c[0])
  const tests = testIds(c[1] ?? '').filter((t) => results.has(t))
  if (!tests.length) problems.push(`${c[0]}: no rejection test that is a row of STS §2`)
}

const failed = [...results].filter(([, r]) => /^Fail\b/.test(r)).map(([t]) => t)
console.log(`ACs in the contracts: ${acs.length}; with a test and a recorded result: ${acs.length - new Set(problems.filter((p) => p.startsWith('AC-')).map((p) => p.split(':')[0])).size}`)
console.log(`STS §2 rows: ${results.size} (Pass ${[...results.values()].filter((r) => /^Pass\b/.test(r)).length}, Fail ${failed.length}, other ${[...results.values()].filter((r) => !/^(Pass|Fail)\b/.test(r)).length})`)
console.log(`BRs in STS §4: ${brs.length}, each with a rejection test: ${brs.length - problems.filter((p) => p.startsWith('BR-')).length}`)
console.log(`Failed rows (reported in STS §6): ${failed.length ? failed.join(', ') : 'none'}`)
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`)
  for (const p of problems) console.log(`- ${p}`)
  process.exitCode = 1
} else {
  console.log('\nTEST-SR7-01: every AC has a test with a recorded result, and every BR has a rejection test.')
}
