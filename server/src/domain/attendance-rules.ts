// Stub for the S3-01 red commit: the tests compile against these names. The rules come in the implementation commit.
export type RegistrationStatusValue = 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED' | 'EVENT_CANCELLED'
export type CheckInFacts = { registrationStatus: RegistrationStatusValue; startAt: Date; endAt: Date }
export type CheckInWindow = { open: boolean; state: 'NOT_YET' | 'OPEN' | 'CLOSED'; opensAt: string; closesAt: string }

export function isCheckInOpen(_event: { startAt: Date; endAt: Date }, _at: Date): boolean {
  return false
}

export function checkInWindow(event: { startAt: Date; endAt: Date }, _at: Date): CheckInWindow {
  return { open: false, state: 'CLOSED', opensAt: event.startAt.toISOString(), closesAt: event.endAt.toISOString() }
}

export function decideCheckIn(_facts: CheckInFacts, _at: Date): string {
  return 'OK'
}

export function decideUndo(_facts: CheckInFacts, _at: Date): string {
  return 'OK'
}
