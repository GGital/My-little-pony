import { describe, expect, it } from 'vitest'
import { lockedUntil } from '../../../src/domain/throttle.js'

// Feature-T: sign-in throttling (Sprint 3 contracts §5; NFR-16, D-29). Pure rule: no database.
const F = new Date('2030-03-01T08:00:00.000Z')
const at = (ms: number) => new Date(F.getTime() + ms)
const SEC = 1000
const MIN = 60 * SEC
// Five failures, the 5th at F.
const FIVE = [at(-4 * MIN), at(-3 * MIN), at(-2 * MIN), at(-1 * MIN), F]

describe('TEST-T-02 (U) lockedUntil: 5 failures in 10 minutes lock until the 5th-newest is 10 minutes old (AC-T-02, D-29)', () => {
  it('is not locked with none, or four, failures', () => {
    expect(lockedUntil([], F)).toBeNull()
    expect(lockedUntil(FIVE.slice(1), F)).toBeNull()
  })

  it('is locked at the 5th failure, until it is 10 minutes old', () => {
    expect(lockedUntil(FIVE, F)).toEqual(at(10 * MIN))
  })

  it('is still locked one second before the end, and free exactly at F + 10 min', () => {
    expect(lockedUntil(FIVE, at(10 * MIN - SEC))).toEqual(at(10 * MIN))
    expect(lockedUntil(FIVE, at(10 * MIN))).toBeNull()
  })

  it('ignores failures that are already 10 minutes old or older', () => {
    const old = [at(-20 * MIN), at(-15 * MIN), at(-12 * MIN), at(-11 * MIN), at(-10 * MIN)]
    expect(lockedUntil(old, F)).toBeNull()
    expect(lockedUntil([...old.slice(0, 4), at(-9 * MIN)], F)).toBeNull()
  })

  it('with more than 5 failures, the lock ends when the 5th-newest turns 10 minutes old', () => {
    const six = [at(-9 * MIN), ...FIVE.slice(0, 4), F]
    expect(lockedUntil(six, F)).toEqual(at(-4 * MIN + 10 * MIN))
  })
})
