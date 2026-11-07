import type { RequestHandler } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Actor } from '../domain/actor.js'
import { findSessionUser } from '../domain/auth.js'

export const SESSION_COOKIE = 'tcg.sid'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor
      /** The raw cookie token of the current session; only sign-out needs it. */
      sessionToken?: string
    }
  }
}

/** One cookie from the Cookie header. A few lines instead of a cookie-parser dependency. */
function readCookie(header: string | undefined, name: string) {
  for (const part of header?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
  return undefined
}

/**
 * SDS §2.3 step 2, on every request: a valid `tcg.sid` cookie sets `req.actor`. A missing, malformed,
 * unknown or expired cookie leaves the caller signed out; it is never an error by itself.
 */
export function loadSession(db: PrismaClient): RequestHandler {
  return async (req, _res, next) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE)
    const user = token ? await findSessionUser(db, token) : null
    if (user) {
      req.actor = { id: user.id, role: user.role, displayName: user.displayName }
      req.sessionToken = token
    }
    next()
  }
}
