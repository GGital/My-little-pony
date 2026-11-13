import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../src/config.js'

const VALID = {
  DATABASE_URL: 'postgresql://user:not-a-real-password@localhost:5432/tcg_event_hub',
  APP_ORIGIN: 'http://localhost:5173',
}

describe('TEST-L5-06 (U) — GIT_SHA is the full commit SHA of the build, or "local"', () => {
  it('defaults to "local" when the image was not built by the pipeline', () => {
    expect(loadConfig({ ...VALID }).GIT_SHA).toBe('local')
  })

  it('keeps a full 40-character commit SHA', () => {
    const sha = 'a'.repeat(40)
    expect(loadConfig({ ...VALID, GIT_SHA: sha }).GIT_SHA).toBe(sha)
  })

  it.each([
    ['a short SHA', 'abc1234'],
    ['upper-case hex', 'A'.repeat(40)],
    ['anything else', 'latest'],
  ])('throws naming GIT_SHA for %s', (_name, value) => {
    expect(() => loadConfig({ ...VALID, GIT_SHA: value })).toThrow(/GIT_SHA/)
  })
})
