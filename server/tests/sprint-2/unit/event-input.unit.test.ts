import { describe, expect, it } from 'vitest'
import { cancelBody, REASON_MESSAGE } from '../../../src/domain/event-input.js'

// TEST-O-03 (U) · AC-O-03, BR-12 (Sprint 2 contracts §6): the cancel reason rule. Pure: no database, no clock.
const parse = (reason: unknown) => cancelBody.safeParse({ reason })

describe('TEST-O-03 (U) cancelBody: the reason is 5–200 characters after trimming (AC-O-03)', () => {
  it('accepts 5 and 200 characters and returns the trimmed text', () => {
    expect(parse('abcde')).toMatchObject({ success: true, data: { reason: 'abcde' } })
    expect(parse('x'.repeat(200))).toMatchObject({ success: true })
    expect(parse('   Store closed   ')).toMatchObject({ success: true, data: { reason: 'Store closed' } })
  })

  it.each([
    ['too short (4)', 'abcd'],
    ['too long (201)', 'x'.repeat(201)],
    ['only spaces', '     '],
    ['4 characters padded by spaces', '  abcd  '],
    ['a number', 12345],
    ['null', null],
    ['an object', { a: 1 }],
  ])('refuses a reason that is %s with the contract message', (_label, reason) => {
    const result = parse(reason)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(REASON_MESSAGE)
  })

  it('refuses a missing reason and any unknown field (strict body, BR-17)', () => {
    const missing = cancelBody.safeParse({})
    expect(missing.success).toBe(false)
    expect(missing.error?.issues[0]?.message).toBe(REASON_MESSAGE)
    expect(cancelBody.safeParse({ reason: 'abcde', status: 'PUBLISHED' }).success).toBe(false)
  })
})
