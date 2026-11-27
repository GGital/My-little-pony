import { describe, expect, it } from 'vitest'
import { decideDeadline, effectiveDeadline, isRegistrationOpen } from '../../../src/domain/deadline.js'
import { decideRegistration } from '../../../src/domain/registration-rules.js'
import { resetNow, setNow } from '../../../src/clock.js'
import { afterEach } from 'vitest'

// Feature-M: the registration deadline (Sprint 2 contracts §0.3, §4; BR-08, D-17, D-23). Pure rules: no database.
const NOW = new Date('2030-03-01T08:00:00.000Z')
const min = (n: number) => new Date(NOW.getTime() + n * 60_000)
const START = min(24 * 60)

afterEach(() => resetNow())

describe('TEST-M-02 (U) decideDeadline: at or before the start, and still in the future (AC-M-02, BR-08)', () => {
  it('accepts no deadline, one before the start, and one exactly at the start', () => {
    expect(decideDeadline(null, START, NOW)).toBeNull()
    expect(decideDeadline(min(60), START, NOW)).toBeNull()
    expect(decideDeadline(START, START, NOW)).toBeNull()
  })

  it.each([
    ['1 minute after the start', new Date(START.getTime() + 60_000), 'Registration must close at or before the start.'],
    ['now', NOW, 'The deadline must be in the future.'],
    ['1 minute ago', min(-1), 'The deadline must be in the future.'],
  ])('refuses a deadline %s', (_label, deadline, message) => {
    expect(decideDeadline(deadline, START, NOW)).toEqual({ field: 'registrationDeadline', message })
  })
})

describe('§0.3 effectiveDeadline and isRegistrationOpen (BR-04 + BR-08, D-17)', () => {
  const event = (registrationDeadline: Date | null, status: 'PUBLISHED' | 'DRAFT' | 'CANCELLED' = 'PUBLISHED') => ({
    status,
    startAt: START,
    registrationDeadline,
  })

  it('the effective deadline is the stored one, or the start when none is set', () => {
    expect(effectiveDeadline(event(min(60)))).toEqual(min(60))
    expect(effectiveDeadline(event(null))).toEqual(START)
  })

  it('is open before the deadline and closed at and after it (D-17); never open unless PUBLISHED', () => {
    const d = min(60)
    expect([min(59), d, min(61)].map((at) => isRegistrationOpen(event(d), at))).toEqual([true, false, false])
    expect(isRegistrationOpen(event(null), new Date(START.getTime() - 1))).toBe(true)
    expect(isRegistrationOpen(event(null), START)).toBe(false)
    expect(isRegistrationOpen(event(d, 'DRAFT'), NOW)).toBe(false)
    expect(isRegistrationOpen(event(d, 'CANCELLED'), NOW)).toBe(false)
  })
})

describe('TEST-M-03 (U) decideRegistration closes at the deadline (AC-M-03, BR-08, D-17)', () => {
  const facts = { status: 'PUBLISHED' as const, startAt: START, registrationDeadline: min(60), capacity: 8, active: 2, alreadyRegistered: false }

  it.each([
    [59, 'OK'],
    [60, 'REGISTRATION_CLOSED'],
    [61, 'REGISTRATION_CLOSED'],
  ])('at deadline %s min → %s', (at, expected) => {
    setNow(min(at as number))
    expect(decideRegistration(facts)).toBe(expected)
  })
})
