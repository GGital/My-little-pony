import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { Config } from '../config.js'
import { checkIn, undoCheckIn } from '../domain/checkin.js'
import { sendError } from './errors.js'
import { requireAuth, requireRole } from './guards.js'
import { requireOrigin } from './origin.js'
import { parseId, validate } from './validate.js'

/** E-18 and E-19 take no input: the body is `{}` or absent (Sprint 3 contracts §1). */
const emptyBody = z.object({}).strict()

/**
 * Feature-P: E-18 POST and E-19 DELETE /organizer/registrations/:id/check-in, owner of the event only. Mounted at
 * /api. Order of Sprint 3 contracts §1: 401 → 403 role → 403 Origin → 400 (body, path) → then the transaction's
 * 404 / 409.
 */
export function checkInRouter(db: PrismaClient, config: Config): Router {
  const router = Router()
  const guards = [requireAuth, requireRole('ORGANIZER'), requireOrigin(config.APP_ORIGIN), validate({ body: emptyBody })]

  router.post('/organizer/registrations/:id/check-in', ...guards, async (req, res) => {
    const id = parseId(req.params.id)
    if (id === null) return sendError(res, 'INVALID_PATH_PARAMETER')
    res.json(await checkIn(db, req.actor!, id))
  })

  router.delete('/organizer/registrations/:id/check-in', ...guards, async (req, res) => {
    const id = parseId(req.params.id)
    if (id === null) return sendError(res, 'INVALID_PATH_PARAMETER')
    res.json(await undoCheckIn(db, req.actor!, id))
  })

  return router
}
