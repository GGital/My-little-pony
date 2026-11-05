import type { Router } from 'express'
import { z } from 'zod'
import { sendError, type ErrorCode } from '../../src/http/errors.js'
import { requireOrigin } from '../../src/http/origin.js'
import { requireAuth } from '../../src/http/session.js'
import { validate } from '../../src/http/validate.js'
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
