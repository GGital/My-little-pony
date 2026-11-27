import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { Config } from '../config.js'
import { cancelRegistration } from '../domain/registrations.js'
import { getMyRegistration, listMyRegistrations } from '../domain/me.js'
import { sendError } from './errors.js'
import { requireAuth, requireRole } from './guards.js'
import { requireOrigin } from './origin.js'
import { parseId, validate } from './validate.js'

/** E-16 takes no input: the participant is the session's actor and the registration is in the path (BR-17). */
const emptyBody = z.object({}).strict()

/** Feature-H: E-10 and E-11, participant only (contracts §11). Mounted at /api. */
export function meRouter(db: PrismaClient, config: Config) {
  const router = Router()
  const participant = [requireAuth, requireRole('PARTICIPANT')]

  router.get('/me/registrations', ...participant, async (req, res) => {
    res.json(await listMyRegistrations(db, req.actor!))
  })

  // The path id is checked after authentication on a protected route (SDS §2.3).
  router.get('/me/registrations/:id', ...participant, async (req, res) => {
    const id = parseId(req.params.id)
    if (id === null) return sendError(res, 'INVALID_PATH_PARAMETER')
    const registration = await getMyRegistration(db, req.actor!, id)
    if (!registration) return sendError(res, 'REGISTRATION_NOT_FOUND')
    res.json(registration)
  })

  // E-16: check order of contracts §5: 401 → 403 role → 403 Origin → 400 (body, path id) → 404 → 409s.
  router.post(
    '/me/registrations/:id/cancel',
    ...participant,
    requireOrigin(config.APP_ORIGIN),
    validate({ body: emptyBody }),
    async (req, res) => {
      const id = parseId(req.params.id)
      if (id === null) return sendError(res, 'INVALID_PATH_PARAMETER')
      res.json(await cancelRegistration(db, req.actor!, id))
    },
  )

  return router
}
