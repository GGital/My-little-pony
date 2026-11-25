import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { Config } from '../config.js'
import { listEventChanges } from '../domain/changes.js'
import { publishEvent } from '../domain/event-lifecycle.js'
import { getOrganizerEventRegistrations, listOrganizerEvents } from '../domain/organizer.js'
import { sendError } from './errors.js'
import { requireAuth, requireRole } from './guards.js'
import { requireOrigin } from './origin.js'
import { parseId, validate } from './validate.js'

/** E-14 takes no input: the body is `{}` or absent (Sprint 2 contracts §2). */
const emptyBody = z.object({}).strict()

/** Feature-E: E-07; Feature-I: E-08; Feature-K: E-14; SR-08: E-17 (Sprint 2 contracts §1, §2), organizer only. Mounted at /api. */
export function organizerRouter(db: PrismaClient, config: Config): Router {
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

  // E-17: GET /organizer/events/:id/changes, owner only; another organizer's event is the same 404 (Sprint 2 §1)
  router.get('/organizer/events/:id/changes', ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    if (id === null) return sendError(res, 'INVALID_PATH_PARAMETER')

    const result = await listEventChanges(db, req.actor!, id)
    if (!result) return sendError(res, 'EVENT_NOT_FOUND')
    res.json(result)
  })

  // E-14: POST /organizer/events/:id/publish, owner only. Order of Sprint 2 contracts §2: 401 → 403 role → 403 Origin →
  // 400 (path, body) → then the transaction's 404 / 409 / 422.
  router.post('/organizer/events/:id/publish', ...organizer, requireOrigin(config.APP_ORIGIN), validate({ body: emptyBody }), async (req, res) => {
    const id = parseId(req.params.id)
    if (id === null) return sendError(res, 'INVALID_PATH_PARAMETER')
    res.json(await publishEvent(db, req.actor!, id))
  })

  return router
}
