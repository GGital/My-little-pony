import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { sendError, type ErrorDetail } from './errors.js'

export type ValidateSchemas = { body?: z.ZodType; query?: z.ZodType }

/**
 * Parses the body and/or query with zod schemas (use `.strict()` so unknown fields fail, BR-17).
 * On failure: 400 VALIDATION_FAILED with one `details` entry per failing field, across both parts.
 * On success the parsed values are in `res.locals.body` / `res.locals.query`.
 */
// ponytail: path ids (INVALID_PATH_PARAMETER) are added by the first Issue with an `:id` route.
export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req, res, next) => {
    const details: ErrorDetail[] = []
    for (const part of ['query', 'body'] as const) {
      const schema = schemas[part]
      if (!schema) continue
      const result = schema.safeParse(req[part] ?? {})
      if (result.success) res.locals[part] = result.data
      else details.push(...toDetails(result.error, part))
    }
    if (details.length) return sendError(res, 'VALIDATION_FAILED', details)
    next()
  }
}

/** One entry per field (the first problem found); each unknown field gets its own entry. */
function toDetails(error: z.ZodError, part: string): ErrorDetail[] {
  const byField = new Map<string, string>()
  for (const issue of error.issues) {
    const at = issue.path.map(String)
    const entries: [string, string][] =
      issue.code === 'unrecognized_keys'
        ? issue.keys.map((key) => [[...at, key].join('.'), 'This field is not allowed.'])
        : [[at.join('.') || part, issue.message]]
    for (const [field, message] of entries) if (!byField.has(field)) byField.set(field, message)
  }
  return [...byField].map(([field, message]) => ({ field, message }))
}
