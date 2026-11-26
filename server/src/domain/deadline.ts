import type { EventStatus } from '@prisma/client'

// Stubs for the red run (S2-06 commit A); the rules are written in commit B.
export type DeadlineFacts = { status: EventStatus; startAt: Date; registrationDeadline: Date | null }
export function effectiveDeadline(e: Pick<DeadlineFacts, 'startAt' | 'registrationDeadline'>): Date {
  return e.startAt
}
export function isRegistrationOpen(_e: DeadlineFacts, _at: Date): boolean {
  return true
}
export function decideDeadline(_deadline: Date | null, _startAt: Date, _at: Date): { field: 'registrationDeadline'; message: string } | null {
  return null
}
