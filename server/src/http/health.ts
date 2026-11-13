import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Logger } from '../log.js'

/**
 * E-12 GET /api/health (SDS §9.2): the Cloud Run startup and liveness probe.
 * GET /api/ready (Lab 5): the same database check in the shape the deploy smoke test reads.
 * GET /api/version (Lab 5): the commit the image was built from (GIT_SHA).
 */
export function healthRouter(db: Pick<PrismaClient, '$queryRaw'>, log: Logger, commit: string) {
  const databaseAnswers = async (check: string) => {
    try {
      await db.$queryRaw`SELECT 1`
      return true
    } catch (err) {
      log.error(`${check}_check_failed`, { error: err instanceof Error ? err.message : String(err) })
      return false
    }
  }

  const router = Router()
  router.get('/health', async (_req, res) => {
    if (await databaseAnswers('health')) res.json({ status: 'ok' })
    else res.status(503).json({ status: 'unavailable' })
  })
  router.get('/ready', async (_req, res) => {
    if (await databaseAnswers('ready')) res.json({ status: 'ready', db: 'connected' })
    else res.status(503).json({ status: 'not_ready' })
  })
  // Lab 5 R-08: which commit is running; the deploy smoke test compares it with the released image tag.
  router.get('/version', (_req, res) => {
    res.json({ commit })
  })
  return router
}
