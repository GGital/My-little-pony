import type { PrismaClient } from '@prisma/client'
import type { Actor } from './actor.js'
import { summarySelect, toSummary, type EventSummary } from './events.read.js'

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
