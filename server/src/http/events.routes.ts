import { createHash } from 'node:crypto'
import express, { type Request, type Response, type Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { now } from '../clock.js'
import { getEventDetail, listUpcomingEvents, type Actor } from '../domain/events.read.js'
import { sendError } from './errors.js'

function extractCookieToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)tcg\.sid=([^;]+)/)
  return match && match[1] ? match[1] : null
}

async function resolveActor(prisma: PrismaClient, req: Request): Promise<Actor | undefined> {
  if ((req as any).actor) {
    return (req as any).actor as Actor
  }

  const token = extractCookieToken(req.headers.cookie)
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return undefined
  }

  const sessionId = createHash('sha256').update(token).digest('hex')
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })

  if (!session || session.expiresAt <= now()) {
    return undefined
  }

  return {
    id: session.user.id,
    role: session.user.role,
    displayName: session.user.displayName,
  }
}

export function eventsRouter(prisma: PrismaClient): Router {
  const router = express.Router()

  // E-04: GET /api/events (public)
  router.get('/events', async (_req: Request, res: Response) => {
    const list = await listUpcomingEvents(prisma)
    return res.status(200).json(list)
  })

  // E-05: GET /api/events/:id (public, viewer-aware)
  router.get('/events/:id', async (req: Request, res: Response) => {
    const rawId = req.params.id
    const id = typeof rawId === 'string' ? rawId : ''
    if (!/^[1-9]\d*$/.test(id)) {
      return sendError(res, 'INVALID_PATH_PARAMETER')
    }

    const eventId = Number.parseInt(id, 10)
    const actor = await resolveActor(prisma, req)
    const detail = await getEventDetail(prisma, eventId, actor)

    if (!detail) {
      return sendError(res, 'EVENT_NOT_FOUND')
    }

    return res.status(200).json(detail)
  })

  return router
}
