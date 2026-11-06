import type { PrismaClient, RegistrationStatus } from '@prisma/client'
import type { Actor } from './actor.js'
import { ownedEventWhere } from './actor.js'
import { ACTIVE_STATUSES, summarySelect, toSummary, type EventSummary } from './events.read.js'

export type OrganizerRegistrationRow = {
  id: number
  participant: {
    displayName: string
  }
  status: RegistrationStatus
  createdAt: string
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
}

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
 * E-08: lists registrations for an event owned by the signed-in organizer (contracts §12 Feature-I).
 * Sorted createdAt asc, then id asc (oldest first).
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
      registrations: {
        where: { status: ACTIVE_STATUSES },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          status: true,
          createdAt: true,
          participant: {
            select: {
              displayName: true,
            },
          },
        },
      },
    },
  })

  if (!event) return null

  const registeredCount = event.registrations.length
  const seatsRemaining = Math.max(0, event.capacity - registeredCount)

  return {
    event: {
      id: event.id,
      title: event.title,
      capacity: event.capacity,
      registeredCount,
      seatsRemaining,
    },
    items: event.registrations.map((r) => ({
      id: r.id,
      participant: {
        displayName: r.participant.displayName,
      },
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

