import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HOUR, MINUTE, insertRegistrationRaw, makeEvent, makeOrganizer, makeParticipant, prisma, resetDb } from '../helpers/db.js'

// SR-08 data foundation (Sprint 2 contracts §1 Data, SDS §4.3). Every write here is raw SQL, so no application code
// can refuse it: only a constraint or the trigger can. STS §2.1 TEST-SR8-02 and TEST-SR8-03.
let organizerId: number
let participantId: number
const start = new Date('2030-01-10T10:00:00.000Z')

// Prisma reports a CHECK violation as SQLSTATE 23514 with the constraint name in the message.
const check = (name: string) => new RegExp(`Code: \`23514\`[\\s\\S]*${name}`)

beforeAll(async () => {
  await resetDb()
  organizerId = (await makeOrganizer()).id
  participantId = (await makeParticipant()).id
})
afterAll(() => prisma.$disconnect())

const insertChangeRaw = (eventId: number, field: string, oldValue: string | null, newValue: string) => prisma.$executeRaw`
  INSERT INTO "EventChange" ("eventId", "changedById", "field", "oldValue", "newValue", "changedAt")
  VALUES (${eventId}, ${organizerId}, ${field}::"ChangeField", ${oldValue}, ${newValue}, now())`

const readChanges = (eventId: number) => prisma.$queryRaw<{ field: string; oldValue: string | null; newValue: string }[]>`
  SELECT "field"::text AS field, "oldValue", "newValue" FROM "EventChange" WHERE "eventId" = ${eventId} ORDER BY id`

describe('TEST-SR8-02 EventChange rows are append-only (AC-SR8-02, X-11)', () => {
  it('rejects UPDATE and DELETE by the event_change_append_only trigger and leaves the rows unchanged', async () => {
    const event = await makeEvent(organizerId)
    await expect(insertChangeRaw(event.id, 'status', null, 'PUBLISHED')).resolves.toBe(1)
    await expect(insertChangeRaw(event.id, 'capacity', '24', '30')).resolves.toBe(1)
    const before = await readChanges(event.id)

    await expect(prisma.$executeRaw`UPDATE "EventChange" SET "newValue" = 'x'`).rejects.toThrow(/event_change_append_only/)
    await expect(prisma.$executeRaw`DELETE FROM "EventChange"`).rejects.toThrow(/event_change_append_only/)

    expect(await readChanges(event.id)).toEqual(before)
    expect(before).toEqual([
      { field: 'status', oldValue: null, newValue: 'PUBLISHED' },
      { field: 'capacity', oldValue: '24', newValue: '30' },
    ])
  })
})

describe('TEST-SR8-03 deadline, event cancel and registration cancel fields (AC-SR8-03, BR-08, BR-12, FR-28)', () => {
  const end = new Date(start.getTime() + 4 * HOUR)

  it('rejects a registration deadline after the start (event_deadline_before_start)', async () => {
    const event = await makeEvent(organizerId, { startAt: start, endAt: end })
    await expect(
      prisma.$executeRaw`UPDATE "Event" SET "registrationDeadline" = ${new Date(start.getTime() + MINUTE)}
                         WHERE id = ${event.id}`,
    ).rejects.toThrow(check('event_deadline_before_start'))
  })

  it('accepts a deadline exactly at the start, and no deadline', async () => {
    const event = await makeEvent(organizerId, { startAt: start, endAt: end })
    await expect(
      prisma.$executeRaw`UPDATE "Event" SET "registrationDeadline" = ${start} WHERE id = ${event.id}`,
    ).resolves.toBe(1)
    await expect(prisma.$executeRaw`UPDATE "Event" SET "registrationDeadline" = NULL WHERE id = ${event.id}`).resolves.toBe(1)
  })

  it('rejects CANCELLED without a reason, and PUBLISHED with cancelledAt set (event_cancel_fields)', async () => {
    const event = await makeEvent(organizerId)
    await expect(
      prisma.$executeRaw`UPDATE "Event" SET "status" = 'CANCELLED', "cancelledAt" = now(), "cancelledById" = ${organizerId}
                         WHERE id = ${event.id}`,
    ).rejects.toThrow(check('event_cancel_fields'))
    await expect(
      prisma.$executeRaw`UPDATE "Event" SET "cancelledAt" = now() WHERE id = ${event.id}`,
    ).rejects.toThrow(check('event_cancel_fields'))
  })

  it('accepts CANCELLED with the time, the canceller and the reason all set', async () => {
    const event = await makeEvent(organizerId)
    await expect(
      prisma.$executeRaw`UPDATE "Event" SET "status" = 'CANCELLED', "cancelledAt" = now(), "cancelledById" = ${organizerId},
                         "cancelReason" = 'Store closed.' WHERE id = ${event.id}`,
    ).resolves.toBe(1)
  })

  it('rejects a CANCELLED registration without cancelledAt, and a REGISTERED one with it (registration_cancel_fields)', async () => {
    const event = await makeEvent(organizerId)
    await expect(insertRegistrationRaw(event.id, participantId, 'CANCELLED')).rejects.toThrow(
      check('registration_cancel_fields'),
    )
    await expect(insertRegistrationRaw(event.id, participantId, 'REGISTERED')).resolves.toBe(1)
    await expect(
      prisma.$executeRaw`UPDATE "Registration" SET "cancelledAt" = now() WHERE "eventId" = ${event.id}`,
    ).rejects.toThrow(check('registration_cancel_fields'))
    await expect(
      prisma.$executeRaw`UPDATE "Registration" SET "status" = 'CANCELLED', "cancelledAt" = now() WHERE "eventId" = ${event.id}`,
    ).resolves.toBe(1)
  })
})
