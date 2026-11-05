// Prepares the TEST database from the migrations (loads server/.env first).
//   npm run db:migrate:test  → `prisma migrate deploy`: applies new migrations only, never deletes data (default)
//   npm run db:reset:test    → `prisma migrate reset`: DROPS EVERYTHING in the test database, then re-applies
// Both refuse to run when DATABASE_URL_TEST is missing or equal to DATABASE_URL, so development data is never touched.
import { spawnSync } from 'node:child_process'

const test = process.env.DATABASE_URL_TEST
if (!test) throw new Error('DATABASE_URL_TEST is not set (see server/.env.example)')
if (test === process.env.DATABASE_URL) throw new Error('DATABASE_URL_TEST must differ from DATABASE_URL')

const reset = process.argv.includes('--reset')
const args = reset ? ['prisma', 'migrate', 'reset', '--force', '--skip-seed'] : ['prisma', 'migrate', 'deploy']

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: test },
})
process.exit(result.status ?? 1)
