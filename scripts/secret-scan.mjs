// TEST-SR4-01 (M) and DoD-7: the secret scan (STS §2.12, §6).
//   npm run secret:scan
// Searches every commit on every branch (`git log --all -p`) and the evidence folder for:
//   - the values of your own local secrets in server/.env (SEED_PASSWORD and the database passwords);
//   - common secret shapes: private keys, and cloud, GitHub and Slack tokens.
// Database URLs in tests and docs are fake examples; the real database passwords are checked by value instead.
// It prints only what was found and where, never a value. Exit code 1 when anything is found.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const readEnv = (file) =>
  existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/))
          .filter(Boolean)
          .map((m) => [m[1], m[2]]),
      )
    : {}
const env = readEnv('server/.env')
const example = readEnv('server/.env.example')
const dbPassword = (url) => (url ? decodeURIComponent(new URL(url).password) : '')

const candidates = [
  ['SEED_PASSWORD', env.SEED_PASSWORD, example.SEED_PASSWORD],
  ['password in DATABASE_URL', dbPassword(env.DATABASE_URL), dbPassword(example.DATABASE_URL)],
  ['password in DATABASE_URL_TEST', dbPassword(env.DATABASE_URL_TEST), dbPassword(example.DATABASE_URL_TEST)],
]
// A value still equal to its .env.example placeholder is public by design, so it is not searched. It is reported as
// a warning instead, because the README asks everyone to choose their own.
const placeholders = candidates.filter(([, v, ex]) => v && v === ex).map(([what]) => what)
const local = candidates.filter(([, v, ex]) => v && v !== ex && v.length >= 6)

const SHAPES = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[abpors]-[A-Za-z0-9-]{10,}/],
]

const history = execFileSync('git', ['log', '--all', '-p', '--no-color'], { encoding: 'utf8', maxBuffer: 1 << 30 })
const evidenceDir = 'docs/sprints/sprint-1/evidence'
const evidence = readdirSync(evidenceDir, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.txt'))
  .map((f) => [f, readFileSync(`${evidenceDir}/${f}`, 'utf8')])

const findings = []
for (const [what, value] of local) {
  if (history.includes(value)) findings.push(`${what}: found in Git history`)
  for (const [f, text] of evidence) if (text.includes(value)) findings.push(`${what}: found in evidence/${f}`)
}
for (const [what, re] of SHAPES) {
  if (re.test(history)) findings.push(`${what}: shape found in Git history`)
  for (const [f, text] of evidence) if (re.test(text)) findings.push(`${what}: shape found in evidence/${f}`)
}

const commits = execFileSync('git', ['rev-list', '--all', '--count'], { encoding: 'utf8' }).trim()
console.log(`Scanned ${commits} commits on all branches and ${evidence.length} evidence files.`)
console.log(`Local secret values checked: ${local.map(([what]) => what).join(', ') || 'none'}.`)
console.log(`Secret shapes checked: ${SHAPES.map(([what]) => what).join(', ')}.`)
for (const what of placeholders) console.log(`Warning: ${what} in server/.env is still the .env.example placeholder; choose your own.`)
if (findings.length) {
  console.log(`\n${findings.length} finding(s):`)
  for (const f of findings) console.log(`- ${f}`)
  process.exitCode = 1
} else {
  console.log('\n0 findings.')
}
