import express, { type Request, type Response, type Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { Config } from '../config.js'
import { getEventDetail, listUpcomingEvents } from '../domain/events.read.js'
import { register } from '../domain/registrations.js'
import { sendError } from './errors.js'
import { requireAuth, requireRole } from './guards.js'
import { requireOrigin } from './origin.js'
import { parseId, validate } from './validate.js'

/** E-09 takes no input: the body is `{}` or absent, and the participant is the session's actor (BR-17). */
const emptyBody = z.object({}).strict()

export function eventsRouter(prisma: PrismaClient, config: Config): Router {
  const router = express.Router()

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

  // E-09: POST /api/events/:id/registrations. Check order of contracts §10: 401 → 403 role → 403 origin →
  // 400 (path id, body) → then the transaction's 404 / 409s.
  router.post(
    '/events/:id/registrations',
    requireAuth,
    requireRole('PARTICIPANT'),
    requireOrigin(config.APP_ORIGIN),
    validate({ body: emptyBody }),
    async (req: Request, res: Response) => {
      const eventId = parseId(req.params.id)
      if (eventId === null) return sendError(res, 'INVALID_PATH_PARAMETER')
      return res.status(201).json(await register(prisma, req.actor!, eventId))
    },
  )

  return router
}
