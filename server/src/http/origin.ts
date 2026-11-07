import type { RequestHandler } from 'express'
import { sendError } from './errors.js'

/**
 * Cross-site request defence for POST/PATCH/DELETE (SDS §6.1): the Origin header must equal APP_ORIGIN.
 * Mount it right after requireAuth, so a signed-out caller still gets 401 first.
 */
export function requireOrigin(appOrigin: string): RequestHandler {
  return (req, res, next) => {
    if (req.get('origin') !== appOrigin) return sendError(res, 'FORBIDDEN')
    next()
  }
}
