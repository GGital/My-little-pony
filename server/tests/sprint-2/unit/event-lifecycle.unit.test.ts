import { describe, expect, it } from 'vitest'
import { decidePublish } from '../../../src/domain/event-lifecycle.js'

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
