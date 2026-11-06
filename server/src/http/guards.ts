import type { Role } from '@prisma/client'
import type { RequestHandler } from 'express'
import { sendError } from './errors.js'

/** SDS §2.3 step 3: 401 UNAUTHENTICATED without a session. */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.actor) return sendError(res, 'UNAUTHENTICATED')
  next()
}

/**
 * SDS §2.3 step 4: 403 FORBIDDEN when the caller's role differs. Mount after requireAuth, and before any
 * ownership lookup, so a caller who is both the wrong role and not the owner gets 403, not 404 (AC-B-03).
 */
export function requireRole(role: Role): RequestHandler {
  return (req, res, next) => {
    if (req.actor?.role !== role) return sendError(res, 'FORBIDDEN')
    next()
  }
}
