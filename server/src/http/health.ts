import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Logger } from '../log.js'

/** E-12 GET /api/health (SDS §9.2): the Cloud Run startup and liveness probe in Lab 5. */
export function healthRouter(db: Pick<PrismaClient, '$queryRaw'>, log: Logger) {
  const router = Router()
  router.get('/health', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`
      res.json({ status: 'ok' })
    } catch (err) {
      log.error('health_check_failed', { error: err instanceof Error ? err.message : String(err) })
      res.status(503).json({ status: 'unavailable' })
    }
  })
  return router
}
