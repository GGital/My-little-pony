import type { EventStatus } from '@prisma/client'
import { now } from '../clock.js'
import { isRegistrationOpen } from './deadline.js'

export type RegistrationDecision = 'OK' | 'REGISTRATION_CLOSED' | 'ALREADY_REGISTERED' | 'EVENT_FULL'

export type RegistrationFacts = {
  status: EventStatus
  startAt: Date
  /** Sprint 2 Feature-M (BR-08): null or absent = registration closes at the start. */
  registrationDeadline?: Date | null
  capacity: number
  /** Active registrations (REGISTERED or CHECKED_IN) on the event, counted inside the locked transaction. */
  active: number
  /** The caller already holds an active registration on the event. */
  alreadyRegistered: boolean
}

/**
 * The registration rules in the order of contracts §10: closed (BR-04 + BR-08: not published, or at or after the
 * effective deadline, which is the start when none is set; Sprint 2 §0.3) →
 * already registered (BR-06) → full (BR-05) → OK. The time comes from the server clock (SR-03).
 */
export function decideRegistration(facts: RegistrationFacts): RegistrationDecision {
  const open = isRegistrationOpen({ ...facts, registrationDeadline: facts.registrationDeadline ?? null }, now())
  if (!open) return 'REGISTRATION_CLOSED'
  if (facts.alreadyRegistered) return 'ALREADY_REGISTERED'
  if (facts.active >= facts.capacity) return 'EVENT_FULL'
  return 'OK'
}

export type CancellationFacts = {
  registrationStatus: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED' | 'EVENT_CANCELLED'
  eventStatus: EventStatus
  startAt: Date
  registrationDeadline: Date | null
}

export type CancellationDecision = 'OK' | 'ALREADY_CANCELLED' | 'ALREADY_CHECKED_IN' | 'REGISTRATION_CLOSED'

export function decideCancellation(_facts: CancellationFacts): CancellationDecision {
  throw new Error('not implemented')
}
