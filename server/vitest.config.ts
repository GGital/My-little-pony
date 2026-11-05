import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Node's built-in .env loader keeps database URLs out of the repo without a dotenv dependency.
if (existsSync('.env')) process.loadEnvFile('.env')

const testUrl = process.env.DATABASE_URL_TEST
if (!testUrl) throw new Error('DATABASE_URL_TEST is not set (see server/.env.example)')
if (testUrl === process.env.DATABASE_URL) throw new Error('DATABASE_URL_TEST must differ from DATABASE_URL')
// Every Prisma client created by the tests talks to the test database only.
process.env.DATABASE_URL = testUrl
process.env.NODE_ENV = 'test'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // All files share one database, so they run one at a time (as in TokTickIT).
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
