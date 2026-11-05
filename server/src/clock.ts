/**
 * The server clock (contracts §3). Rule code calls now(), never `new Date()` or `Date.now()`, so tests can
 * fix the time and check boundaries exactly (at, one minute before, one minute after).
 */
let fixed: Date | null = null

export function now(): Date {
  return fixed ? new Date(fixed) : new Date()
}

/** Fixes the clock. Tests only: refuses outside NODE_ENV=test. */
export function setNow(at: Date): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('setNow() is only allowed when NODE_ENV=test')
  fixed = new Date(at)
}

export function resetNow(): void {
  fixed = null
}
