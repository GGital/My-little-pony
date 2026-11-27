import { describe, expect, it } from 'vitest'
import { validateStoreProfile } from '../../../src/domain/store-contact.js'

// TEST-U-05 (U) · AC-U-05, NFR-15 (Sprint 2 contracts §11.1): the pure store-profile rules, no database.
const MSG = {
  contactPhone: 'Enter a phone number, for example 02 555 0101.',
  contactEmail: 'Enter an email address, for example hello@store.example.',
  contactWebsite: 'Enter a web address starting with https://.',
  contactLine: 'Enter a LINE ID, for example @quantumcards.',
}
const errorsOf = (body: unknown) => {
  const r = validateStoreProfile(body)
  return r.ok ? null : r.errors
}
const dataOf = (body: unknown) => {
  const r = validateStoreProfile(body)
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.errors)}`)
  return r.data
}

describe('TEST-U-05 (U) validateStoreProfile', () => {
  it('trims every value and lower-cases the email', () => {
    expect(
      dataOf({
        contactPhone: ' 02 555 0101 ',
        contactEmail: ' Hello@QuantumCards.example ',
        contactWebsite: ' https://quantumcards.example/events ',
        contactLine: ' @quantumcards ',
      }),
    ).toEqual({
      contactPhone: '02 555 0101',
      contactEmail: 'hello@quantumcards.example',
      contactWebsite: 'https://quantumcards.example/events',
      contactLine: '@quantumcards',
    })
  })

  it('"" and null clear a field (stored as null); absent fields are not in the result', () => {
    expect(dataOf({ contactLine: '' })).toEqual({ contactLine: null })
    expect(dataOf({ contactPhone: null, contactEmail: '   ' })).toEqual({ contactPhone: null, contactEmail: null })
  })

  it.each([
    ['02 555 0101', true],
    ['+66 2 555 0101', true],
    ['(02) 555-0101', true],
    ['123456789', true],
    ['12345678', false], // 8 digits
    ['(02) 555-01', false], // 8 digits with separators
    ['abc', false],
    ['02 555 0101 ext 5', false],
    ['1'.repeat(21), false], // 21 characters
  ])('contactPhone %j is valid: %s', (value, ok) => {
    expect(errorsOf({ contactPhone: value })).toEqual(ok ? null : [{ field: 'contactPhone', message: MSG.contactPhone }])
  })

  it.each([
    ['hello@store.example', true],
    ['hello@', false],
    ['not an email', false],
    [`${'a'.repeat(250)}@x.io`, false], // over 254 characters
  ])('contactEmail %j is valid: %s', (value, ok) => {
    expect(errorsOf({ contactEmail: value })).toEqual(ok ? null : [{ field: 'contactEmail', message: MSG.contactEmail }])
  })

  it.each([
    ['https://quantumcards.example', true],
    ['http://quantumcards.example/a?b=1', true],
    ['javascript:alert(1)', false],
    ['data:text/html,<b>x</b>', false],
    ['ftp://store.example', false],
    ['quantumcards.example', false],
    [`https://${'a'.repeat(189)}.com`, false], // 201 characters
    [`https://${'a'.repeat(188)}.com`, true], // 200 characters
  ])('contactWebsite %j is valid: %s', (value, ok) => {
    expect(errorsOf({ contactWebsite: value })).toEqual(ok ? null : [{ field: 'contactWebsite', message: MSG.contactWebsite }])
  })

  it.each([
    ['@quantumcards', true],
    ['quantum.cards_1-x', true],
    ['@' + 'a'.repeat(39), true],
    ['@' + 'a'.repeat(40), false],
    ['my line id', false],
    ['@', false],
    ['@@x', false],
  ])('contactLine %j is valid: %s', (value, ok) => {
    expect(errorsOf({ contactLine: value })).toEqual(ok ? null : [{ field: 'contactLine', message: MSG.contactLine }])
  })

  it('reports every failing field together, in one list', () => {
    const errors = errorsOf({ contactPhone: 'abc', contactEmail: 'hello@', contactWebsite: 'javascript:alert(1)', contactLine: 'my line id' })
    expect(errors).toHaveLength(4)
    expect(errors).toEqual(
      expect.arrayContaining(Object.entries(MSG).map(([field, message]) => ({ field, message }))),
    )
  })

  it('{} (and a body of only unknown keys) is "Change at least one field."', () => {
    expect(JSON.stringify(errorsOf({}))).toContain('Change at least one field.')
    expect(errorsOf({ nope: 1 })).not.toBeNull()
  })

  it('games: unique, known values, at most 7; [] is allowed', () => {
    expect(dataOf({ games: ['POKEMON', 'MAGIC'] })).toEqual({ games: ['POKEMON', 'MAGIC'] })
    expect(dataOf({ games: [] })).toEqual({ games: [] })
    for (const games of [['POKEMON', 'POKEMON'], ['X'], 'POKEMON', [1], Array(8).fill('OTHER')]) {
      expect(errorsOf({ games })).toEqual([{ field: 'games', message: expect.any(String) }])
    }
  })

  it('markup in a value is kept as text, never stripped or parsed (NFR-15)', () => {
    expect(dataOf({ contactLine: '@ok' })).toEqual({ contactLine: '@ok' })
    expect(errorsOf({ contactWebsite: 'https://x.example/<b>bold</b>' })).toBeNull()
  })
})
