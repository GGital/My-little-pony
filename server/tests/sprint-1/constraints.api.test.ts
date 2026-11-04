import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  HOUR,
  MINUTE,
  insertEventRaw,
  insertRegistrationRaw,
  makeEvent,
  makeOrganizer,
  makeParticipant,
  prisma,
  resetDb,
} from '../helpers/db.js'

// Database-level backing for the rules (SDS §4.3, SD-04). Every insert here is raw SQL, so no application code can
// refuse it: only a constraint can. STS §2.1 TEST-SR1-03 … 05.
let organizerId: number
const start = new Date('2030-01-10T10:00:00.000Z')

beforeAll(async () => {
  await resetDb()
  organizerId = (await makeOrganizer()).id
})
afterAll(() => prisma.$disconnect())

describe('TEST-SR1-03 capacity must be a whole number from 1 to 256 (BR-01)', () => {
  it.each([0, -1, 257])('rejects capacity %i at database level', async (capacity) => {
    await expect(insertEventRaw(organizerId, capacity, start, new Date(start.getTime() + HOUR))).rejects.toThrow(
      /event_capacity_range/,
    )
  })

  it.each([1, 256])('accepts capacity %i', async (capacity) => {
    await expect(insertEventRaw(organizerId, capacity, start, new Date(start.getTime() + HOUR))).resolves.toBe(1)
  })
})

describe('TEST-SR1-04 an event ends after it starts and lasts at most 24 hours (BR-02)', () => {
  it('rejects an end equal to the start', async () => {
    await expect(insertEventRaw(organizerId, 10, start, start)).rejects.toThrow(/event_time_window/)
  })

  it('rejects an end before the start', async () => {
    await expect(insertEventRaw(organizerId, 10, start, new Date(start.getTime() - MINUTE))).rejects.toThrow(
      /event_time_window/,
    )
  })

  it('rejects an end 24 hours and 1 minute after the start', async () => {
    await expect(
      insertEventRaw(organizerId, 10, start, new Date(start.getTime() + 24 * HOUR + MINUTE)),
    ).rejects.toThrow(/event_time_window/)
  })

  it('accepts an end exactly 24 hours after the start', async () => {
    await expect(insertEventRaw(organizerId, 10, start, new Date(start.getTime() + 24 * HOUR))).resolves.toBe(1)
  })
})

// Prisma reports a unique violation as SQLSTATE 23505 with the key columns, but without the index name.
const UNIQUE_ON_EVENT_AND_PARTICIPANT = /Code: `23505`[\s\S]*Key \(\\?"eventId\\?", \\?"participantId\\?"\)/

describe('TEST-SR1-05 one ACTIVE registration per participant per event (BR-06)', () => {
  it('is enforced by a partial unique index that covers only active statuses', async () => {
    const [index] = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'Registration' AND indexname = 'registration_one_active'`
    expect(index?.indexdef).toMatch(/CREATE UNIQUE INDEX registration_one_active/)
    expect(index?.indexdef).toMatch(/\("eventId", "participantId"\)/)
    expect(index?.indexdef).toMatch(/WHERE.*'REGISTERED'.*'CHECKED_IN'/)
  })

  it('rejects a second active registration, then allows one again after the first is cancelled', async () => {
    const event = await makeEvent(organizerId)
    const participant = await makeParticipant()

    await expect(insertRegistrationRaw(event.id, participant.id, 'REGISTERED')).resolves.toBe(1)
    await expect(insertRegistrationRaw(event.id, participant.id, 'REGISTERED')).rejects.toThrow(
      UNIQUE_ON_EVENT_AND_PARTICIPANT,
    )
    await expect(insertRegistrationRaw(event.id, participant.id, 'CHECKED_IN')).rejects.toThrow(
      UNIQUE_ON_EVENT_AND_PARTICIPANT,
    )

    await prisma.registration.updateMany({
      where: { eventId: event.id, participantId: participant.id },
      data: { status: 'CANCELLED' },
    })
    await expect(insertRegistrationRaw(event.id, participant.id, 'REGISTERED')).resolves.toBe(1)
    expect(await prisma.registration.count({ where: { eventId: event.id, participantId: participant.id } })).toBe(2)
  })

  it('lets two different participants hold active registrations for the same event', async () => {
    const event = await makeEvent(organizerId)
    const [a, b] = [await makeParticipant(), await makeParticipant()]
    await expect(insertRegistrationRaw(event.id, a.id, 'REGISTERED')).resolves.toBe(1)
    await expect(insertRegistrationRaw(event.id, b.id, 'REGISTERED')).resolves.toBe(1)
  })
})
