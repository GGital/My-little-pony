import type { RequestHandler } from 'express'
import type { z } from 'zod'

export type ValidateSchemas = { body?: z.ZodType; query?: z.ZodType }

// RED STUB (I-02 commit A): passes every request through unchecked.
export function validate(_schemas: ValidateSchemas): RequestHandler {
  return (_req, _res, next) => next()
}
