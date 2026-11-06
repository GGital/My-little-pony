import type { EventStatus } from '@prisma/client'

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

// I-08 red stub: allows everything.
export function decideRegistration(_facts: RegistrationFacts): RegistrationDecision {
  return 'OK'
}
