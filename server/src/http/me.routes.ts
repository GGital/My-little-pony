import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { getMyRegistration, listMyRegistrations } from '../domain/me.js'
import { sendError } from './errors.js'
import { requireAuth, requireRole } from './guards.js'
import { parseId } from './validate.js'

/** Feature-H: E-10 and E-11, participant only (contracts §11). Mounted at /api. */
export function meRouter(db: PrismaClient) {
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

  return router
}
