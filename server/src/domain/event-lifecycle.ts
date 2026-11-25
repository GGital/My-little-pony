import type { EventStatus } from '@prisma/client'

export type PublishFacts = { status: EventStatus; startAt: Date; registrationDeadline: Date | null }
export type PublishDecision =
  | { ok: true }
  | { ok: false; code: 'ALREADY_CANCELLED' | 'ALREADY_PUBLISHED' }
  | { ok: false; code: 'EVENT_TIME_INVALID'; field: 'startAt' | 'registrationDeadline'; message: string }

/** Stub for the red run (S2-02 commit A): the rule is written in commit B. */
export function decidePublish(_facts: PublishFacts, _at: Date): PublishDecision {
  return { ok: true }
}
