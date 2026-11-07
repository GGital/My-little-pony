// Starts the API for the Playwright suite (STS §1.2, §7) on the TEST database, never the development one.
//   npm --prefix server run e2e:api   (playwright.config.ts runs it; loads server/.env first)
// Each start applies the migrations, empties every table and loads the §0.3 seed, so the journeys always begin from
// the same data (EV-2 with one seat left, Nok with no registrations). It refuses to run when DATABASE_URL_TEST is
// missing or equal to DATABASE_URL, like test-db.mjs.
import { spawn, spawnSync } from 'node:child_process'

const test = process.env.DATABASE_URL_TEST
if (!test) throw new Error('DATABASE_URL_TEST is not set (see server/.env.example)')
if (test === process.env.DATABASE_URL) throw new Error('DATABASE_URL_TEST must differ from DATABASE_URL')

const env = {
  ...process.env,
  DATABASE_URL: test,
  NODE_ENV: 'development',
  PORT: process.env.E2E_API_PORT ?? '3100',
  APP_ORIGIN: process.env.E2E_APP_ORIGIN ?? 'http://localhost:5174',
  LOG_LEVEL: 'warn',
}
const shell = process.platform === 'win32'

for (const args of [
  ['prisma', 'migrate', 'deploy'],
  ['tsx', 'scripts/e2e-seed.ts'],
]) {
  const step = spawnSync('npx', args, { stdio: 'inherit', shell, env })
  if (step.status !== 0) process.exit(step.status ?? 1)
}

const api = spawn('npx', ['tsx', 'src/index.ts'], { stdio: 'inherit', shell, env })
api.on('exit', (code) => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => api.kill(signal))
