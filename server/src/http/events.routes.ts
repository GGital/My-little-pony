import express, { type Request, type Response, type Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Config } from '../config.js'
import { createEvent, createEventInputSchema, EventTimeError } from '../domain/events.create.js'
import { getEventDetail, listUpcomingEvents } from '../domain/events.read.js'
import { sendError } from './errors.js'
import { requireAuth, requireRole } from './guards.js'
import { requireOrigin } from './origin.js'
import { parseId, validate } from './validate.js'

export function eventsRouter(prisma: PrismaClient, config?: Config): Router {
  const router = express.Router()
  const appOrigin = config?.APP_ORIGIN ?? process.env.APP_ORIGIN ?? 'http://localhost:5173'

  // E-04: GET /api/events (public)
  router.get('/events', async (_req: Request, res: Response) => {
    const list = await listUpcomingEvents(prisma)
    return res.status(200).json(list)
  })

  // E-05: GET /api/events/:id (public, viewer-aware)
  router.get('/events/:id', async (req: Request, res: Response) => {
    const eventId = parseId(req.params.id)
    if (eventId === null) {
      return sendError(res, 'INVALID_PATH_PARAMETER')
    }

    const detail = await getEventDetail(prisma, eventId, req.actor)

    if (!detail) {
      return sendError(res, 'EVENT_NOT_FOUND')
    }

    return res.status(200).json(detail)
  })

  // E-06: POST /api/events (organizer only, contracts §7 Feature-D)
  router.post(
    '/events',
    requireAuth,
    requireRole('ORGANIZER'),
    requireOrigin(appOrigin),
    validate({ body: createEventInputSchema }),
    async (req: Request, res: Response) => {
      try {
        const created = await createEvent(prisma, req.actor!, res.locals.body)
        return res.status(201).json(created)
      } catch (err) {
        if (err instanceof EventTimeError) {
          return sendError(res, 'EVENT_TIME_INVALID', [{ field: err.field, message: err.message }])
        }
        throw err
      }
    },
  )

  return router
}
