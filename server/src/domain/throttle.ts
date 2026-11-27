import type { PrismaClient } from '@prisma/client'

/** Sign-in throttling rules (Sprint 3 contracts §5 Feature-T, NFR-16). */
export const MAX_FAILURES = 5
export const WINDOW_MS = 10 * 60 * 1000
/** Attempts older than this are deleted at sign-in; they are not product records (X-11). */
export const KEEP_MS = 24 * 60 * 60 * 1000

/**
 * When the lock ends, or null when `failures` (times of failed attempts) do not lock at `at`.
 * Only failures less than 10 minutes old count; 5 of them lock until the 5th-newest is 10 minutes old (D-29).
 */
export function lockedUntil(failures: Date[], at: Date): Date | null {
  const cutoff = at.getTime() - WINDOW_MS
  const recent = failures
    .map((f) => f.getTime())
    .filter((t) => t > cutoff)
    .sort((a, b) => b - a)
  const fifth = recent[MAX_FAILURES - 1]
  return fifth === undefined ? null : new Date(fifth + WINDOW_MS)
}

/** The lock end for this (already normalised) email, read from PostgreSQL so it survives restarts. */
export async function findLock(db: PrismaClient, email: string, at: Date) {
  const rows = await db.loginAttempt.findMany({
    where: { email, succeeded: false, attemptedAt: { gt: new Date(at.getTime() - WINDOW_MS) } },
    orderBy: { attemptedAt: 'desc' },
    take: MAX_FAILURES,
    select: { attemptedAt: true },
  })
  return lockedUntil(rows.map((r) => r.attemptedAt), at)
}

/** Records one attempt and deletes attempts older than 24 hours (the only rows that may be deleted). */
export function recordAttempt(db: PrismaClient, email: string, succeeded: boolean, at: Date) {
  return db.$transaction([
    db.loginAttempt.create({ data: { email, succeeded, attemptedAt: at } }),
    db.loginAttempt.deleteMany({ where: { attemptedAt: { lt: new Date(at.getTime() - KEEP_MS) } } }),
  ])
}
