import type { PrismaClient } from '@prisma/client'
import { ownRegistrationWhere, type Actor } from './actor.js'
import { summarySelect, toSummary } from './events.read.js'
import type { ParticipantRegistration } from './registrations.js'

const select = { id: true, status: true, createdAt: true, event: { select: summarySelect } } as const

type Row = { id: number; status: ParticipantRegistration['status']; createdAt: Date; event: Parameters<typeof toSummary>[0] }

const toParticipantRegistration = (row: Row): ParticipantRegistration => ({
  id: row.id,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  event: toSummary(row.event),
})

/**
 * E-10: the caller's own registrations, soonest event first (contracts §11). The owner is in the where clause,
 * so nothing of another participant can appear (BR-16).
 */
export async function listMyRegistrations(db: PrismaClient, actor: Actor) {
  const rows = await db.registration.findMany({
    where: { participantId: actor.id },
    orderBy: [{ event: { startAt: 'asc' } }, { id: 'asc' }],
    select,
  })
  return { items: rows.map(toParticipantRegistration) }
}

/** E-11: one of the caller's registrations, or null; someone else's and a missing id look the same (D-08). */
export async function getMyRegistration(db: PrismaClient, actor: Actor, id: number) {
  const row = await db.registration.findFirst({ where: ownRegistrationWhere(actor, id), select })
  return row ? toParticipantRegistration(row) : null
}
