import { describe, expect, it } from 'vitest'
import { decideCapacity, decideEditTimes, decidePublish, frozenFields } from '../../../src/domain/event-lifecycle.js'

// TEST-K-04 (U) · AC-K-04, BR-02, BR-08, D-21 (Sprint 2 contracts §2, v0.6 with CH-13). Pure rule: no database, no clock.
const NOW = new Date('2030-03-01T08:00:00.000Z')
const min = (n: number) => new Date(NOW.getTime() + n * 60_000)

describe('TEST-K-04 (U) decidePublish: the E-14 checks after the owner is found (AC-K-04, D-21)', () => {
  it('publishes a draft that starts at least 60 minutes from now and has no deadline', () => {
    expect(decidePublish({ status: 'DRAFT', startAt: min(60), registrationDeadline: null }, NOW)).toEqual({ ok: true })
    expect(decidePublish({ status: 'DRAFT', startAt: min(24 * 60), registrationDeadline: null }, NOW)).toEqual({ ok: true })
  })

  it('refuses a cancelled event first, then an already published one (contract check order)', () => {
    expect(decidePublish({ status: 'CANCELLED', startAt: min(-60), registrationDeadline: null }, NOW)).toEqual({
      ok: false,
      code: 'ALREADY_CANCELLED',
    })
    expect(decidePublish({ status: 'PUBLISHED', startAt: min(-60), registrationDeadline: null }, NOW)).toEqual({
      ok: false,
      code: 'ALREADY_PUBLISHED',
    })
  })

  it.each([
    ['in the past', -60],
    ['now', 0],
    ['in 30 minutes', 30],
    ['in 59 minutes', 59],
  ])('refuses a draft starting %s with EVENT_TIME_INVALID on startAt (CH-13)', (_label, minutes) => {
    expect(decidePublish({ status: 'DRAFT', startAt: min(minutes), registrationDeadline: null }, NOW)).toEqual({
      ok: false,
      code: 'EVENT_TIME_INVALID',
      field: 'startAt',
      message: 'The start must be at least 60 minutes from now.',
    })
  })

  it('refuses a draft whose registration deadline is now or has passed (BR-08), and accepts one still ahead', () => {
    const expected = {
      ok: false,
      code: 'EVENT_TIME_INVALID',
      field: 'registrationDeadline',
      message: 'The deadline must be in the future.',
    }
    expect(decidePublish({ status: 'DRAFT', startAt: min(120), registrationDeadline: NOW }, NOW)).toEqual(expected)
    expect(decidePublish({ status: 'DRAFT', startAt: min(120), registrationDeadline: min(-1) }, NOW)).toEqual(expected)
    expect(decidePublish({ status: 'DRAFT', startAt: min(120), registrationDeadline: min(1) }, NOW)).toEqual({ ok: true })
  })
})

// ---- Feature-L (S2-04): the E-13 rules after the owner is found (Sprint 2 contracts §3, v0.7) ----

describe('TEST-L-02 (U) decideCapacity: capacity never below the active registrations (AC-L-02, BR-09)', () => {
  it.each([
    [3, 3, 'OK'],
    [3, 30, 'OK'],
    [3, 2, 'CAPACITY_BELOW_REGISTERED'],
    [0, 1, 'OK'],
    [8, 7, 'CAPACITY_BELOW_REGISTERED'],
  ] as const)('%i active, new capacity %i → %s', (active, capacity, expected) => {
    expect(decideCapacity(active, capacity)).toBe(expected)
  })
})

describe('TEST-L-04 (U) decideEditTimes: BR-02 on the resulting start and end (AC-L-04, CH-13, D-23)', () => {
  const stored = { startAt: min(2 * 24 * 60), endAt: min(2 * 24 * 60 + 240), registrationDeadline: null }
  const start = stored.startAt

  it('accepts a body without times, a later start with its end, and an end exactly 24 h after the stored start', () => {
    expect(decideEditTimes(stored, {}, NOW)).toBeNull()
    expect(decideEditTimes(stored, { startAt: min(3 * 24 * 60), endAt: min(3 * 24 * 60 + 240) }, NOW)).toBeNull()
    expect(decideEditTimes(stored, { endAt: new Date(start.getTime() + 24 * 60 * 60_000) }, NOW)).toBeNull()
    expect(decideEditTimes(stored, { startAt: min(60) }, NOW)).toBeNull()
  })

  it.each([
    ['a start 1 minute ago', { startAt: min(-1) }, 'startAt', 'The start must be at least 60 minutes from now.'],
    ['a start 59 minutes away (CH-13)', { startAt: min(59) }, 'startAt', 'The start must be at least 60 minutes from now.'],
    ['an end at the stored start', { endAt: start }, 'endAt', 'The end must be after the start.'],
    ['an end 25 h after the stored start', { endAt: new Date(start.getTime() + 25 * 60 * 60_000) }, 'endAt', 'An event can last at most 24 hours.'],
    ['a start after the stored end', { startAt: min(2 * 24 * 60 + 300) }, 'endAt', 'The end must be after the start.'],
  ] as const)('refuses %s', (_label, body, field, message) => {
    expect(decideEditTimes(stored, body, NOW)).toEqual({ field, message })
  })

  it('refuses a new start earlier than the stored deadline (D-23), and checks no start lead time when only the end moves', () => {
    const withDeadline = { ...stored, registrationDeadline: min(20 * 60) }
    expect(decideEditTimes(withDeadline, { startAt: min(2 * 60), endAt: min(6 * 60) }, NOW)).toEqual({
      field: 'registrationDeadline',
      message: 'Registration must close at or before the start.',
    })
    const startingSoon = { startAt: min(30), endAt: min(270), registrationDeadline: null }
    expect(decideEditTimes(startingSoon, { endAt: min(300) }, NOW)).toBeNull()
  })
})

describe('TEST-L-05 (U) frozenFields: after the start only description, structure, contact and fee change (AC-L-05, BR-15, D-19)', () => {
  it('lists the frozen fields of the body, in body order, once the event has started', () => {
    expect(frozenFields(['description', 'feeLabel'], true)).toEqual([])
    expect(frozenFields(['capacity'], true)).toEqual(['capacity'])
    expect(frozenFields(['startAt', 'title', 'contact'], true)).toEqual(['startAt', 'title'])
  })

  it('freezes nothing before the start', () => {
    expect(frozenFields(['startAt', 'title', 'capacity', 'venueName'], false)).toEqual([])
  })
})
