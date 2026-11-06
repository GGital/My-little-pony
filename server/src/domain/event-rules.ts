import { now } from '../clock.js'

export type EventTimeValidationResult =
  | { valid: true }
  | { valid: false; field: 'startAt' | 'endAt'; message: string }

export function validateEventTimes(startAt: Date, endAt: Date): EventTimeValidationResult {
  // Minimal stub for TDD Red step: returns valid: true so assertion failures occur
  void now()
  void startAt
  void endAt
  return { valid: true }
}
