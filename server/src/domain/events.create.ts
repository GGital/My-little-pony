import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { now } from '../clock.js'
import type { Actor } from './actor.js'
import { validateEventTimes } from './event-rules.js'
import type { EventDetail } from './events.read.js'

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

function requiredTrimmedString(min: number, max: number, message: string) {
  return z
    .string({ message })
    .transform((val) => val.trim())
    .refine((val) => val.length >= min && val.length <= max, { message })
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
}

function isoDateTimeWithOffset(message: string) {
  return z
    .string({ message })
    .refine(
      (val) => ISO_WITH_OFFSET_REGEX.test(val) && !Number.isNaN(Date.parse(val)),
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
  })
  .strict()

export type CreateEventInput = z.infer<typeof createEventInputSchema>

/**
 * Creates and publishes an event in one step (FR-06, Feature-D, contracts §7).
 * Validates time rules against domain logic, then stores with status PUBLISHED,
 * organizerId = actor.id, publishedAt = now().
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

  const event = await prisma.event.create({
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
      status: 'PUBLISHED',
      publishedAt: currentTime,
    },
    include: {
      organizer: {
        select: {
          displayName: true,
        },
      },
    },
  })

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
    feeLabel: event.feeLabel,
    capacity: event.capacity,
    registeredCount: 0,
    seatsRemaining: event.capacity,
    status: event.status,
    structureNote: event.structureNote,
    contact: event.contact,
    description: event.description,
    organizer: {
      displayName: event.organizer.displayName,
    },
    hasStarted: false,
    viewer: {
      action: 'MANAGE',
      registrationId: null,
    },
  }
}
