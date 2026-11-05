import type { RequestHandler } from 'express'

// RED STUB (I-02 commit A): no origin check yet.
export function requireOrigin(_appOrigin: string): RequestHandler {
  return (_req, _res, next) => next()
}
