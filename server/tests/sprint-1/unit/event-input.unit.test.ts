import { describe, expect, it } from 'vitest'
import { createEventInputSchema } from '../../../src/domain/events.create.js'

describe('TEST-D-02 (U) & TEST-D-04 (U) — Event input schema validation (BR-01, BR-03, AC-D-02, AC-D-04)', () => {
  const VALID_BASE = {
    title: 'Friday Night Constructed',
    type: 'CASUAL',
    format: 'CONSTRUCTED',
    venueName: 'Quantum Cards',
    venueAddress: '1631 Kanchanaphisek Rd',
    city: 'Bangkok',
    startAt: '2026-11-07T10:00:00.000Z',
    endAt: '2026-11-07T14:00:00.000Z',
    capacity: 24,
  }

  describe('TEST-D-02 (U) — Capacity validation (BR-01, AC-D-02)', () => {
    it.each([
      [0, '0'],
      [-1, 'negative number -1'],
      [1.5, 'fractional number 1.5'],
      [257, '257 (> 256)'],
      ['24', 'string "24"'],
      [null, 'null'],
    ])('rejects capacity = %s (%s) with exact message: Capacity must be a whole number from 1 to 256.', (cap) => {
      const res = createEventInputSchema.safeParse({ ...VALID_BASE, capacity: cap })
      expect(res.success).toBe(false)
      if (!res.success) {
        const capErr = res.error.issues.find((i) => i.path.includes('capacity'))
        expect(capErr).toBeDefined()
        expect(capErr?.message).toBe('Capacity must be a whole number from 1 to 256.')
      }
    })

    it.each([1, 256])('accepts boundary capacity = %d', (cap) => {
      const res = createEventInputSchema.safeParse({ ...VALID_BASE, capacity: cap })
      expect(res.success).toBe(true)
    })
  })

  describe('TEST-D-04 (U) — Field rules and missing fields (BR-03, AC-D-04)', () => {
    it('reports every failing field in one response when all required fields are missing', () => {
      const res = createEventInputSchema.safeParse({})
      expect(res.success).toBe(false)
      if (!res.success) {
        const fields = res.error.issues.map((i) => i.path[0]).sort()
        const required = ['capacity', 'city', 'endAt', 'format', 'startAt', 'title', 'type', 'venueAddress', 'venueName'].sort()
        expect(fields).toEqual(required)
      }
    })

    it('whitespace-only strings count as missing', () => {
      const res = createEventInputSchema.safeParse({
        ...VALID_BASE,
        title: '   ',
        venueName: '   ',
        venueAddress: '   ',
        city: '   ',
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        const errFields = res.error.issues.map((i) => i.path[0])
        expect(errFields).toContain('title')
        expect(errFields).toContain('venueName')
        expect(errFields).toContain('venueAddress')
        expect(errFields).toContain('city')
      }
    })

    it('rejects title shorter than 3 chars ("ab") with "Use 3 to 100 characters for the title."', () => {
      const res = createEventInputSchema.safeParse({ ...VALID_BASE, title: 'ab' })
      expect(res.success).toBe(false)
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.includes('title'))
        expect(issue?.message).toBe('Use 3 to 100 characters for the title.')
      }
    })

    it('rejects title longer than 100 chars (101 chars) with "Use 3 to 100 characters for the title."', () => {
      const res = createEventInputSchema.safeParse({ ...VALID_BASE, title: 'a'.repeat(101) })
      expect(res.success).toBe(false)
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.includes('title'))
        expect(issue?.message).toBe('Use 3 to 100 characters for the title.')
      }
    })

    it('accepts title of 3 chars and 100 chars', () => {
      expect(createEventInputSchema.safeParse({ ...VALID_BASE, title: 'abc' }).success).toBe(true)
      expect(createEventInputSchema.safeParse({ ...VALID_BASE, title: 'a'.repeat(100) }).success).toBe(true)
    })

    it('rejects description longer than 2,000 chars (2,001 chars) with "Use up to 2,000 characters."', () => {
      const res = createEventInputSchema.safeParse({ ...VALID_BASE, description: 'a'.repeat(2001) })
      expect(res.success).toBe(false)
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.includes('description'))
        expect(issue?.message).toBe('Use up to 2,000 characters.')
      }
    })

    it('accepts description up to 2,000 chars', () => {
      expect(createEventInputSchema.safeParse({ ...VALID_BASE, description: 'a'.repeat(2000) }).success).toBe(true)
    })

    it('rejects unknown keys (.strict()) with "This value cannot be set."', () => {
      const res = createEventInputSchema.safeParse({ ...VALID_BASE, organizerId: 99 })
      expect(res.success).toBe(false)
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.includes('organizerId'))
        expect(issue?.message).toBe('This value cannot be set.')
      }
    })
  })
})
