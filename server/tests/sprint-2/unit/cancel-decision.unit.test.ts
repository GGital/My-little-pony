import { describe, expect, it } from 'vitest'
import { decideCancel } from '../../../src/domain/event-lifecycle.js'

// TEST-O-04 (U) · AC-O-04 (Sprint 2 contracts §6): the E-15 checks after the owner is found. Pure rule.
const NOW = new Date('2030-03-01T08:00:00.000Z')
const min = (n: number) => new Date(NOW.getTime() + n * 60_000)

describe('TEST-O-04 (U) decideCancel: cancelled → draft → started → OK (contract check order)', () => {
  it('allows a published event that has not started', () => {
    expect(decideCancel({ status: 'PUBLISHED', startAt: min(1) }, NOW)).toEqual({ ok: true })
    expect(decideCancel({ status: 'PUBLISHED', startAt: min(24 * 60) }, NOW)).toEqual({ ok: true })
  })

  it('refuses a cancelled event first, even if it also started', () => {
    expect(decideCancel({ status: 'CANCELLED', startAt: min(-60) }, NOW)).toEqual({ ok: false, code: 'ALREADY_CANCELLED' })
  })

  it('refuses a draft, even if its start has passed', () => {
    expect(decideCancel({ status: 'DRAFT', startAt: min(-60) }, NOW)).toEqual({ ok: false, code: 'NOT_PUBLISHED' })
    expect(decideCancel({ status: 'DRAFT', startAt: min(60) }, NOW)).toEqual({ ok: false, code: 'NOT_PUBLISHED' })
  })

  it.each([
    ['1 minute ago', -1],
    ['exactly now', 0],
  ])('refuses a published event that started %s (startAt ≤ now)', (_label, minutes) => {
    expect(decideCancel({ status: 'PUBLISHED', startAt: min(minutes) }, NOW)).toEqual({ ok: false, code: 'EVENT_STARTED' })
  })
})
