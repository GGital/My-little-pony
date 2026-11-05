import { createApp, type AppDeps } from '../../src/app.js'
import { loadConfig } from '../../src/config.js'
import type { LogFields, Logger } from '../../src/log.js'
import { prisma } from './db.js'

/** The browser origin the tests pretend to be (STS §1.3: state-changing requests send it). */
export const TEST_ORIGIN = 'http://localhost:5173'

export const testConfig = () => loadConfig({ ...process.env, APP_ORIGIN: TEST_ORIGIN, LOG_LEVEL: 'silent' })

/** A logger that keeps every entry in memory, so tests can check what was (and was not) logged. */
export function spyLogger() {
  const entries: { level: 'error' | 'info'; event: string; fields?: LogFields }[] = []
  const log: Logger = {
    error: (event, fields) => entries.push({ level: 'error', event, fields }),
    info: (event, fields) => entries.push({ level: 'info', event, fields }),
  }
  return { log, entries }
}

/** The real Express app wired to the test database. */
export function makeApp(over: Partial<AppDeps> = {}) {
  return createApp({ prisma, config: testConfig(), log: spyLogger().log, ...over })
}
