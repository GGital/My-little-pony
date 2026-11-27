import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { Config } from '../config.js'
import { listEventChanges } from '../domain/changes.js'
import { cancelEvent, publishEvent, updateEvent } from '../domain/event-lifecycle.js'
import { cancelBody } from '../domain/event-input.js'
import { editEventInputSchema } from '../domain/events.create.js'
import { getOrganizerEventRegistrations, listOrganizerEvents } from '../domain/organizer.js'
import { sendError } from './errors.js'
import { requireAuth, requireRole } from './guards.js'
import { requireOrigin } from './origin.js'
import { parseId, validate } from './validate.js'

/** E-14 takes no input: the body is `{}` or absent (Sprint 2 contracts §2). */
const emptyBody = z.object({}).strict()

/** Feature-E: E-07; Feature-I: E-08; Feature-L: E-13; Feature-K: E-14; SR-08: E-17 (Sprint 2 contracts §1, §2), organizer only. Mounted at /api. */
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

  // E-13: PATCH /organizer/events/:id, owner only (Sprint 2 contracts §3): 401 → 403 role → 403 Origin → 400 (body,
  // path) → then the transaction's 404 / 409 / 422.
  router.patch('/organizer/events/:id', ...organizer, requireOrigin(config.APP_ORIGIN), validate({ body: editEventInputSchema }), async (req, res) => {
    const id = parseId(req.params.id)
    if (id === null) return sendError(res, 'INVALID_PATH_PARAMETER')
    res.json(await updateEvent(db, req.actor!, id, res.locals.body, Object.keys(req.body ?? {})))
  })

  // E-15: POST /organizer/events/:id/cancel, owner only. Same order as E-14: 401 → 403 role → 403 Origin → 400 (path,
  // body, the reason rule) → then the transaction's 404 / 409 (Sprint 2 contracts §6).
  router.post('/organizer/events/:id/cancel', ...organizer, requireOrigin(config.APP_ORIGIN), validate({ body: cancelBody }), async (req, res) => {
    const id = parseId(req.params.id)
    if (id === null) return sendError(res, 'INVALID_PATH_PARAMETER')
    res.json(await cancelEvent(db, req.actor!, id, (res.locals.body as { reason: string }).reason))
  })

  return router
}
