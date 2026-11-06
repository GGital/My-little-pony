import type { PrismaClient } from '@prisma/client'
import type { Response, Router } from 'express'
import { z } from 'zod'
import { sendError, type ErrorCode } from '../../src/http/errors.js'
import { requireOrigin } from '../../src/http/origin.js'
import { ownRegistrationWhere, ownedEventWhere } from '../../src/domain/actor.js'
import { requireAuth, requireRole } from '../../src/http/guards.js'
import { parseId, validate } from '../../src/http/validate.js'
import { TEST_ORIGIN } from './app.js'

/**
 * Probe routes for I-02 (contracts v1.2 §2). They exist only in tests, mounted through createApp's
 * `extraRoutes`, so the production app never has them. They run the real shared pipeline
 * (JSON parsing, origin check, zod validation, error handler) before the real endpoints exist.
 */

/** Same field names and types as the E-06 body, cut down to the three fields AC-SR2-02 sends. */
export const probeEventSchema = z
  .object({
    title: z.string().min(1),
    capacity: z.number().int().min(1).max(256),
    startAt: z.iso.datetime(),
  })
  .strict()

/** Text a careless error handler would leak: SQL, an ORM name, a file path and another user's email. */
export const LEAKY_ERROR_TEXT =
  'SELECT "email" FROM "User" WHERE "email" = \'mint@player.example\' failed in prisma at /home/user/server/src/db.ts:12'

export function probeRoutes(api: Router) {
  // POST-only, state-changing shape: origin check, then validation (SDS §2.3 order without auth).
  api.post('/__test/echo', requireOrigin(TEST_ORIGIN), validate({ body: probeEventSchema }), (_req, res) => {
    res.status(201).json(res.locals.body)
  })
  // Sends any catalogue error, for codes whose real endpoints arrive in later Issues (401, 409).
  api.get('/__test/error/:code', (req, res) => {
    sendError(res, req.params.code as ErrorCode)
  })
  // The forced 500 of STS §1.4.
  api.get('/__test/boom', () => {
    throw new Error(LEAKY_ERROR_TEXT)
  })
  // A protected route behind the real requireAuth (I-04, contracts v1.3 §4): stands in for E-09 and E-10 in
  // TEST-A-04 until I-08 and I-10 add those endpoints.
  api.get('/__test/protected', requireAuth, (req, res) => {
    res.json({ actorId: req.actor!.id })
  })
}

/** POST-only paths, for the "GET on a POST-only path answers 404" check. */
export const PROBE_POST_ONLY = ['/api/__test/echo']

/**
 * Stand-ins for E-06 … E-11 until I-07 … I-11 build them (I-06, contracts v1.5 §5). Each probe runs the guard
 * chain and the ownership helper its endpoint must use, then answers with a minimal body. TEST-B-01 … 03 call
 * them through `PROBE_PATHS`; each later Issue points its rows at the real path, and I-12 checks none are left.
 */
export function accessProbes(db: PrismaClient) {
  return (api: Router) => {
    const organizer = [requireAuth, requireRole('ORGANIZER')]
    const participant = [requireAuth, requireRole('PARTICIPANT')]
    const pathId = (raw: unknown, res: Response) => {
      const id = parseId(raw)
      if (id === null) sendError(res, 'INVALID_PATH_PARAMETER')
      return id
    }

    // E-06 create event: organizer; owner comes from the session, never the body.
    api.post('/__test/e-06', ...organizer, requireOrigin(TEST_ORIGIN), validate({ body: probeEventSchema }), async (req, res) => {
      const { title, capacity, startAt } = res.locals.body as z.infer<typeof probeEventSchema>
      const start = new Date(startAt)
      const event = await db.event.create({
        data: {
          organizerId: req.actor!.id,
          title,
          capacity,
          startAt: start,
          endAt: new Date(start.getTime() + 60 * 60 * 1000),
          type: 'CASUAL',
          format: 'CONSTRUCTED',
          venueName: 'Probe Venue',
          venueAddress: '1 Probe Road',
          city: 'Bangkok',
          publishedAt: start,
        },
      })
      res.status(201).json({ id: event.id })
    })
    // E-07 own dashboard: organizer; own events only.
    api.get('/__test/e-07', ...organizer, async (req, res) => {
      res.json({ items: await db.event.findMany({ where: { organizerId: req.actor!.id }, select: { id: true } }) })
    })
    // E-08 registration list: organizer + owner; another organizer's event is a 404.
    api.get('/__test/e-08/:id', ...organizer, async (req, res) => {
      const id = pathId(req.params.id, res)
      if (id === null) return
      const event = await db.event.findFirst({ where: ownedEventWhere(req.actor!, id) })
      if (!event) return sendError(res, 'EVENT_NOT_FOUND')
      res.json({ items: [] })
    })
    // E-09 register: participant; the participant comes from the session, never the body.
    api.post('/__test/e-09/:id', ...participant, requireOrigin(TEST_ORIGIN), validate({ body: z.object({}).strict() }), async (req, res) => {
      const id = pathId(req.params.id, res)
      if (id === null) return
      const registration = await db.registration.create({ data: { eventId: id, participantId: req.actor!.id } })
      res.status(201).json({ id: registration.id })
    })
    // E-10 my registrations: participant; own only.
    api.get('/__test/e-10', ...participant, async (req, res) => {
      res.json({ items: await db.registration.findMany({ where: { participantId: req.actor!.id }, select: { id: true } }) })
    })
    // E-11 one registration: participant + own; someone else's is a 404.
    api.get('/__test/e-11/:id', ...participant, async (req, res) => {
      const id = pathId(req.params.id, res)
      if (id === null) return
      const registration = await db.registration.findFirst({ where: ownRegistrationWhere(req.actor!, id) })
      if (!registration) return sendError(res, 'REGISTRATION_NOT_FOUND')
      res.json({ id: registration.id })
    })
  }
}

/** Where each Sprint 1 endpoint is reached today: the real path, or its I-06 probe until its Issue lands. */
export const PROBE_PATHS = {
  'E-06': '/api/__test/e-06',
  'E-07': '/api/__test/e-07',
  'E-08': (id: number | string) => `/api/__test/e-08/${id}`,
  'E-09': (id: number | string) => `/api/__test/e-09/${id}`,
  'E-10': '/api/__test/e-10',
  'E-11': (id: number | string) => `/api/__test/e-11/${id}`,
}
