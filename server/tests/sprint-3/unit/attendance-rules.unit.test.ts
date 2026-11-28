import { describe, expect, it } from 'vitest'
import { checkInWindow, decideCheckIn, decideUndo, isCheckInOpen } from '../../../src/domain/attendance-rules.js'

// TEST-P-02 (U) and TEST-P-04 (U) · Feature-P (Sprint 3 contracts §0.1, §1). The check-in window is
// `startAt − 60 min ≤ now < endAt` (D-26); E-18 and E-19 check the window first, then the registration's status.
const MIN = 60_000
const S = new Date('2030-03-01T09:00:00.000Z') // start: 16:00 Bangkok
const E = new Date('2030-03-01T14:00:00.000Z') // end: 21:00 Bangkok
const event = { startAt: S, endAt: E }
const at = (base: Date, minutes: number) => new Date(base.getTime() + minutes * MIN)

describe('TEST-P-02 (U) isCheckInOpen at the window boundaries (AC-P-02, BR-18, D-26)', () => {
  it.each([
    ['S − 61 min', at(S, -61), false],
    ['S − 60 min (opens exactly here)', at(S, -60), true],
    ['S − 59 min', at(S, -59), true],
    ['E − 1 min', at(E, -1), true],
    ['E (closed exactly here)', E, false],
    ['E + 1 min', at(E, 1), false],
  ])('%s → %s', (_label, now, open) => {
    expect(isCheckInOpen(event, now)).toBe(open)
  })

  it('checkInWindow gives the state and both edges, so the page never compares times itself', () => {
    expect(checkInWindow(event, at(S, -61))).toEqual({ open: false, state: 'NOT_YET', opensAt: at(S, -60).toISOString(), closesAt: E.toISOString() })
    expect(checkInWindow(event, at(S, -60))).toEqual({ open: true, state: 'OPEN', opensAt: at(S, -60).toISOString(), closesAt: E.toISOString() })
    expect(checkInWindow(event, E)).toEqual({ open: false, state: 'CLOSED', opensAt: at(S, -60).toISOString(), closesAt: E.toISOString() })
  })
})

describe('TEST-P-04 (U) decideCheckIn and decideUndo per status (AC-P-04, BR-18, BR-19)', () => {
  const inWindow = at(S, 10)
  const outside = at(S, -61)

  it.each([
    ['REGISTERED', 'OK'],
    ['CHECKED_IN', 'ALREADY_CHECKED_IN'],
    ['CANCELLED', 'REGISTRATION_NOT_ACTIVE'],
    ['EVENT_CANCELLED', 'REGISTRATION_NOT_ACTIVE'],
  ] as const)('check in a %s registration inside the window → %s', (status, decision) => {
    expect(decideCheckIn({ registrationStatus: status, ...event }, inWindow)).toBe(decision)
  })

  it.each([
    ['CHECKED_IN', 'OK'],
    ['REGISTERED', 'NOT_CHECKED_IN'],
    ['CANCELLED', 'NOT_CHECKED_IN'],
    ['EVENT_CANCELLED', 'NOT_CHECKED_IN'],
  ] as const)('undo a %s registration inside the window → %s', (status, decision) => {
    expect(decideUndo({ registrationStatus: status, ...event }, inWindow)).toBe(decision)
  })

  it('outside the window both answer NOT_IN_CHECK_IN_WINDOW first, whatever the status (contract check order)', () => {
    for (const status of ['REGISTERED', 'CHECKED_IN', 'CANCELLED', 'EVENT_CANCELLED'] as const) {
      expect(decideCheckIn({ registrationStatus: status, ...event }, outside), status).toBe('NOT_IN_CHECK_IN_WINDOW')
      expect(decideUndo({ registrationStatus: status, ...event }, E), status).toBe('NOT_IN_CHECK_IN_WINDOW')
    }
  })
})
