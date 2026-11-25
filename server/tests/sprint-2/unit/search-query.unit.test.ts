import { describe, expect, it } from 'vitest'
import { bangkokDayRange, escapeLikeWildcards, searchQuerySchema } from '../../../src/domain/search-query.js'

describe('TEST-J-02 (U) — search query unit tests (AC-J-02, FR-13, NFR-11, D-22)', () => {
  it('bangkokDayRange calculates correct UTC boundaries for Bangkok day', () => {
    // Bangkok is UTC+7. Day 2026-11-25 Bangkok starts at 2026-11-25 00:00:00 +07:00
    // In UTC, this is 2026-11-24 17:00:00.000Z.
    // The day ends at 2026-11-26 00:00:00 +07:00 (or 2026-11-25 17:00:00.000Z in UTC).
    const [start, end] = bangkokDayRange('2026-11-25')
    expect(start.toISOString()).toBe('2026-11-24T17:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-25T17:00:00.000Z')
  })

  it('escapeLikeWildcards escapes % and _ literally', () => {
    expect(escapeLikeWildcards('50%_off')).toBe('50\\%\\_off')
    expect(escapeLikeWildcards('plain text')).toBe('plain text')
    expect(escapeLikeWildcards('100%')).toBe('100\\%')
    expect(escapeLikeWildcards('under_score')).toBe('under\\_score')
  })

  describe('searchQuerySchema validation', () => {
    it('accepts empty/absent query', () => {
      const res = searchQuerySchema.safeParse({})
      expect(res.success).toBe(true)
    })

    it('accepts valid text query and trims whitespace', () => {
      const res = searchQuerySchema.safeParse({ q: '  quantum  ' })
      expect(res.success).toBe(true)
      if (res.success) {
        expect((res.data as { q?: string }).q).toBe('quantum')
      }
    })

    it('rejects text query over 100 characters', () => {
      const res = searchQuerySchema.safeParse({ q: 'a'.repeat(101) })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error.issues[0].path).toContain('q')
      }
    })

    it('accepts valid event type and rejects invalid type', () => {
      expect(searchQuerySchema.safeParse({ type: 'CASUAL' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ type: 'TOURNAMENT' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ type: 'RELEASE' }).success).toBe(true)

      const bad = searchQuerySchema.safeParse({ type: 'PARTY' })
      expect(bad.success).toBe(false)
      if (!bad.success) {
        expect(bad.error.issues[0].path).toContain('type')
      }
    })

    it('accepts valid format and rejects invalid format', () => {
      expect(searchQuerySchema.safeParse({ format: 'CONSTRUCTED' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ format: 'SEALED' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ format: 'DRAFT' }).success).toBe(true)

      const bad = searchQuerySchema.safeParse({ format: 'STANDARD' })
      expect(bad.success).toBe(false)
      if (!bad.success) {
        expect(bad.error.issues[0].path).toContain('format')
      }
    })

    it('accepts valid dates and rejects non-calendar dates', () => {
      expect(searchQuerySchema.safeParse({ from: '2026-11-25', to: '2026-11-26' }).success).toBe(true)

      const bad = searchQuerySchema.safeParse({ from: '2026-02-30' })
      expect(bad.success).toBe(false)
      if (!bad.success) {
        expect(bad.error.issues[0].path).toContain('from')
      }
    })

    it('rejects from > to with message on to', () => {
      const bad = searchQuerySchema.safeParse({ from: '2026-12-05', to: '2026-12-01' })
      expect(bad.success).toBe(false)
      if (!bad.success) {
        const issue = bad.error.issues.find((i) => i.path.includes('to'))
        expect(issue).toBeDefined()
        expect(issue?.message).toBe('The end date must be on or after the start date.')
      }
    })

    it('validates seatsAvailable', () => {
      expect(searchQuerySchema.safeParse({ seatsAvailable: 'true' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ seatsAvailable: 'false' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ seatsAvailable: 'yes' }).success).toBe(false)
    })

    it('validates include parameter', () => {
      expect(searchQuerySchema.safeParse({ include: 'past' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ include: 'cancelled' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ include: 'past,cancelled' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ include: 'cancelled,past' }).success).toBe(true)

      const bad = searchQuerySchema.safeParse({ include: 'drafts' })
      expect(bad.success).toBe(false)
      if (!bad.success) {
        expect(bad.error.issues[0].path).toContain('include')
      }
    })

    it('validates page number', () => {
      expect(searchQuerySchema.safeParse({ page: '1' }).success).toBe(true)
      expect(searchQuerySchema.safeParse({ page: '20' }).success).toBe(true)

      expect(searchQuerySchema.safeParse({ page: '0' }).success).toBe(false)
      expect(searchQuerySchema.safeParse({ page: 'abc' }).success).toBe(false)
      expect(searchQuerySchema.safeParse({ page: '-5' }).success).toBe(false)
    })

    it('strictly rejects unrecognized query keys', () => {
      const res = searchQuerySchema.safeParse({ organizerId: '1', participantId: '3' })
      expect(res.success).toBe(false)
    })
  })
})
