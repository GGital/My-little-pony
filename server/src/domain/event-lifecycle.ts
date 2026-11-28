import type { EventStatus, PrismaClient } from '@prisma/client'
import { now } from '../clock.js'
import { HttpError } from '../http/errors.js'
import type { Actor } from './actor.js'
import { recordEventChange } from './changes.js'
import { decideDeadline, effectiveDeadline } from './deadline.js'
import { MIN_LEAD_MINUTES } from './event-rules.js'
import { ACTIVE_STATUSES, getEventDetail, type EventDetail } from './events.read.js'
import { hasStarted } from './time.js'

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

// ---- Feature-L: E-13 edit and capacity (Sprint 2 contracts §3, v0.8) ----

/** BR-09: capacity may equal the active registrations, never go below them (D-04: lowering never removes one). */
export function decideCapacity(active: number, capacity: number): 'OK' | 'CAPACITY_BELOW_REGISTERED' {
  return capacity < active ? 'CAPACITY_BELOW_REGISTERED' : 'OK'
}

/**
 * BR-02 on the RESULTING start and end (contracts §3): a start in the body must be at least MIN_LEAD_MINUTES away
 * (CH-13, checked only when the body sets it); the end must be after the start and at most 24 h later; and a new
 * start may not fall before a stored deadline (D-23). Returns the first problem, or null.
 */
export function decideEditTimes(
  stored: { startAt: Date; endAt: Date; registrationDeadline: Date | null },
  body: { startAt?: Date; endAt?: Date },
  at: Date,
): { field: 'startAt' | 'endAt' | 'registrationDeadline'; message: string } | null {
  if (!body.startAt && !body.endAt) return null
  const start = body.startAt ?? stored.startAt
  const end = body.endAt ?? stored.endAt
  if (body.startAt && body.startAt.getTime() < at.getTime() + MIN_LEAD_MINUTES * 60_000) {
    return { field: 'startAt', message: 'The start must be at least 60 minutes from now.' }
  }
  if (end.getTime() <= start.getTime()) return { field: 'endAt', message: 'The end must be after the start.' }
  if (end.getTime() > start.getTime() + 24 * 60 * 60_000) return { field: 'endAt', message: 'An event can last at most 24 hours.' }
  if (body.startAt && stored.registrationDeadline && stored.registrationDeadline.getTime() > start.getTime()) {
    return { field: 'registrationDeadline', message: 'Registration must close at or before the start.' }
  }
  return null
}

/** BR-15, D-19: once started, only these may change. */
const SAFE_AFTER_START = new Set(['description', 'structureNote', 'contact', 'feeLabel'])

/** The body keys that are frozen because the event has started, in body order (empty before the start). */
export function frozenFields(keys: string[], started: boolean): string[] {
  return started ? keys.filter((k) => !SAFE_AFTER_START.has(k)) : []
}

/** The detail fields in form order; their names make a `details` change row (D-20). Capacity has its own row. */
const DETAIL_FIELDS = [
  'title', 'type', 'format', 'game', 'venueName', 'venueAddress', 'city', 'startAt', 'endAt',
  'feeLabel', 'structureNote', 'contact', 'description',
] as const

export type EditEventInput = Partial<Record<(typeof DETAIL_FIELDS)[number], string | null>> & {
  capacity?: number
  /** Feature-M (S2-06): null clears it, so registration closes at the start. */
  registrationDeadline?: string | null
}

const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b)

/**
 * E-13: edits the caller's event. The event row is locked FOR UPDATE, as registration locks it (SDS §4.3a), so a
 * capacity cut and a registration can never both pass (TEST-L-03). Checks in contract order: 404 → cancelled →
 * started (frozen fields) → times → capacity; then saves only what really changed, with one `details` and/or one
 * `capacity` change row, in the same transaction (SR-08).
 */
export async function updateEvent(
  db: PrismaClient,
  actor: Actor,
  eventId: number,
  input: EditEventInput,
  bodyOrder: string[] = Object.keys(input),
): Promise<EventDetail> {
  await db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Event" WHERE id = ${eventId} AND "organizerId" = ${actor.id} FOR UPDATE`
    if (!locked) throw new HttpError('EVENT_NOT_FOUND')
    const row = await tx.event.findUniqueOrThrow({ where: { id: eventId } })
    if (row.status === 'CANCELLED') throw new HttpError('ALREADY_CANCELLED')

    const at = now()
    // In the order the caller sent them, so the 409 details read like the request (contracts §3).
    const keys = bodyOrder.filter((k) => input[k as keyof EditEventInput] !== undefined)
    const frozen = frozenFields(keys, hasStarted(row.startAt, at))
    if (frozen.length) {
      throw new HttpError('EVENT_STARTED', frozen.map((field) => ({ field, message: "This can't change after the event has started." })))
    }

    const startAt = input.startAt ? new Date(input.startAt) : undefined
    const endAt = input.endAt ? new Date(input.endAt) : undefined
    // A deadline in the body is checked by its own rule (§4) against the resulting start; without one, a new start
    // may not fall before the stored deadline (D-23).
    // A deadline sent again unchanged counts as not sent (review of #111), so a passed one doesn't block other edits;
    // the stored one is then still checked against a new start (D-23).
    const sentValue = input.registrationDeadline ? new Date(input.registrationDeadline) : null
    const sentDeadline = input.registrationDeadline !== undefined && !same(sentValue, row.registrationDeadline)
    const time = decideEditTimes({ ...row, registrationDeadline: sentDeadline ? null : row.registrationDeadline }, { startAt, endAt }, at)
    if (time) throw new HttpError('EVENT_TIME_INVALID', [time])
    const deadline = sentDeadline ? sentValue : null
    if (sentDeadline) {
      const problem = decideDeadline(deadline, startAt ?? row.startAt, at)
      if (problem) throw new HttpError('EVENT_TIME_INVALID', [problem])
    }

    if (input.capacity !== undefined) {
      const active = await tx.registration.count({ where: { eventId, status: { in: ['REGISTERED', 'CHECKED_IN'] } } })
      if (decideCapacity(active, input.capacity) !== 'OK') {
        throw new HttpError('CAPACITY_BELOW_REGISTERED', [
          { field: 'capacity', message: `${active} players are registered, so capacity can't go below ${active}.` },
        ])
      }
    }

    const next: Record<string, unknown> = { ...input, ...(startAt ? { startAt } : {}), ...(endAt ? { endAt } : {}) }
    const changed = DETAIL_FIELDS.filter((f) => next[f] !== undefined && !same(next[f], row[f]))
    const capacityChanged = input.capacity !== undefined && input.capacity !== row.capacity
    const deadlineStored = sentDeadline && !same(deadline, row.registrationDeadline)
    const oldEffective = effectiveDeadline(row)
    const newEffective = effectiveDeadline({ startAt: startAt ?? row.startAt, registrationDeadline: sentDeadline ? deadline : row.registrationDeadline })
    const deadlineChanged = sentDeadline && oldEffective.getTime() !== newEffective.getTime()
    if (!changed.length && !capacityChanged && !deadlineStored) return

    await tx.event.update({
      where: { id: eventId },
      data: {
        ...Object.fromEntries(changed.map((f) => [f, next[f]])),
        ...(capacityChanged ? { capacity: input.capacity } : {}),
        ...(deadlineStored ? { registrationDeadline: deadline } : {}),
      },
    })
    if (changed.length) {
      await recordEventChange(tx, { eventId, changedById: actor.id, field: 'details', oldValue: null, newValue: changed.join(', '), changedAt: at })
    }
    if (capacityChanged) {
      await recordEventChange(tx, {
        eventId, changedById: actor.id, field: 'capacity', oldValue: String(row.capacity), newValue: String(input.capacity), changedAt: at,
      })
    }
    if (deadlineChanged) {
      // SR-08: old and new EFFECTIVE deadlines, as ISO times (contracts §1).
      await recordEventChange(tx, {
        eventId, changedById: actor.id, field: 'deadline', oldValue: oldEffective.toISOString(), newValue: newEffective.toISOString(), changedAt: at,
      })
    }
  })
  return (await getEventDetail(db, eventId, actor))!
}

export type CancelFacts = { status: EventStatus; startAt: Date }
export type CancelDecision = { ok: true } | { ok: false; code: 'ALREADY_CANCELLED' | 'NOT_PUBLISHED' | 'EVENT_STARTED' }

/**
 * E-15 after the owner is found (Sprint 2 contracts §6): already cancelled → not published (D-16) → started
 * (startAt ≤ now, so an event starting exactly now has started) → OK.
 */
export function decideCancel(facts: CancelFacts, at: Date): CancelDecision {
  if (facts.status === 'CANCELLED') return { ok: false, code: 'ALREADY_CANCELLED' }
  if (facts.status !== 'PUBLISHED') return { ok: false, code: 'NOT_PUBLISHED' }
  if (hasStarted(facts.startAt, at)) return { ok: false, code: 'EVENT_STARTED' }
  return { ok: true }
}

/**
 * E-15: cancels the caller's event. The event row is locked FOR UPDATE, the same lock E-09 takes (SDS §4.3a), so a
 * registration either committed before this (and becomes EVENT_CANCELLED) or waits and is then refused as
 * REGISTRATION_CLOSED. Event, registrations and the PUBLISHED → CANCELLED history row change in one transaction
 * (FR-10, FR-28, BR-12). Rows already CANCELLED are not touched. Another organizer's event is the same 404 (D-08).
 */
export async function cancelEvent(db: PrismaClient, actor: Actor, eventId: number, reason: string): Promise<EventDetail> {
  await db.$transaction(
    async (tx) => {
      const [event] = await tx.$queryRaw<CancelFacts[]>`
        SELECT status, "startAt" FROM "Event"
        WHERE id = ${eventId} AND "organizerId" = ${actor.id} FOR UPDATE`
      if (!event) throw new HttpError('EVENT_NOT_FOUND')

      const at = now()
      const decision = decideCancel(event, at)
      if (!decision.ok) throw new HttpError(decision.code)

      await tx.event.update({
        where: { id: eventId },
        data: { status: 'CANCELLED', cancelledAt: at, cancelledById: actor.id, cancelReason: reason },
      })
      // Sprint 3: check-in opens 60 minutes before the start, so a CHECKED_IN row may be here. Its check-in fields are
      // cleared, as registration_checkin_fields requires (BR-19); the attendance history rows keep who and when (FR-28).
      await tx.registration.updateMany({
        where: { eventId, status: ACTIVE_STATUSES },
        data: { status: 'EVENT_CANCELLED', cancelledAt: at, checkedInAt: null, checkedInById: null },
      })
      await recordEventChange(tx, { eventId, changedById: actor.id, field: 'status', oldValue: 'PUBLISHED', newValue: 'CANCELLED', changedAt: at })
    },
    // Many registrations may be queued on the same row lock (TEST-O-06); same allowance as E-09.
    { maxWait: 10_000, timeout: 10_000 },
  )
  return (await getEventDetail(db, eventId, actor))!
}
