import type { ErrorRequestHandler, Response } from 'express'
import type { Logger } from '../log.js'

/**
 * The error catalogue (SDS §6.2). The code fixes the status; messages are safe to show to anyone.
 * Feature contracts may only use codes listed here.
 */
export const ERRORS = {
  VALIDATION_FAILED: { status: 400, message: 'Some details need fixing.' },
  INVALID_PATH_PARAMETER: { status: 400, message: "That link doesn't look right." },
  UNAUTHENTICATED: { status: 401, message: 'Please sign in to continue.' },
  INVALID_CREDENTIALS: { status: 401, message: "That email and password don't match." },
  FORBIDDEN: { status: 403, message: "You don't have access to that." },
  EVENT_NOT_FOUND: { status: 404, message: 'This event could not be found.' },
  REGISTRATION_NOT_FOUND: { status: 404, message: 'This registration could not be found.' },
  NOT_FOUND: { status: 404, message: 'There is nothing here.' },
  EVENT_FULL: { status: 409, message: 'This event filled up a moment ago, so no registration was made.' },
  ALREADY_REGISTERED: { status: 409, message: "You're already registered for this event." },
  REGISTRATION_CLOSED: { status: 409, message: 'Registration for this event has closed.' },
  CAPACITY_BELOW_REGISTERED: { status: 409, message: 'Capacity cannot be lower than the number of players registered.' },
  EVENT_STARTED: { status: 409, message: 'This event has already started.' },
  ALREADY_CANCELLED: { status: 409, message: 'This is already cancelled.' },
  NOT_IN_CHECK_IN_WINDOW: { status: 409, message: 'Check-in is not open right now.' },
  ALREADY_CHECKED_IN: { status: 409, message: 'This player is already checked in.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'That request is too large.' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'Requests must be sent as JSON.' },
  EVENT_TIME_INVALID: { status: 422, message: "Those event times don't work." },
  TOO_MANY_ATTEMPTS: { status: 429, message: 'Too many attempts. Please wait a few minutes and try again.' },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong. Please try again.' },
} as const satisfies Record<string, { status: number; message: string }>

export type ErrorCode = keyof typeof ERRORS
export type ErrorDetail = { field: string; message: string }

/** Thrown by services; the error handler turns it into the standard body. */
export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: ErrorDetail[],
  ) {
    super(code)
  }
}

/** The only way an error response is sent (contracts §2 item 1). */
export function sendError(res: Response, code: ErrorCode, details?: ErrorDetail[]) {
  if (!Object.hasOwn(ERRORS, code)) throw new Error(`Unknown error code: ${String(code)}`)
  const { status, message } = ERRORS[code]
  return res.status(status).json({ error: { code, message, ...(details?.length ? { details } : {}) } })
}

/** Error types raised by express.json() (body-parser) that are the client's fault, not ours. */
const BODY_PARSER_ERRORS: Record<string, ErrorCode> = {
  'entity.too.large': 'PAYLOAD_TOO_LARGE',
  'entity.parse.failed': 'VALIDATION_FAILED',
  'charset.unsupported': 'UNSUPPORTED_MEDIA_TYPE',
  'encoding.unsupported': 'UNSUPPORTED_MEDIA_TYPE',
}

/** The last handler (SDS §2.3 step 9). Unexpected errors are logged in full and answered with a safe 500. */
export function errorHandler(log: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) return next(err)
    if (err instanceof HttpError) return sendError(res, err.code, err.details)

    const parserCode = BODY_PARSER_ERRORS[(err as { type?: string } | null)?.type ?? '']
    if (parserCode === 'VALIDATION_FAILED') {
      return sendError(res, parserCode, [{ field: 'body', message: 'The request body is not valid JSON.' }])
    }
    if (parserCode) return sendError(res, parserCode)

    // Method and path only: never the body, cookies, headers or query string (NFR-03).
    log.error('request_failed', {
      method: req.method,
      path: req.path,
      error: err instanceof Error ? (err.stack ?? err.message) : String(err),
    })
    return sendError(res, 'INTERNAL_ERROR')
  }
}
