import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetNow, setNow } from '../../../src/clock.js'
import { decideCancellation, type CancellationFacts } from '../../../src/domain/registration-rules.js'

// TEST-N-04 (U) · AC-N-04, BR-11 (Sprint 2 contracts §5): the E-16 rules after the owner is found, in contract
// order: ALREADY_CANCELLED → ALREADY_CHECKED_IN → REGISTRATION_CLOSED → OK. Pure: the clock is fixed.
const T = new Date('2030-03-01T08:00:00.000Z')
const HOUR = 3_600_000
const open: CancellationFacts = {
  registrationStatus: 'REGISTERED',
  eventStatus: 'PUBLISHED',
  startAt: new Date(T.getTime() + 24 * HOUR),
  registrationDeadline: null,
}

beforeEach(() => setNow(T))
afterEach(() => resetNow())

describe('TEST-N-04 (U) decideCancellation (AC-N-04, BR-11)', () => {
  it('lets a REGISTERED row on an open event cancel', () => {
    expect(decideCancellation(open)).toBe('OK')
  })

  it.each(['CANCELLED', 'EVENT_CANCELLED'] as const)('%s → ALREADY_CANCELLED, even when the event is closed', (registrationStatus) => {
    expect(decideCancellation({ ...open, registrationStatus })).toBe('ALREADY_CANCELLED')
    expect(decideCancellation({ ...open, registrationStatus, eventStatus: 'CANCELLED' })).toBe('ALREADY_CANCELLED')
  })

  it('CHECKED_IN → ALREADY_CHECKED_IN, before the closed check', () => {
    expect(decideCancellation({ ...open, registrationStatus: 'CHECKED_IN' })).toBe('ALREADY_CHECKED_IN')
    expect(decideCancellation({ ...open, registrationStatus: 'CHECKED_IN', startAt: new Date(T.getTime() - HOUR) })).toBe('ALREADY_CHECKED_IN')
  })

  it('REGISTERED after the deadline or the start → REGISTRATION_CLOSED; at exactly the deadline it is closed (D-17)', () => {
    expect(decideCancellation({ ...open, registrationDeadline: new Date(T.getTime() - 1) })).toBe('REGISTRATION_CLOSED')
    expect(decideCancellation({ ...open, registrationDeadline: T })).toBe('REGISTRATION_CLOSED')
    expect(decideCancellation({ ...open, registrationDeadline: new Date(T.getTime() + 1) })).toBe('OK')
    expect(decideCancellation({ ...open, startAt: T })).toBe('REGISTRATION_CLOSED')
  })
})
