import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient, User } from '@prisma/client'
import { now } from '../clock.js'
import { HttpError } from '../http/errors.js'
import { hashPassword, verifyPassword } from './password.js'
import { findLock, lockEmail, recordAttempt } from './throttle.js'

/** Absolute session lifetime (NFR-04, SDS §8): 8 hours from sign-in, never extended. */
export const SESSION_MS = 8 * 60 * 60 * 1000

/** 32 random bytes in base64url are always 43 characters; anything else is not one of our tokens. */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/

/** The signed-in user as the API returns it (contracts §0.1). Never contains passwordHash. */
export type AuthUser = Pick<User, 'id' | 'displayName' | 'email' | 'role'>

export const toAuthUser = ({ id, displayName, email, role }: User): AuthUser => ({ id, displayName, email, role })

/** Only the SHA-256 of a token is stored, so a leaked Session table cannot sign anyone in (SD-07). */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

// An unknown email is checked against this, so it costs the same scrypt work as a wrong password (FR-02).
let dummyHash: Promise<string> | undefined

/**
 * E-01: checks the credentials and opens a session. Unknown email and wrong password throw the same
 * INVALID_CREDENTIALS. Five failures for one email in 10 minutes lock it: TOO_MANY_ATTEMPTS without checking the
 * password or recording the attempt (Feature-T, D-29). Expired sessions of the user are removed in the same transaction.
 */
export async function signIn(db: PrismaClient, email: string, password: string) {
  const normalized = email.trim().toLowerCase()
  // The advisory lock covers the check, the password work and the insert for this email; other emails run in parallel.
  return db.$transaction(
    async (tx) => {
      await lockEmail(tx, normalized)
      const at = now()
      const until = await findLock(tx, normalized, at)
      if (until) {
        const seconds = Math.ceil((until.getTime() - at.getTime()) / 1000)
        throw new HttpError('TOO_MANY_ATTEMPTS', undefined, { 'Retry-After': String(seconds) })
      }

      const user = await tx.user.findUnique({ where: { email: normalized } })
      const stored = user?.passwordHash ?? (await (dummyHash ??= hashPassword(randomBytes(16).toString('hex'))))
      const valid = await verifyPassword(password, stored)
      await recordAttempt(tx, normalized, !!user && valid, at)
      if (!user || !valid) return null

      const token = randomBytes(32).toString('base64url')
      await tx.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: at } } })
      await tx.session.create({
        data: { id: hashToken(token), userId: user.id, createdAt: at, expiresAt: new Date(at.getTime() + SESSION_MS) },
      })
      return { user: toAuthUser(user), token }
    },
    { timeout: 30_000, maxWait: 30_000 },
  ).then((result) => {
    if (!result) throw new HttpError('INVALID_CREDENTIALS')
    return result
  })
}

/** The user of an unexpired session, or null. A badly formed token is rejected without a database lookup. */
export async function findSessionUser(db: PrismaClient, token: string) {
  if (!TOKEN_FORMAT.test(token)) return null
  const session = await db.session.findFirst({
    where: { id: hashToken(token), expiresAt: { gt: now() } },
    include: { user: true },
  })
  return session?.user ?? null
}

/** E-02: deletes the session row, so the old token fails every later check (AC-A-04). */
export async function signOut(db: PrismaClient, token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } })
}
