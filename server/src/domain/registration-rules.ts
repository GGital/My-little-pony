import type { EventStatus } from '@prisma/client'
import { hasStarted } from './time.js'

export type RegistrationDecision = 'OK' | 'REGISTRATION_CLOSED' | 'ALREADY_REGISTERED' | 'EVENT_FULL'

export type RegistrationFacts = {
  status: EventStatus
  startAt: Date
  capacity: number
  /** Active registrations (REGISTERED or CHECKED_IN) on the event, counted inside the locked transaction. */
  active: number
  /** The caller already holds an active registration on the event. */
  alreadyRegistered: boolean
}

/**
 * The registration rules in the order of contracts §10: closed (BR-04: started, or not published) →
 * already registered (BR-06) → full (BR-05) → OK. The time comes from the server clock (SR-03).
 */
export function decideRegistration(facts: RegistrationFacts): RegistrationDecision {
  if (facts.status !== 'PUBLISHED' || hasStarted(facts.startAt)) return 'REGISTRATION_CLOSED'
  if (facts.alreadyRegistered) return 'ALREADY_REGISTERED'
  if (facts.active >= facts.capacity) return 'EVENT_FULL'
  return 'OK'
}
