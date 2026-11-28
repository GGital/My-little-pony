import type { PrismaClient } from '@prisma/client'
import { now } from '../clock.js'
import { HttpError } from '../http/errors.js'
import type { Actor } from './actor.js'
import { decideCheckIn, decideUndo } from './attendance-rules.js'
import { recordEventChange } from './changes.js'
import { organizerRowSelect, toOrganizerRow, type OrganizerRegistrationRow } from './organizer.js'

type LockedEvent = { id: number; startAt: Date; endAt: Date }

/**
 * Finds the registration on one of the caller's events and locks that event row FOR UPDATE in one statement (SDS
 * §4.3a), so E-18 and E-19 queue with E-09, E-13, E-15 and E-16. Another organizer's registration and a missing id are
 * the same 404 (D-08, BR-14). The status is read again after the lock.
 */
async function lockOwned(tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0], actor: Actor, registrationId: number) {
  const [event] = await tx.$queryRaw<LockedEvent[]>`
    SELECT e.id, e."startAt", e."endAt"
    FROM "Event" e JOIN "Registration" r ON r."eventId" = e.id
    WHERE r.id = ${registrationId} AND e."organizerId" = ${actor.id} FOR UPDATE OF e`
  if (!event) throw new HttpError('REGISTRATION_NOT_FOUND')
  const row = await tx.registration.findUniqueOrThrow({ where: { id: registrationId }, select: { status: true } })
  return { event, status: row.status }
}

const TX = { maxWait: 10_000, timeout: 10_000 }

/** E-18 (Sprint 3 contracts §1 Behaviour 2, 5): check a registered player in, with an attendance change row (FR-28). */
export async function checkIn(db: PrismaClient, actor: Actor, registrationId: number): Promise<OrganizerRegistrationRow> {
  const row = await db.$transaction(async (tx) => {
    const { event, status } = await lockOwned(tx, actor, registrationId)
    const at = now()
    const decision = decideCheckIn({ registrationStatus: status, startAt: event.startAt, endAt: event.endAt }, at)
    if (decision !== 'OK') throw new HttpError(decision)
    const updated = await tx.registration.update({
      where: { id: registrationId },
      data: { status: 'CHECKED_IN', checkedInAt: at, checkedInById: actor.id },
      select: organizerRowSelect,
    })
    await recordEventChange(tx, {
      eventId: event.id,
      changedById: actor.id,
      field: 'attendance',
      oldValue: 'REGISTERED',
      newValue: 'CHECKED_IN',
      changedAt: at,
      registrationId,
    })
    return updated
  }, TX)
  return toOrganizerRow(row)
}

/** E-19 (Sprint 3 contracts §1 Behaviour 3, 5): undo a check-in; both check-in fields are cleared (FR-22). */
export async function undoCheckIn(db: PrismaClient, actor: Actor, registrationId: number): Promise<OrganizerRegistrationRow> {
  const row = await db.$transaction(async (tx) => {
    const { event, status } = await lockOwned(tx, actor, registrationId)
    const at = now()
    const decision = decideUndo({ registrationStatus: status, startAt: event.startAt, endAt: event.endAt }, at)
    if (decision !== 'OK') throw new HttpError(decision)
    const updated = await tx.registration.update({
      where: { id: registrationId },
      data: { status: 'REGISTERED', checkedInAt: null, checkedInById: null },
      select: organizerRowSelect,
    })
    await recordEventChange(tx, {
      eventId: event.id,
      changedById: actor.id,
      field: 'attendance',
      oldValue: 'CHECKED_IN',
      newValue: 'REGISTERED',
      changedAt: at,
      registrationId,
    })
    return updated
  }, TX)
  return toOrganizerRow(row)
}
