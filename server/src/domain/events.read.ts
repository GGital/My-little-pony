import type { EventFormat, EventStatus, EventType, Prisma, PrismaClient } from '@prisma/client'
import type { Actor } from './actor.js'
import { bangkokDayRange, escapeLikeWildcards, type SearchQuery } from './search-query.js'
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
  /** Public on a cancelled event, null otherwise (Sprint 2 contracts §6, E-05); `cancelledById` is never returned. */
  cancelReason: string | null
  cancelledAt: string | null
  hasStarted: boolean
  viewer: {
    action: ViewerAction
    registrationId: number | null
  }
}

/** Page size is fixed at 20 (Feature-J contracts §7). */
const PAGE_SIZE = 20

export type SearchMeta = { page: number; pageSize: number; totalItems: number }

/**
 * E-04 (Feature-J, contracts §7): published events that match every filter (AND), startAt then id order, 20 a page.
 * Drafts are impossible by construction: DRAFT is never in the status list.
 * `%` and `_` in the text are matched literally, so the text and seat parts run as raw SQL id queries.
 */
export async function searchEvents(
  prisma: PrismaClient,
  query: SearchQuery,
): Promise<{ items: EventSummary[]; meta: SearchMeta }> {
  const include = query.include ? query.include.split(',').map((p) => p.trim()) : []
  const and: Prisma.EventWhereInput[] = [
    { status: include.includes('cancelled') ? { in: ['PUBLISHED', 'CANCELLED'] } : 'PUBLISHED' },
  ]
  if (!include.includes('past')) and.push(upcomingWhere())
  if (query.type) and.push({ type: query.type })
  if (query.format) and.push({ format: query.format })
  if (query.from) and.push({ startAt: { gte: bangkokDayRange(query.from)[0] } })
  if (query.to) and.push({ startAt: { lt: bangkokDayRange(query.to)[1] } })

  if (query.q) {
    // Backslash is PostgreSQL's default LIKE escape. Do not add ESCAPE '\' here: inside a JS template
    // literal it becomes ESCAPE '' (no escape character) and a literal % or _ would never match.
    const pattern = `%${escapeLikeWildcards(query.q)}%`
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT "id" FROM "Event"
      WHERE "title" ILIKE ${pattern} OR "venueName" ILIKE ${pattern} OR "city" ILIKE ${pattern}`
    and.push({ id: { in: rows.map((r) => r.id) } })
  }

  if (query.seatsAvailable === 'true') {
    // registeredCount < capacity; a full event has as many active registrations as seats (contracts §0.1).
    const full = await prisma.$queryRaw<{ id: number }[]>`
      SELECT e."id" FROM "Event" e
      WHERE e."capacity" <= (
        SELECT count(*) FROM "Registration" r
        WHERE r."eventId" = e."id" AND r."status" IN ('REGISTERED', 'CHECKED_IN'))`
    and.push({ id: { notIn: full.map((r) => r.id) } })
  }

  const where: Prisma.EventWhereInput = { AND: and }
  const [totalItems, events] = await prisma.$transaction([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: summarySelect,
    }),
  ])
  return { items: events.map(toSummary), meta: { page: query.page, pageSize: PAGE_SIZE, totalItems } }
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
 * E-05: Returns details of a published event, or of the caller's own draft, with viewer.action.
 * viewer.action is evaluated in strict order (contracts 0.2).
 */
export async function getEventDetail(
  prisma: PrismaClient,
  eventId: number,
  actor?: Actor,
): Promise<EventDetail | null> {
  // A draft is visible to its owner only (Sprint 2 contracts §2, BR-04); for anyone else it does not exist.
  const ownDraft = actor?.role === 'ORGANIZER' ? [{ status: 'DRAFT' as const, organizerId: actor.id }] : []
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      // A cancelled event stays visible to everyone (BR-04).
      OR: [{ status: { in: ['PUBLISHED', 'CANCELLED'] as EventStatus[] } }, ...ownDraft],
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
      cancelReason: true,
      cancelledAt: true,
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
    cancelReason: event.cancelReason,
    cancelledAt: event.cancelledAt?.toISOString() ?? null,
    hasStarted: started,
    viewer: {
      action,
      registrationId: action === 'REGISTERED' ? activeRegistrationId : null,
    },
  }
}
