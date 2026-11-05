import express, { type RequestHandler } from 'express'
import { sendError } from './errors.js'

const parseJson = express.json({ limit: '100kb' })

/**
 * Step 1 of SDS §2.3. A request that carries a body must be JSON (else 415) and at most 100 kB (else 413,
 * raised by express.json and mapped by the error handler). A POST with no body, such as E-09, passes.
 */
export function jsonBody(): RequestHandler {
  return (req, res, next) => {
    const length = Number(req.headers['content-length'] ?? 0)
    const hasBody = length > 0 || req.headers['transfer-encoding'] !== undefined
    if (!hasBody) return next()
    if (!req.is('application/json')) return sendError(res, 'UNSUPPORTED_MEDIA_TYPE')
    parseJson(req, res, next)
  }
}
