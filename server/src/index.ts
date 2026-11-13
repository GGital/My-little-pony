import { loadConfig, type Config } from './config.js'
import { createLogger } from './log.js'

// Check the configuration BEFORE loading Prisma: @prisma/client reads server/.env when it is imported,
// which would quietly fill in a missing DATABASE_URL and defeat this check (AC-SR4-01).
let config: Config
try {
  config = loadConfig()
} catch (err) {
  // A clear one-line reason, not a stack trace.
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

const { PrismaClient } = await import('@prisma/client')
const { createApp } = await import('./app.js')

const log = createLogger(config.LOG_LEVEL)
const prisma = new PrismaClient({ datasourceUrl: config.DATABASE_URL })
const app = createApp({ prisma, config, log })

const server = app.listen(config.PORT, () => log.info('server_started', { port: config.PORT, nodeEnv: config.NODE_ENV }))

// Cloud Run sends SIGTERM before it stops an instance: finish open requests, then close the database pool.
process.once('SIGTERM', () => {
  log.info('server_stopping', { signal: 'SIGTERM' })
  server.close(() => void prisma.$disconnect().finally(() => process.exit(0)))
})
