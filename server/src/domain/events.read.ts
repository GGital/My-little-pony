import type { EventFormat, EventStatus, EventType, Prisma, PrismaClient } from '@prisma/client'
import type { Actor } from './actor.js'
import { hasStarted, upcomingWhere } from './time.js'

export type ViewerAction =
  | 'MANAGE'
  | 'ORGANIZER_CANNOT_REGISTER'
  | 'REGISTERED'
  | 'CLOSED'
  | 'FULL'
  | 'SIGN_IN_TO_REGISTER'
  | 'REGISTER'

export type EventSummary = {
  id: number
  title: string
  type: EventType
  format: EventFormat
  venueName: string
  city: string
  startAt: string
  endAt: string
  feeLabel: string | null
  capacity: number
  registeredCount: number
  seatsRemaining: number
  status: EventStatus
}

export type EventDetail = EventSummary & {
  venueAddress: string
  structureNote: string | null
  contact: string | null
  description: string | null
  organizer: {
    displayName: string
  }
  hasStarted: boolean
  viewer: {
    action: ViewerAction
    registrationId: number | null
  }
}

/**
 * E-04: Returns upcoming published events in startAt asc, then id asc order.
 * Registered counts and seats remaining are computed from active registrations.
 */
export async function listUpcomingEvents(prisma: PrismaClient): Promise<{ items: EventSummary[] }> {
  const events = await prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      ...upcomingWhere(),
    },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    select: summarySelect,
  })
  return { items: events.map(toSummary) }
}

/** Active registrations count towards the seats (contracts §0.1). */
export const ACTIVE_STATUSES = { in: ['REGISTERED', 'CHECKED_IN'] as ('REGISTERED' | 'CHECKED_IN')[] }

export const summarySelect = {
  id: true,
  title: true,
  type: true,
  format: true,
  venueName: true,
  city: true,
  startAt: true,
  endAt: true,
  feeLabel: true,
  capacity: true,
  status: true,
  _count: { select: { registrations: { where: { status: ACTIVE_STATUSES } } } },
} as const

type SummaryRow = Prisma.EventGetPayload<{ select: typeof summarySelect }>

/** registeredCount and seatsRemaining are computed on every read (contracts §0.1). */
export function toSummary(e: SummaryRow): EventSummary {
  const registeredCount = e._count.registrations
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    format: e.format,
    venueName: e.venueName,
    city: e.city,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    feeLabel: e.feeLabel,
    capacity: e.capacity,
    registeredCount,
    seatsRemaining: Math.max(0, e.capacity - registeredCount),
    status: e.status,
  }
}

/** One event as an EventSummary, with fresh counts (E-09 returns it inside the new registration). */
export async function getEventSummary(prisma: Pick<PrismaClient, 'event'>, eventId: number): Promise<EventSummary> {
  return toSummary(await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: summarySelect }))
}

/**
 * E-05: Returns details of a published event with viewer.action.
 * viewer.action is evaluated in strict order (contracts 0.2).
 */
export async function getEventDetail(
  prisma: PrismaClient,
  eventId: number,
  actor?: Actor,
): Promise<EventDetail | null> {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      status: 'PUBLISHED',
    },
    select: {
      id: true,
      organizerId: true,
      title: true,
      type: true,
      format: true,
      venueName: true,
      venueAddress: true,
      city: true,
      startAt: true,
      endAt: true,
      feeLabel: true,
      capacity: true,
      structureNote: true,
      contact: true,
      description: true,
      status: true,
      organizer: {
        select: {
          displayName: true,
        },
      },
      _count: {
        select: {
          registrations: {
            where: {
              status: { in: ['REGISTERED', 'CHECKED_IN'] },
            },
          },
        },
      },
    },
  })

  if (!event) return null

  const started = hasStarted(event.startAt)
  const registeredCount = event._count.registrations
  const seatsRemaining = Math.max(0, event.capacity - registeredCount)

  let activeRegistrationId: number | null = null
  if (actor && actor.role === 'PARTICIPANT') {
    const reg = await prisma.registration.findFirst({
      where: {
        eventId: event.id,
        participantId: actor.id,
        status: { in: ['REGISTERED', 'CHECKED_IN'] },
      },
      select: { id: true },
    })
    if (reg) {
      activeRegistrationId = reg.id
    }
  }

  // Top-to-bottom condition evaluation (contracts 0.2)
  let action: ViewerAction
  if (actor && actor.id === event.organizerId) {
    action = 'MANAGE'
  } else if (actor && actor.role === 'ORGANIZER') {
    action = 'ORGANIZER_CANNOT_REGISTER'
  } else if (activeRegistrationId !== null) {
    action = 'REGISTERED'
  } else if (started || event.status !== 'PUBLISHED') {
    action = 'CLOSED'
  } else if (seatsRemaining === 0) {
    action = 'FULL'
  } else if (!actor) {
    action = 'SIGN_IN_TO_REGISTER'
  } else {
    action = 'REGISTER'
  }

  return {
    id: event.id,
    title: event.title,
    type: event.type,
    format: event.format,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    city: event.city,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    capacity: event.capacity,
    registeredCount,
    seatsRemaining,
    status: event.status,
    feeLabel: event.feeLabel,
    structureNote: event.structureNote,
    contact: event.contact,
    description: event.description,
    organizer: event.organizer,
    hasStarted: started,
    viewer: {
      action,
      registrationId: action === 'REGISTERED' ? activeRegistrationId : null,
    },
  }
}
