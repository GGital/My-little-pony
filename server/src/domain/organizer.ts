import type { Prisma, PrismaClient, RegistrationStatus } from '@prisma/client'
import { now } from '../clock.js'
import type { Actor } from './actor.js'
import { ownedEventWhere } from './actor.js'
import { checkInWindow, type CheckInWindow } from './attendance-rules.js'
import { summarySelect, toSummary, type EventSummary } from './events.read.js'

export type OrganizerRegistrationRow = {
  id: number
  participant: {
    displayName: string
  }
  status: RegistrationStatus
  createdAt: string
  /** Set when the player cancelled the seat (Feature-N, AC-N-01). */
  cancelledAt: string | null
  /** Sprint 3 Feature-P: when and by whom the player was checked in; both null otherwise. Display name only (BR-16). */
  checkedInAt: string | null
  checkedInBy: { displayName: string } | null
}

export type EventRegistrationsResult = {
  event: {
    id: number
    title: string
    capacity: number
    registeredCount: number
    seatsRemaining: number
  }
  items: OrganizerRegistrationRow[]
  /** Sprint 3 §0.2: the window decided by the server, so the page never compares times itself. */
  checkIn: CheckInWindow
  /** Sprint 3 §0.2: active = REGISTERED + CHECKED_IN. */
  counts: { active: number; checkedIn: number }
}

/** The columns of one OrganizerRegistrationRow; never the participant's email or id (BR-16). */
export const organizerRowSelect = {
  id: true,
  status: true,
  createdAt: true,
  cancelledAt: true,
  checkedInAt: true,
  participant: { select: { displayName: true } },
  checkedInBy: { select: { displayName: true } },
} satisfies Prisma.RegistrationSelect

type OrganizerRowRecord = Prisma.RegistrationGetPayload<{ select: typeof organizerRowSelect }>

export const toOrganizerRow = (r: OrganizerRowRecord): OrganizerRegistrationRow => ({
  id: r.id,
  participant: { displayName: r.participant.displayName },
  status: r.status,
  createdAt: r.createdAt.toISOString(),
  cancelledAt: r.cancelledAt?.toISOString() ?? null,
  checkedInAt: r.checkedInAt?.toISOString() ?? null,
  checkedInBy: r.checkedInBy ? { displayName: r.checkedInBy.displayName } : null,
})

/**
 * E-07: lists the signed-in organizer's own events, earliest start first (all of them: upcoming and started).
 * Sorted startAt asc, then id asc (contracts §8 Feature-E).
 * Permissions: organizer only; the query is where organizerId = actor.id (BR-14).
 */
export async function listOrganizerEvents(db: PrismaClient, actor: Actor): Promise<{ items: EventSummary[] }> {
  const events = await db.event.findMany({
    where: { organizerId: actor.id },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    select: summarySelect,
  })
  return { items: events.map(toSummary) }
}

/**
 * E-08: lists registrations for an event owned by the signed-in organizer (contracts §12 Feature-I), the Door
 * check-in list from Sprint 3 (Feature-P). Sorted createdAt asc, then id asc (oldest first).
 * Permissions: organizer and owner. The query is where ownedEventWhere(actor, eventId) (BR-14).
 * Data privacy: responses NEVER contain participant emails or participant IDs (BR-16).
 */
export async function getOrganizerEventRegistrations(
  db: PrismaClient,
  actor: Actor,
  eventId: number,
): Promise<EventRegistrationsResult | null> {
  const event = await db.event.findFirst({
    where: ownedEventWhere(actor, eventId),
    select: {
      id: true,
      title: true,
      capacity: true,
      startAt: true,
      endAt: true,
      registrations: {
        // Active rows and rows the player cancelled (Feature-N); only the active ones count against capacity.
        where: { status: { in: ['REGISTERED', 'CHECKED_IN', 'CANCELLED'] } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: organizerRowSelect,
      },
    },
  })

  if (!event) return null

  const registeredCount = event.registrations.filter((r) => r.status !== 'CANCELLED').length
  const seatsRemaining = Math.max(0, event.capacity - registeredCount)

  return {
    event: {
      id: event.id,
      title: event.title,
      capacity: event.capacity,
      registeredCount,
      seatsRemaining,
    },
    items: event.registrations.map(toOrganizerRow),
    checkIn: checkInWindow(event, now()),
    counts: { active: registeredCount, checkedIn: event.registrations.filter((r) => r.status === 'CHECKED_IN').length },
  }
}
