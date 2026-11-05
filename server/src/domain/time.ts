import { now } from '../clock.js'

/**
 * Contracts §3 item 4: "upcoming" means startAt > now(); "started" means startAt ≤ now(),
 * so an event starting exactly now has started. Used by the event list (E-04) and registration (E-09).
 */
export function hasStarted(startAt: Date, at: Date = now()): boolean {
  return startAt.getTime() <= at.getTime()
}

/** Prisma filter for events that have not started yet. */
export function upcomingWhere() {
  return { startAt: { gt: now() } }
}
