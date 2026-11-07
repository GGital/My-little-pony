import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { getOrganizerEventRegistrations, listOrganizerEvents } from '../domain/organizer.js'
import { sendError } from './errors.js'
import { requireAuth, requireRole } from './guards.js'
import { parseId } from './validate.js'

/** Feature-E: E-07; Feature-I: E-08, organizer only (contracts §8, §12). Mounted at /api. */
export function organizerRouter(db: PrismaClient): Router {
  const router = Router()
  const organizer = [requireAuth, requireRole('ORGANIZER')]

  router.get('/organizer/events', ...organizer, async (req, res) => {
    res.json(await listOrganizerEvents(db, req.actor!))
  })

  // E-08: GET /organizer/events/:id/registrations (contracts §12 Feature-I)
  router.get('/organizer/events/:id/registrations', ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    if (id === null) {
      return sendError(res, 'INVALID_PATH_PARAMETER')
    }

    const result = await getOrganizerEventRegistrations(db, req.actor!, id)
    if (!result) {
      return sendError(res, 'EVENT_NOT_FOUND')
    }

    res.json(result)
  })

  return router
}
