/**
 * Feature-P rules (Sprint 3 contracts §0.1, §1; D-26). Pure functions of the facts and a time, so the boundaries are
 * unit-tested exactly (TEST-P-02, P-04). Callers pass the server clock's now() (NFR-11).
 */
export type RegistrationStatusValue = 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED' | 'EVENT_CANCELLED'
export type CheckInFacts = { registrationStatus: RegistrationStatusValue; startAt: Date; endAt: Date }
export type CheckInWindow = { open: boolean; state: 'NOT_YET' | 'OPEN' | 'CLOSED'; opensAt: string; closesAt: string }
export type CheckInDecision = 'OK' | 'NOT_IN_CHECK_IN_WINDOW' | 'REGISTRATION_NOT_ACTIVE' | 'ALREADY_CHECKED_IN'
export type UndoDecision = 'OK' | 'NOT_IN_CHECK_IN_WINDOW' | 'NOT_CHECKED_IN'

const WINDOW_BEFORE_START_MS = 60 * 60_000

/** The check-in window: `startAt − 60 min ≤ at < endAt` (open at exactly −60 min, closed at exactly the end). */
export function isCheckInOpen(event: { startAt: Date; endAt: Date }, at: Date): boolean {
  const t = at.getTime()
  return t >= event.startAt.getTime() - WINDOW_BEFORE_START_MS && t < event.endAt.getTime()
}

/** E-08's `checkIn`: the server says whether the window is open, not yet open or closed (the page never compares times). */
export function checkInWindow(event: { startAt: Date; endAt: Date }, at: Date): CheckInWindow {
  const opensAt = new Date(event.startAt.getTime() - WINDOW_BEFORE_START_MS)
  const open = isCheckInOpen(event, at)
  const state = open ? 'OPEN' : at.getTime() < opensAt.getTime() ? 'NOT_YET' : 'CLOSED'
  return { open, state, opensAt: opensAt.toISOString(), closesAt: event.endAt.toISOString() }
}

/** E-18 after the lock, in contract order: window → not active (CANCELLED, EVENT_CANCELLED) → already checked in → OK. */
export function decideCheckIn(facts: CheckInFacts, at: Date): CheckInDecision {
  if (!isCheckInOpen(facts, at)) return 'NOT_IN_CHECK_IN_WINDOW'
  if (facts.registrationStatus === 'CANCELLED' || facts.registrationStatus === 'EVENT_CANCELLED') return 'REGISTRATION_NOT_ACTIVE'
  if (facts.registrationStatus === 'CHECKED_IN') return 'ALREADY_CHECKED_IN'
  return 'OK'
}

/** E-19 after the lock, in contract order: window → not checked in → OK. */
export function decideUndo(facts: CheckInFacts, at: Date): UndoDecision {
  if (!isCheckInOpen(facts, at)) return 'NOT_IN_CHECK_IN_WINDOW'
  return facts.registrationStatus === 'CHECKED_IN' ? 'OK' : 'NOT_CHECKED_IN'
}
