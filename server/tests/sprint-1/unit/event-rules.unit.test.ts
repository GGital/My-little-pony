import { describe, expect, it } from 'vitest'
import { setNow, resetNow } from '../../../src/clock.js'
import { validateEventTimes } from '../../../src/domain/event-rules.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('TEST-D-03 (U) — Event time rules validation (BR-02, AC-D-03)', () => {
  const T = new Date('2026-11-06T10:00:00.000Z')

  it('rejects start equal to now (start = T) with startAt: The start must be in the future.', () => {
    setNow(T)
    try {
      const start = new Date(T)
      const end = new Date(start.getTime() + 4 * 60 * 60 * 1000)
      const res = validateEventTimes(start, end)
      expect(res.valid).toBe(false)
      if (!res.valid) {
        expect(res.field).toBe('startAt')
        expect(res.message).toBe('The start must be in the future.')
      }
    } finally {
      resetNow()
    }
  })

  it('rejects start in the past (start = T - 1 min) with startAt: The start must be in the future.', () => {
    setNow(T)
    try {
      const start = new Date(T.getTime() - 60 * 1000)
      const end = new Date(T.getTime() + 2 * 60 * 60 * 1000)
      const res = validateEventTimes(start, end)
      expect(res.valid).toBe(false)
      if (!res.valid) {
        expect(res.field).toBe('startAt')
        expect(res.message).toBe('The start must be in the future.')
      }
    } finally {
      resetNow()
    }
  })

  it('rejects end equal to start (end = start) with endAt: The end must be after the start.', () => {
    setNow(T)
    try {
      const start = new Date(T.getTime() + 60 * 60 * 1000)
      const end = new Date(start)
      const res = validateEventTimes(start, end)
      expect(res.valid).toBe(false)
      if (!res.valid) {
        expect(res.field).toBe('endAt')
        expect(res.message).toBe('The end must be after the start.')
      }
    } finally {
      resetNow()
    }
  })

  it('rejects end before start (end < start) with endAt: The end must be after the start.', () => {
    setNow(T)
    try {
      const start = new Date(T.getTime() + 60 * 60 * 1000)
      const end = new Date(start.getTime() - 60 * 1000)
      const res = validateEventTimes(start, end)
      expect(res.valid).toBe(false)
      if (!res.valid) {
        expect(res.field).toBe('endAt')
        expect(res.message).toBe('The end must be after the start.')
      }
    } finally {
      resetNow()
    }
  })

  it('rejects duration over 24 h (end = start + 24 h 1 min) with endAt: An event can last at most 24 hours.', () => {
    setNow(T)
    try {
      const start = new Date(T.getTime() + 60 * 60 * 1000)
      const end = new Date(start.getTime() + (24 * 60 + 1) * 60 * 1000)
      const res = validateEventTimes(start, end)
      expect(res.valid).toBe(false)
      if (!res.valid) {
        expect(res.field).toBe('endAt')
        expect(res.message).toBe('An event can last at most 24 hours.')
      }
    } finally {
      resetNow()
    }
  })

  it('accepts duration exactly 24 h (end = start + 24 h)', () => {
    setNow(T)
    try {
      const start = new Date(T.getTime() + 60 * 60 * 1000)
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      const res = validateEventTimes(start, end)
      expect(res.valid).toBe(true)
    } finally {
      resetNow()
    }
  })

  it('source check: event-rules.ts uses clock.now() and never calls Date.now() directly', () => {
    const file = readFileSync(resolve(__dirname, '../../../src/domain/event-rules.ts'), 'utf-8')
    expect(file).not.toMatch(/Date\.now\(\)/)
  })
})
