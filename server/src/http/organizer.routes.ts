import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { listOrganizerEvents } from '../domain/organizer.js'
import { requireAuth, requireRole } from './guards.js'

/** Feature-E: E-07, organizer only (contracts §8). Mounted at /api. */
export function organizerRouter(db: PrismaClient): Router {
  const router = Router()
  const organizer = [requireAuth, requireRole('ORGANIZER')]

  router.get('/organizer/events', ...organizer, async (req, res) => {
    res.json(await listOrganizerEvents(db, req.actor!))
  })

  return router
}
