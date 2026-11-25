import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { now } from '../clock.js'
import type { Actor } from './actor.js'
import { recordEventChange } from './changes.js'
import { validateEventTimes } from './event-rules.js'
import { getEventDetail, type EventDetail } from './events.read.js'

export class EventTimeError extends Error {
  readonly field: 'startAt' | 'endAt'
  constructor(field: 'startAt' | 'endAt', message: string) {
    super(message)
    this.name = 'EventTimeError'
    this.field = field
  }
}

const ISO_WITH_OFFSET_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/

/** #63 (NFR-15): PostgreSQL text cannot store U+0000, so refuse it here as a field error instead of a 500. */
const NUL_MESSAGE = 'Remove the unsupported invisible character (U+0000).'
const hasNoNul = (val: string | null) => val === null || !val.includes('\u0000')

function requiredTrimmedString(min: number, max: number, message: string) {
  return z
    .string({ message })
    .transform((val) => val.trim())
    .refine((val) => val.length >= min && val.length <= max, { message })
    .refine(hasNoNul, { message: NUL_MESSAGE })
}

function optionalTrimmedString(max: number, message: string) {
  return z
    .string({ message })
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined || val === null) return null
      const trimmed = val.trim()
      return trimmed === '' ? null : trimmed
    })
    .refine((val) => val === null || val.length <= max, { message })
    .refine(hasNoNul, { message: NUL_MESSAGE })
}

/**
 * #57: Date.parse rolls an impossible day over (2027-02-29 becomes 1 March), so also check that the written
 * year-month-day exists on the calendar. The day is checked as written, before the offset is applied.
 */
function isRealCalendarDay(val: string): boolean {
  const year = Number(val.slice(0, 4))
  const month = Number(val.slice(5, 7))
  const day = Number(val.slice(8, 10))
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isoDateTimeWithOffset(message: string) {
  return z
    .string({ message })
    .refine(
      (val) => ISO_WITH_OFFSET_REGEX.test(val) && !Number.isNaN(Date.parse(val)) && isRealCalendarDay(val),
      { message },
    )
}

export const createEventInputSchema = z
  .object({
    title: requiredTrimmedString(3, 100, 'Use 3 to 100 characters for the title.'),
    type: z.enum(['CASUAL', 'TOURNAMENT', 'RELEASE'], {
      message: 'Choose an event type.',
    }),
    format: z.enum(['CONSTRUCTED', 'SEALED', 'DRAFT'], {
      message: 'Choose a format.',
    }),
    venueName: requiredTrimmedString(1, 80, 'Enter the venue name.'),
    venueAddress: requiredTrimmedString(1, 200, 'Enter the venue address.'),
    city: requiredTrimmedString(1, 60, 'Enter the city.'),
    startAt: isoDateTimeWithOffset('Enter a start date and time.'),
    endAt: isoDateTimeWithOffset('Enter an end date and time.'),
    capacity: z.custom<number>(
      (val) => typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 256,
      { message: 'Capacity must be a whole number from 1 to 256.' },
    ),
    feeLabel: optionalTrimmedString(40, 'Use up to 40 characters.'),
    structureNote: optionalTrimmedString(80, 'Use up to 80 characters.'),
    contact: optionalTrimmedString(120, 'Use up to 120 characters.'),
    description: optionalTrimmedString(2000, 'Use up to 2,000 characters.'),
    // Sprint 2 Feature-K (D-18): true saves a draft that only the owner can see. The client never sends `status`.
    saveAsDraft: z.boolean({ message: 'Use true or false.' }).optional(),
  })
  .strict()

export type CreateEventInput = z.infer<typeof createEventInputSchema>

/**
 * Creates an event (FR-06, Feature-D, contracts §7): published at once, or saved as a draft with `saveAsDraft`
 * (FR-08, Sprint 2 Feature-K). Validates time rules against domain logic, then stores it with organizerId = actor.id,
 * status PUBLISHED and publishedAt = now() (a draft: DRAFT and null), and the history row status null → that status in
 * the same transaction (Sprint 2 contracts §1 SR-08).
 */
export async function createEvent(
  prisma: PrismaClient,
  actor: Actor,
  input: CreateEventInput,
): Promise<EventDetail> {
  const start = new Date(input.startAt)
  const end = new Date(input.endAt)

  const timeCheck = validateEventTimes(start, end)
  if (!timeCheck.valid) {
    throw new EventTimeError(timeCheck.field, timeCheck.message)
  }

  const currentTime = now()
  const status = input.saveAsDraft ? 'DRAFT' : 'PUBLISHED'

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        organizerId: actor.id,
        title: input.title,
        type: input.type,
        format: input.format,
        venueName: input.venueName,
        venueAddress: input.venueAddress,
        city: input.city,
        startAt: start,
        endAt: end,
        capacity: input.capacity,
        feeLabel: input.feeLabel,
        structureNote: input.structureNote,
        contact: input.contact,
        description: input.description,
        status,
        publishedAt: status === 'PUBLISHED' ? currentTime : null,
      },
    })
    await recordEventChange(tx, {
      eventId: created.id,
      changedById: actor.id,
      field: 'status',
      oldValue: null,
      newValue: status,
      changedAt: currentTime,
    })
    return created
  })

  return (await getEventDetail(prisma, event.id, actor))!
}
