import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetNow, setNow } from '../../../src/clock.js'
import { decideRegistration, type RegistrationFacts } from '../../../src/domain/registration-rules.js'

// The rule order of contracts §10: closed → already registered → full → OK.
const T = new Date('2026-11-07T10:00:00.000Z')
const MINUTE = 60_000
const open: RegistrationFacts = {
  status: 'PUBLISHED',
  startAt: new Date(T.getTime() + 60 * MINUTE),
  capacity: 24,
  active: 3,
  alreadyRegistered: false,
}

beforeEach(() => setNow(T))
afterEach(() => resetNow())

describe('TEST-G-02 (U) — a full event (BR-05)', () => {
  it('active = capacity → EVENT_FULL; one seat left → OK', () => {
    expect(decideRegistration({ ...open, capacity: 2, active: 2 })).toBe('EVENT_FULL')
    expect(decideRegistration({ ...open, capacity: 2, active: 1 })).toBe('OK')
  })
})

describe('TEST-G-04 (U) — registration closes when the event starts or is not published (BR-04)', () => {
  it.each([
    ['started 1 min ago', { startAt: new Date(T.getTime() - MINUTE) }],
    ['starting exactly now', { startAt: new Date(T.getTime()) }],
    ['a draft', { status: 'DRAFT' as const }],
    ['cancelled', { status: 'CANCELLED' as const }],
  ])('%s → REGISTRATION_CLOSED', (_label, change) => {
    expect(decideRegistration({ ...open, ...change })).toBe('REGISTRATION_CLOSED')
  })

  it('starting 1 min from now → OK', () => {
    expect(decideRegistration({ ...open, startAt: new Date(T.getTime() + MINUTE) })).toBe('OK')
  })
})

describe('Rule order (contracts §10 "Order of checks")', () => {
  it('already registered → ALREADY_REGISTERED, even when the event is also full', () => {
    expect(decideRegistration({ ...open, alreadyRegistered: true })).toBe('ALREADY_REGISTERED')
    expect(decideRegistration({ ...open, alreadyRegistered: true, capacity: 3, active: 3 })).toBe('ALREADY_REGISTERED')
  })

  it('closed beats already registered and full', () => {
    expect(
      decideRegistration({ ...open, startAt: new Date(T.getTime() - MINUTE), alreadyRegistered: true, capacity: 3, active: 3 }),
    ).toBe('REGISTRATION_CLOSED')
  })
})
