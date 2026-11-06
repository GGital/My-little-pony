import type { PrismaClient } from '@prisma/client'
import type { Response, Router } from 'express'
import { z } from 'zod'
import { sendError, type ErrorCode } from '../../src/http/errors.js'
import { requireOrigin } from '../../src/http/origin.js'
import { ownedEventWhere } from '../../src/domain/actor.js'
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
}

/** POST-only paths, for the "GET on a POST-only path answers 404" check. */
export const PROBE_POST_ONLY = ['/api/__test/echo']

/**
 * Stand-ins for E-07 and E-08 until I-09 and I-11 build them (E-06, E-09 … E-11 are real since I-07, I-08,
 * I-10; I-06, contracts v1.5 §5). Each probe runs the guard
 * chain and the ownership helper its endpoint must use, then answers with a minimal body. TEST-B-01 … 03 call
 * them through `PROBE_PATHS`; each later Issue points its rows at the real path, and I-12 checks none are left.
 */
export function accessProbes(db: PrismaClient) {
  return (api: Router) => {
    const organizer = [requireAuth, requireRole('ORGANIZER')]
    const pathId = (raw: unknown, res: Response) => {
      const id = parseId(raw)
      if (id === null) sendError(res, 'INVALID_PATH_PARAMETER')
      return id
    }

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
  }
}

/** Where each Sprint 1 endpoint is reached today: the real path, or its I-06 probe until its Issue lands. */
export const PROBE_PATHS = {
  'E-07': '/api/__test/e-07',
  'E-08': (id: number | string) => `/api/__test/e-08/${id}`,
}
