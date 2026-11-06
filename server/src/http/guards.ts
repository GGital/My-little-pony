import type { Role } from '@prisma/client'
import type { RequestHandler } from 'express'
import { sendError } from './errors.js'

/** SDS §2.3 step 3: 401 UNAUTHENTICATED without a session. */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.actor) return sendError(res, 'UNAUTHENTICATED')
  next()
}

// I-06 red stub: lets every role through.
export function requireRole(_role: Role): RequestHandler {
  return (_req, _res, next) => next()
}
