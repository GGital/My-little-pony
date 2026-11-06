import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient, User } from '@prisma/client'
import { now } from '../clock.js'
import { HttpError } from '../http/errors.js'
import { hashPassword, verifyPassword } from './password.js'

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
 * INVALID_CREDENTIALS. Expired sessions of the user are removed in the same transaction.
 */
export async function signIn(db: PrismaClient, email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  const stored = user?.passwordHash ?? (await (dummyHash ??= hashPassword(randomBytes(16).toString('hex'))))
  const valid = await verifyPassword(password, stored)
  if (!user || !valid) throw new HttpError('INVALID_CREDENTIALS')

  const token = randomBytes(32).toString('base64url')
  const at = now()
  await db.$transaction([
    db.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: at } } }),
    db.session.create({
      data: { id: hashToken(token), userId: user.id, createdAt: at, expiresAt: new Date(at.getTime() + SESSION_MS) },
    }),
  ])
  return { user: toAuthUser(user), token }
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
