/** Sign-in throttling rules (Sprint 3 contracts §5 Feature-T, NFR-16). */
export const MAX_FAILURES = 5
export const WINDOW_MS = 10 * 60 * 1000

/**
 * STUB (red commit): the real rule arrives in the implementation commit.
 * Will return when the lock ends, or null when `failures` (times of failed attempts) do not lock at `at`.
 */
export function lockedUntil(_failures: Date[], _at: Date): Date | null {
  return null
}
