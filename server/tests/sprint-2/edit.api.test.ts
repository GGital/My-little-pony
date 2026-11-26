import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { DAY, HOUR, MINUTE, makeEvent, prisma, resetDb, tableCounts } from '../helpers/db.js'

// Feature-L: E-13 PATCH /api/organizer/events/:id (Sprint 2 contracts §3, v0.8 with CH-13). STS §2.3
// TEST-L-01, 02, 04, 05, 06 (I). TEST-L-03 is in lifecycle.concurrency.api.test.ts.
const app = makeApp()
const SEED_PASSWORD = 'test-only-seed-password'
const T = new Date('2030-03-01T08:00:00.000Z')
const at = (ms: number) => new Date(T.getTime() + ms)

const cookies = { quantum: '', dragon: '', mint: '' }
const users = { quantum: 0, mint: 0, ploy: 0, boss: 0 }

async function sessionFor(email: string) {
  const res = await signIn(request(app), email, SEED_PASSWORD)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}

const E13 = (id: number | string) => `/api/organizer/events/${id}`
const patch = (id: number | string, body: unknown, cookie: string | undefined = cookies.quantum, origin: string | null = TEST_ORIGIN) => {
  let req = request(app).patch(E13(id))
  if (cookie) req = req.set('Cookie', cookie)
  if (origin) req = req.set('Origin', origin)
  return req.send(body as object)
}

/** A Quantum Cards event written straight to the database (STS §1.3), with registrations by the named players. */
async function quantumEvent(over: { startAt?: Date; endAt?: Date; capacity?: number } = {}, players: (keyof typeof users)[] = []) {
  const event = await makeEvent(users.quantum, { startAt: at(2 * DAY), ...over })
  for (const who of players) await prisma.registration.create({ data: { eventId: event.id, participantId: users[who] } })
  return event
}

const storedChanges = (eventId: number) => prisma.$queryRaw<
  { field: string; oldValue: string | null; newValue: string; changedById: number; changedAt: Date }[]
>`SELECT "field"::text AS field, "oldValue", "newValue", "changedById", "changedAt"
  FROM "EventChange" WHERE "eventId" = ${eventId} ORDER BY id`
const registrationsOf = (eventId: number) =>
  prisma.registration.findMany({ where: { eventId }, orderBy: { id: 'asc' }, select: { id: true, status: true, participantId: true } })
const activeCount = (eventId: number) =>
  prisma.registration.count({ where: { eventId, status: { in: ['REGISTERED', 'CHECKED_IN'] } } })

beforeAll(async () => {
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  setNow(T)
  cookies.quantum = await sessionFor('quantum@organizer.example')
  cookies.dragon = await sessionFor('dragon@organizer.example')
  cookies.mint = await sessionFor('mint@player.example')
  for (const [key, email] of [
    ['quantum', 'quantum@organizer.example'],
    ['mint', 'mint@player.example'],
    ['ploy', 'ploy@player.example'],
    ['boss', 'boss@player.example'],
  ] as const) {
    users[key] = (await prisma.user.findUniqueOrThrow({ where: { email } })).id
  }
})
afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-L-01 (I) the owner edits details; registrations are untouched (AC-L-01, FR-09, #64)', () => {
  it('200 with the new values; E-05 agrees; one details change row naming the fields; the 3 registrations are unchanged', async () => {
    setNow(T)
    const event = await quantumEvent({}, ['mint', 'ploy', 'boss'])
    const before = await registrationsOf(event.id)

    const body = { title: 'Friday Night Modern', venueName: 'Quantum Cards Annex', description: 'New room upstairs.' }
    const res = await patch(event.id, body)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: event.id, ...body, registeredCount: 3, viewer: { action: 'MANAGE' } })

    const detail = await request(app).get(`/api/events/${event.id}`)
    expect(detail.body).toMatchObject(body)
    expect(await registrationsOf(event.id)).toEqual(before)
    expect(await storedChanges(event.id)).toEqual([
      { field: 'details', oldValue: null, newValue: 'title, venueName, description', changedById: users.quantum, changedAt: T },
    ])
  })

  it('a field sent with its current value is not a change: 200 and no change row', async () => {
    setNow(T)
    const event = await quantumEvent()
    const res = await patch(event.id, { title: event.title, capacity: event.capacity })
    expect(res.status).toBe(200)
    expect(await storedChanges(event.id)).toEqual([])
  })

  it("the owner's draft can be edited like an upcoming event (contracts §2)", async () => {
    setNow(T)
    const draft = await quantumEvent()
    await prisma.event.update({ where: { id: draft.id }, data: { status: 'DRAFT', publishedAt: null } })
    const res = await patch(draft.id, { title: 'Draft, renamed' })
    expect([res.status, res.body.status, res.body.title]).toEqual([200, 'DRAFT', 'Draft, renamed'])
  })
})

describe('TEST-L-02 (I) capacity never below the active registrations (AC-L-02, BR-09, BR-01)', () => {
  it('24 → 3 ok; 2 is 409 naming 3; 256 ok; 257, 0 and 1.5 are 400; 30 ok with 27 seats left; one capacity row per accepted value', async () => {
    setNow(T)
    const event = await quantumEvent({ capacity: 24 }, ['mint', 'ploy', 'boss'])
    const before = await registrationsOf(event.id)

    expect((await patch(event.id, { capacity: 3 })).status).toBe(200)

    const below = await patch(event.id, { capacity: 2 })
    expect(below.status).toBe(409)
    expect(below.body.error.code).toBe('CAPACITY_BELOW_REGISTERED')
    expect(below.body.error.details).toEqual([
      { field: 'capacity', message: "3 players are registered, so capacity can't go below 3." },
    ])

    expect((await patch(event.id, { capacity: 256 })).status).toBe(200)
    for (const capacity of [257, 0, 1.5]) {
      const bad = await patch(event.id, { capacity })
      expect([bad.status, bad.body.error.details?.[0]?.field], String(capacity)).toEqual([400, 'capacity'])
    }

    const res = await patch(event.id, { capacity: 30 })
    expect(res.status).toBe(200)
    const independent = await activeCount(event.id)
    expect(independent).toBe(3)
    expect(res.body.seatsRemaining).toBe(30 - independent)
    expect(res.body.seatsRemaining).toBe(27)

    expect((await storedChanges(event.id)).map((c) => [c.field, c.oldValue, c.newValue])).toEqual([
      ['capacity', '24', '3'],
      ['capacity', '3', '256'],
      ['capacity', '256', '30'],
    ])
    expect(await registrationsOf(event.id)).toEqual(before)
  })
})

describe('TEST-L-04 (I) the time rules on the resulting start and end (AC-L-04, BR-02, CH-13, NFR-11)', () => {
  it('start 1 min ago and 59 min away: 422 startAt; 60 min away (with its end): 200; end-only +25 h: 422; +24 h: 200; one day later: 200 and E-04 reorders', async () => {
    setNow(T)
    const event = await quantumEvent({ startAt: at(2 * DAY), endAt: at(2 * DAY + 4 * HOUR) })
    const marker = await quantumEvent({ startAt: at(2 * DAY + 12 * HOUR) })
    const order = async () => {
      const ids = ((await request(app).get('/api/events')).body.items as { id: number }[]).map((e) => e.id)
      return ids.indexOf(event.id) < ids.indexOf(marker.id) ? 'before marker' : 'after marker'
    }
    expect(await order()).toBe('before marker')

    for (const startAt of [at(-MINUTE), at(59 * MINUTE)]) {
      const res = await patch(event.id, { startAt: startAt.toISOString() })
      expect([res.status, res.body.error.details]).toEqual([
        422,
        [{ field: 'startAt', message: 'The start must be at least 60 minutes from now.' }],
      ])
    }

    const onTheHour = await patch(event.id, { startAt: at(HOUR).toISOString(), endAt: at(5 * HOUR).toISOString() })
    expect(onTheHour.status).toBe(200)

    const tooLong = await patch(event.id, { endAt: at(HOUR + 25 * HOUR).toISOString() })
    expect([tooLong.status, tooLong.body.error.details]).toEqual([422, [{ field: 'endAt', message: 'An event can last at most 24 hours.' }]])
    expect((await patch(event.id, { endAt: at(HOUR + 24 * HOUR).toISOString() })).status).toBe(200)

    const later = await patch(event.id, { startAt: at(3 * DAY).toISOString(), endAt: at(3 * DAY + 4 * HOUR).toISOString() })
    expect(later.status).toBe(200)
    expect(later.body.startAt).toBe(at(3 * DAY).toISOString())
    expect(await order()).toBe('after marker')
  })

  it('a new start earlier than the stored deadline is 422 on registrationDeadline, not a 500 (D-23; AC-M-02 in S2-06)', async () => {
    setNow(T)
    const event = await quantumEvent({ startAt: at(DAY), endAt: at(DAY + 4 * HOUR) })
    await prisma.event.update({ where: { id: event.id }, data: { registrationDeadline: at(20 * HOUR) } })
    const res = await patch(event.id, { startAt: at(2 * HOUR).toISOString(), endAt: at(6 * HOUR).toISOString() })
    expect([res.status, res.body.error?.details]).toEqual([
      422,
      [{ field: 'registrationDeadline', message: 'Registration must close at or before the start.' }],
    ])
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).startAt).toEqual(at(DAY))
  })
})

describe('TEST-L-05 (I) after the start only description, structure, contact and fee change (AC-L-05, BR-15, D-19)', () => {
  it('started 1 h ago: description + feeLabel 200; capacity 409 EVENT_STARTED; startAt + title 409 listing both; nothing frozen changes', async () => {
    setNow(T)
    const event = await quantumEvent({ startAt: at(-HOUR), endAt: at(3 * HOUR) }, ['mint', 'ploy'])

    const safe = await patch(event.id, { description: 'Round 2 starts at 19:00.', feeLabel: 'THB 300' })
    expect(safe.status).toBe(200)
    expect(safe.body).toMatchObject({ description: 'Round 2 starts at 19:00.', feeLabel: 'THB 300', hasStarted: true })

    const frozenRow = await prisma.event.findUniqueOrThrow({ where: { id: event.id } })
    const capacity = await patch(event.id, { capacity: 10 })
    expect([capacity.status, capacity.body.error.code, capacity.body.error.details.map((d: { field: string }) => d.field)]).toEqual([
      409, 'EVENT_STARTED', ['capacity'],
    ])
    const two = await patch(event.id, { startAt: at(DAY).toISOString(), title: 'Too late to rename' })
    expect([two.status, two.body.error.details.map((d: { field: string }) => d.field)]).toEqual([409, ['startAt', 'title']])
    expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toEqual(frozenRow)
  })

  it('an event starting exactly now counts as started (D-10)', async () => {
    setNow(T)
    const event = await quantumEvent({ startAt: T, endAt: at(4 * HOUR) })
    const res = await patch(event.id, { title: 'Starts now' })
    expect([res.status, res.body.error.code]).toEqual([409, 'EVENT_STARTED'])
  })
})

describe('TEST-L-06 (I) who may edit, and empty or forbidden bodies (AC-L-06, BR-14, NFR-02)', () => {
  it("Dragon's Den 404 (same as a missing id), Mint 403, a visitor 401, a foreign Origin 403, {} and organizerId 400, abc 400; a cancelled event 409; nothing changes", async () => {
    setNow(T)
    const event = await quantumEvent()
    const cancelled = await quantumEvent()
    await prisma.event.update({
      where: { id: cancelled.id },
      data: { status: 'CANCELLED', cancelledAt: T, cancelledById: users.quantum, cancelReason: 'Store closed.' },
    })
    const rows = async () => [
      await prisma.event.findUniqueOrThrow({ where: { id: event.id } }),
      await prisma.event.findUniqueOrThrow({ where: { id: cancelled.id } }),
    ]
    const before = { rows: await rows(), counts: await tableCounts() }

    const other = await patch(event.id, { title: 'Mine now' }, cookies.dragon)
    const missing = await patch(999999, { title: 'Mine now' }, cookies.dragon)
    expect([other.status, other.body.error.code]).toEqual([404, 'EVENT_NOT_FOUND'])
    expect(other.text).toBe(missing.text)

    const results = [
      await patch(event.id, { title: 'Mine now' }, cookies.mint),
      await patch(event.id, { title: 'Mine now' }, ''), // no cookie: a visitor
      await patch(event.id, { title: 'Mine now' }, cookies.quantum, 'https://evil.example'),
      await patch(event.id, {}),
      await patch(event.id, { organizerId: 2 }),
      await patch('abc', { title: 'Mine now' }),
      await patch(cancelled.id, { title: 'Back on' }),
    ]
    expect(results.map((r) => [r.status, r.body.error.code])).toEqual([
      [403, 'FORBIDDEN'],
      [401, 'UNAUTHENTICATED'],
      [403, 'FORBIDDEN'],
      [400, 'VALIDATION_FAILED'],
      [400, 'VALIDATION_FAILED'],
      [400, 'INVALID_PATH_PARAMETER'],
      [409, 'ALREADY_CANCELLED'],
    ])
    expect(results[3]!.body.error.details).toEqual([{ field: 'body', message: 'Change at least one field.' }])
    expect(results[4]!.body.error.details).toEqual([{ field: 'organizerId', message: 'This value cannot be set.' }])

    expect({ rows: await rows(), counts: await tableCounts() }).toEqual(before)
  })
})
