import { now } from '../clock.js'

export type EventTimeValidationResult =
  | { valid: true }
  | { valid: false; field: 'startAt' | 'endAt'; message: string }

/**
 * Enforces business rule BR-02 (event time rules, contracts §7):
 * 1. startAt must be in the future (startAt > now()).
 * 2. endAt must be strictly after startAt (endAt > startAt).
 * 3. Event can last at most 24 hours (endAt <= startAt + 24 h).
 */
export function validateEventTimes(startAt: Date, endAt: Date): EventTimeValidationResult {
  const referenceNow = now()

  if (startAt.getTime() <= referenceNow.getTime()) {
    return { valid: false, field: 'startAt', message: 'The start must be in the future.' }
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
