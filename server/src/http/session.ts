import type { RequestHandler } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Role } from '@prisma/client'

/** The signed-in caller (contracts §5 Behaviour 1). */
export type Actor = { id: number; role: Role; displayName: string }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor
      sessionToken?: string
    }
  }
}

// I-04 red stub: compiles, does nothing yet.
export function loadSession(_db: PrismaClient): RequestHandler {
  return (_req, _res, next) => next()
}

export const requireAuth: RequestHandler = (_req, _res, next) => next()
