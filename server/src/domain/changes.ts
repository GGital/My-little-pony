import type { ChangeField, Prisma, PrismaClient } from '@prisma/client'
import type { Actor } from './actor.js'
import { ownedEventWhere } from './actor.js'

/** One row of the owner's change history (Sprint 2 contracts §0.1 EventChange). Only the display name, never an id. */
export type EventChangeItem = {
  id: number
  field: ChangeField
  oldValue: string | null
  newValue: string
  changedAt: string
  changedBy: { displayName: string }
}

/**
 * Writes one history row (SR-08, FR-28). Callers pass their transaction client, so the change and its record are
 * written together (contracts §1 Behaviour 4). Rows are never updated or deleted (trigger event_change_append_only).
 */
export function recordEventChange(
  tx: Prisma.TransactionClient,
  change: { eventId: number; changedById: number; field: ChangeField; oldValue: string | null; newValue: string; changedAt: Date },
) {
  return tx.eventChange.create({ data: change })
}

/**
 * E-17: the history of an event owned by the caller, newest first (changedAt desc, then id desc).
 * Returns null when the event is missing or someone else's, so both answer the same 404 (D-08, BR-14).
 */
export async function listEventChanges(db: PrismaClient, actor: Actor, eventId: number): Promise<{ items: EventChangeItem[] } | null> {
  const event = await db.event.findFirst({
    where: ownedEventWhere(actor, eventId),
    select: {
      changes: {
        orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          field: true,
          oldValue: true,
          newValue: true,
          changedAt: true,
          changedBy: { select: { displayName: true } },
        },
      },
    },
  })
  if (!event) return null
  return { items: event.changes.map((c) => ({ ...c, changedAt: c.changedAt.toISOString() })) }
}
