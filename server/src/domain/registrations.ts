import { Prisma, type EventStatus, type PrismaClient } from '@prisma/client'
import { HttpError } from '../http/errors.js'
import type { Actor } from './actor.js'
import { ACTIVE_STATUSES, getEventSummary, type EventSummary } from './events.read.js'
import { decideRegistration } from './registration-rules.js'

/** ParticipantRegistration (contracts §0.1): the caller's own registration with its event's fresh counts. */
export type ParticipantRegistration = {
  id: number
  status: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED' | 'EVENT_CANCELLED'
  createdAt: string
  event: EventSummary
}

type LockedEvent = { id: number; status: EventStatus; startAt: Date; capacity: number }

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
          SELECT id, status, "startAt", capacity FROM "Event" WHERE id = ${eventId} FOR UPDATE`
        if (!event) throw new HttpError('EVENT_NOT_FOUND')

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

  const row = await db.registration.findUniqueOrThrow({ where: { id: registrationId } })
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    event: await getEventSummary(db, eventId),
  }
}
