import type { EventStatus, PrismaClient } from '@prisma/client'
import { now } from '../clock.js'
import { HttpError } from '../http/errors.js'
import type { Actor } from './actor.js'
import { recordEventChange } from './changes.js'
import { MIN_LEAD_MINUTES } from './event-rules.js'
import { getEventDetail, type EventDetail } from './events.read.js'

export type PublishFacts = { status: EventStatus; startAt: Date; registrationDeadline: Date | null }
export type PublishDecision =
  | { ok: true }
  | { ok: false; code: 'ALREADY_CANCELLED' | 'ALREADY_PUBLISHED' }
  | { ok: false; code: 'EVENT_TIME_INVALID'; field: 'startAt' | 'registrationDeadline'; message: string }

/**
 * E-14 after the owner is found (Sprint 2 contracts §2, D-21): cancelled → already published → BR-02 again (the start
 * at least MIN_LEAD_MINUTES away, CH-13) → BR-08 again (a stored deadline still ahead) → OK.
 */
export function decidePublish(facts: PublishFacts, at: Date): PublishDecision {
  if (facts.status === 'CANCELLED') return { ok: false, code: 'ALREADY_CANCELLED' }
  if (facts.status === 'PUBLISHED') return { ok: false, code: 'ALREADY_PUBLISHED' }
  if (facts.startAt.getTime() < at.getTime() + MIN_LEAD_MINUTES * 60_000) {
    return { ok: false, code: 'EVENT_TIME_INVALID', field: 'startAt', message: 'The start must be at least 60 minutes from now.' }
  }
  if (facts.registrationDeadline && facts.registrationDeadline.getTime() <= at.getTime()) {
    return { ok: false, code: 'EVENT_TIME_INVALID', field: 'registrationDeadline', message: 'The deadline must be in the future.' }
  }
  return { ok: true }
}

/**
 * E-14: publishes the caller's draft. The event row is locked FOR UPDATE (SDS §4.3a one-lock rule), and the status,
 * publishedAt and the DRAFT → PUBLISHED history row are written in one transaction (SR-08). Another organizer's
 * event is the same 404 as a missing one (BR-14, D-08).
 */
export async function publishEvent(db: PrismaClient, actor: Actor, eventId: number): Promise<EventDetail> {
  await db.$transaction(async (tx) => {
    const [event] = await tx.$queryRaw<PublishFacts[]>`
      SELECT status, "startAt", "registrationDeadline" FROM "Event"
      WHERE id = ${eventId} AND "organizerId" = ${actor.id} FOR UPDATE`
    if (!event) throw new HttpError('EVENT_NOT_FOUND')

    const at = now()
    const decision = decidePublish(event, at)
    if (!decision.ok) {
      throw decision.code === 'EVENT_TIME_INVALID'
        ? new HttpError(decision.code, [{ field: decision.field, message: decision.message }])
        : new HttpError(decision.code)
    }

    await tx.event.update({ where: { id: eventId }, data: { status: 'PUBLISHED', publishedAt: at } })
    await recordEventChange(tx, { eventId, changedById: actor.id, field: 'status', oldValue: 'DRAFT', newValue: 'PUBLISHED', changedAt: at })
  })
  return (await getEventDetail(db, eventId, actor))!
}

// ---- Feature-L stubs for the red run (S2-04 commit A); the rules are written in commit B ----
export function decideCapacity(_active: number, _capacity: number): 'OK' | 'CAPACITY_BELOW_REGISTERED' {
  return 'OK'
}
export function decideEditTimes(
  _stored: { startAt: Date; endAt: Date; registrationDeadline: Date | null },
  _body: { startAt?: Date; endAt?: Date },
  _at: Date,
): { field: 'startAt' | 'endAt' | 'registrationDeadline'; message: string } | null {
  return null
}
export function frozenFields(_keys: string[], _started: boolean): string[] {
  return []
}
