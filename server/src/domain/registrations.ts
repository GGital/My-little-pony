import { Prisma, type EventStatus, type PrismaClient } from '@prisma/client'
import { now } from '../clock.js'
import { HttpError } from '../http/errors.js'
import type { Actor } from './actor.js'
import { ACTIVE_STATUSES, getEventSummary, type EventSummary } from './events.read.js'
import { canCancelRegistration, decideCancellation, decideRegistration } from './registration-rules.js'

/** ParticipantRegistration (contracts §0.1): the caller's own registration with its event's fresh counts. */
export type ParticipantRegistration = {
  id: number
  status: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED' | 'EVENT_CANCELLED'
  createdAt: string
  /** Set when the row is CANCELLED or EVENT_CANCELLED (Feature-N, SR-08). */
  cancelledAt: string | null
  /** The server decides whether the player may cancel now (Feature-N). */
  canCancel: boolean
  event: EventSummary
}

type LockedEvent = { id: number; status: EventStatus; startAt: Date; registrationDeadline: Date | null; capacity: number }

/**
 * E-09: the registration transaction of SDS §4.4. The event row is locked FOR UPDATE, so simultaneous
 * registrations for the same event queue up and each sees an exact count (BR-05, BR-07, NFR-05). The partial
 * unique index `registration_one_active` is the second safety net for one participant racing themselves (BR-06).
 */
export async function register(db: PrismaClient, actor: Actor, eventId: number): Promise<ParticipantRegistration> {
  let registrationId: number
  try {
    registrationId = await db.$transaction(
      async (tx) => {
        const [event] = await tx.$queryRaw<LockedEvent[]>`
          SELECT id, status, "startAt", "registrationDeadline", capacity FROM "Event" WHERE id = ${eventId} FOR UPDATE`
        // A draft does not exist for anyone but its owner (Sprint 2 contracts §2, BR-04), so it is the same 404.
        if (!event || event.status === 'DRAFT') throw new HttpError('EVENT_NOT_FOUND')

        const [alreadyRegistered, active] = await Promise.all([
          tx.registration.count({ where: { eventId, participantId: actor.id, status: ACTIVE_STATUSES } }),
          tx.registration.count({ where: { eventId, status: ACTIVE_STATUSES } }),
        ])
        const decision = decideRegistration({ ...event, active, alreadyRegistered: alreadyRegistered > 0 })
        if (decision !== 'OK') throw new HttpError(decision)

        const row = await tx.registration.create({ data: { eventId, participantId: actor.id } })
        return row.id
      },
      // ponytail: waits are generous because 20 racers queue on one row lock in TEST-G-06; a queue is fine at
      // our scale (SD-08). Revisit with a connection pool size if real traffic ever queues longer.
      { maxWait: 10_000, timeout: 10_000 },
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError('ALREADY_REGISTERED')
    }
    throw err
  }

  return loadParticipantRegistration(db, registrationId)
}

/** One registration as a ParticipantRegistration, with its event's fresh counts and `canCancel`. */
export async function loadParticipantRegistration(db: PrismaClient, registrationId: number): Promise<ParticipantRegistration> {
  const row = await db.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { event: { select: { status: true, startAt: true, registrationDeadline: true } } },
  })
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    canCancel: canCancelRegistration({ registrationStatus: row.status, eventStatus: row.event.status, ...row.event }),
    event: await getEventSummary(db, row.eventId),
  }
}

/**
 * E-16: a participant cancels their own seat (Sprint 2 contracts §5). The Event row is locked FOR UPDATE, exactly as
 * E-09 does, so the cancellation queues with registrations and capacity edits (NFR-05). The registration is read again
 * after the lock, so two simultaneous cancels give one 200 and one ALREADY_CANCELLED. The owner is in the where
 * clause: another player's id and a missing id are the same 404 (D-08).
 */
export async function cancelRegistration(db: PrismaClient, actor: Actor, registrationId: number): Promise<ParticipantRegistration> {
  await db.$transaction(
    async (tx) => {
      // One statement finds the caller's registration and locks its event, so there is no gap before the lock.
      const [event] = await tx.$queryRaw<LockedEvent[]>`
        SELECT e.id, e.status, e."startAt", e."registrationDeadline", e.capacity
        FROM "Event" e JOIN "Registration" r ON r."eventId" = e.id
        WHERE r.id = ${registrationId} AND r."participantId" = ${actor.id} FOR UPDATE OF e`
      if (!event) throw new HttpError('REGISTRATION_NOT_FOUND')
      const row = await tx.registration.findUniqueOrThrow({ where: { id: registrationId }, select: { status: true } })
      const decision = decideCancellation({
        registrationStatus: row.status,
        eventStatus: event.status,
        startAt: event.startAt,
        registrationDeadline: event.registrationDeadline,
      })
      if (decision !== 'OK') throw new HttpError(decision)
      await tx.registration.update({ where: { id: registrationId }, data: { status: 'CANCELLED', cancelledAt: now() } })
    },
    { maxWait: 10_000, timeout: 10_000 },
  )
  return loadParticipantRegistration(db, registrationId)
}
