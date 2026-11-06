import express, { type Request, type Response, type Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { getEventDetail, listUpcomingEvents } from '../domain/events.read.js'
import { sendError } from './errors.js'
import { parseId } from './validate.js'

export function eventsRouter(prisma: PrismaClient): Router {
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

  return router
}
