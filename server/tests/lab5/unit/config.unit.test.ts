import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../src/config.js'

const VALID = {
  DATABASE_URL: 'postgresql://user:not-a-real-password@localhost:5432/tcg_event_hub',
  APP_ORIGIN: 'http://localhost:5173',
}

// Cloud Run answers on two URLs (the deterministic one and status.url), so APP_ORIGIN may list both.
describe('TEST-L5-03 (U) — APP_ORIGIN accepts a comma-separated list of origins', () => {
  it('loads a list of two origins', () => {
    const list = 'https://tcg-event-hub-123.asia-southeast1.run.app,https://tcg-event-hub-abc-as.a.run.app'
    expect(loadConfig({ ...VALID, APP_ORIGIN: list }).APP_ORIGIN).toBe(list)
  })

  it.each([
    ['an entry that is not an origin', 'https://a.run.app,not-an-origin'],
    ['an entry with a path', 'https://a.run.app,https://b.run.app/app'],
    ['an empty entry', 'https://a.run.app,'],
    ['a space after the comma', 'https://a.run.app, https://b.run.app'],
  ])('throws naming APP_ORIGIN for %s', (_name, value) => {
    expect(() => loadConfig({ ...VALID, APP_ORIGIN: value })).toThrow(/APP_ORIGIN/)
  })
})
