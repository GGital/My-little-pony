import type { RequestHandler } from 'express'
import { sendError } from './errors.js'

/**
 * Cross-site request defence for POST/PATCH/DELETE (SDS §6.1): the Origin header must equal one of the
 * comma-separated origins in APP_ORIGIN (Cloud Run answers on two URLs, Lab 5).
 * Mount it right after requireAuth, so a signed-out caller still gets 401 first.
 */
export function requireOrigin(appOrigin: string): RequestHandler {
  const allowed = appOrigin.split(',')
  return (req, res, next) => {
    const origin = req.get('origin')
    if (!origin || !allowed.includes(origin)) return sendError(res, 'FORBIDDEN')
    next()
  }
}
