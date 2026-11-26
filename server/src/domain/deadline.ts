import type { EventStatus } from '@prisma/client'

/**
 * Feature-M, the registration deadline (Sprint 2 contracts §0.3, §4; BR-08, D-17). Pure rules: the caller passes the
 * server clock, so every boundary is testable.
 */
export type DeadlineFacts = { status: EventStatus; startAt: Date; registrationDeadline: Date | null }

/** The stored deadline, or the start when none is set. Always ≤ startAt (CHECK event_deadline_before_start). */
export function effectiveDeadline(e: Pick<DeadlineFacts, 'startAt' | 'registrationDeadline'>): Date {
  return e.registrationDeadline ?? e.startAt
}

/** §0.3: open = PUBLISHED and now < effective deadline. At exactly the deadline it is closed (D-17). */
export function isRegistrationOpen(e: DeadlineFacts, at: Date): boolean {
  return e.status === 'PUBLISHED' && at.getTime() < effectiveDeadline(e).getTime()
}

/** §4 rules for a deadline set on E-06 or E-13: at or before the (resulting) start, and still in the future. */
export function decideDeadline(deadline: Date | null, startAt: Date, at: Date): { field: 'registrationDeadline'; message: string } | null {
  if (deadline === null) return null
  if (deadline.getTime() > startAt.getTime()) {
    return { field: 'registrationDeadline', message: 'Registration must close at or before the start.' }
  }
  if (deadline.getTime() <= at.getTime()) return { field: 'registrationDeadline', message: 'The deadline must be in the future.' }
  return null
}
