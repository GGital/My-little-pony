import { now } from '../clock.js'

export type EventTimeValidationResult =
  | { valid: true }
  | { valid: false; field: 'startAt' | 'endAt'; message: string }

/** BR-02 lead time (CH-13): how long before its start an event must be created. */
export const MIN_LEAD_MINUTES = 60

/**
 * Enforces business rule BR-02 (event time rules, contracts §7):
 * 1. startAt must be at least MIN_LEAD_MINUTES after now (startAt >= now() + 60 min; CH-13, Lab 7, Issue #77).
 *    Until CH-13 the rule was startAt > now().
 * 2. endAt must be strictly after startAt (endAt > startAt).
 * 3. Event can last at most 24 hours (endAt <= startAt + 24 h).
 */
export function validateEventTimes(startAt: Date, endAt: Date): EventTimeValidationResult {
  const referenceNow = now()

  if (startAt.getTime() < referenceNow.getTime() + MIN_LEAD_MINUTES * 60 * 1000) {
    return { valid: false, field: 'startAt', message: 'The start must be at least 60 minutes from now.' }
  }

  if (endAt.getTime() <= startAt.getTime()) {
    return { valid: false, field: 'endAt', message: 'The end must be after the start.' }
  }

  const maxEndAt = startAt.getTime() + 24 * 60 * 60 * 1000
  if (endAt.getTime() > maxEndAt) {
    return { valid: false, field: 'endAt', message: 'An event can last at most 24 hours.' }
  }

  return { valid: true }
}
