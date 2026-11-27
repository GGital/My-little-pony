import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb, tableCounts } from '../helpers/db.js'

// Feature-O, E-15 POST /api/organizer/events/:id/cancel (Sprint 2 contracts §6). STS §2.1.
// TEST-O-01 … 05 here; the unit rules are in unit/, the race in lifecycle.concurrency.api.test.ts.
const app = makeApp()
const SEED_PASSWORD = 'test-only-seed-password'
const T = new Date('2030-03-01T08:00:00.000Z')
const HOUR = 3_600_000
const REASON = 'Store closed for renovation.'
const REASON_MESSAGE = 'Give a reason of 5 to 200 characters.'
const E15 = (id: number | string) => `/api/organizer/events/${id}/cancel`

const cookies = { quantum: '', dragon: '', mint: '', nok: '', ploy: '', boss: '' }
const ids = { quantum: 0, nok: 0, mint: 0, ploy: 0, boss: 0 }

async function sessionFor(email: string) {
  const res = await signIn(request(app), email, SEED_PASSWORD)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}

const cancel = (id: number | string, cookie: string | undefined, body: unknown = { reason: REASON }, origin: string | null = TEST_ORIGIN) => {
  const req = request(app).post(E15(id))
  if (origin) req.set('Origin', origin)
  if (cookie) req.set('Cookie', cookie)
  return req.send(body as object)
}
const get = (path: string, cookie?: string) => {
  const req = request(app).get(path)
  return cookie ? req.set('Cookie', cookie) : req
}

let n = 0
/** An event owned by Quantum Cards: published unless `over` says otherwise, starting 24 h after T. */
const makeEvent = (over: { status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'; startAt?: Date } = {}) => {
  const startAt = over.startAt ?? new Date(T.getTime() + 24 * HOUR)
  return prisma.event.create({
    data: {
      organizerId: ids.quantum,
      title: `Cancel test ${++n}`,
      type: 'CASUAL',
      format: 'CONSTRUCTED',
      venueName: 'Quantum Cards',
      venueAddress: '1 Test Road',
      city: 'Bangkok',
      startAt,
      endAt: new Date(startAt.getTime() + 4 * HOUR),
      capacity: 24,
      status: over.status ?? 'PUBLISHED',
      publishedAt: over.status === 'DRAFT' ? null : T,
    },
  })
}
const register = (eventId: number, participantId: number, status: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED' = 'REGISTERED') =>
  prisma.registration.create({ data: { eventId, participantId, status } })

/** Read straight from the tables, independently of the endpoints (STS §1.1 rule 2). */
const storedEvent = (id: number) => prisma.event.findUniqueOrThrow({ where: { id } })
const storedRegs = (eventId: number) => prisma.registration.findMany({ where: { eventId }, orderBy: { id: 'asc' } })
const storedChanges = (eventId: number) => prisma.$queryRaw<
  { field: string; oldValue: string | null; newValue: string; changedById: number; changedAt: Date }[]
>`SELECT "field"::text AS field, "oldValue", "newValue", "changedById", "changedAt"
  FROM "EventChange" WHERE "eventId" = ${eventId} ORDER BY id`

beforeAll(async () => {
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  setNow(T)
  cookies.quantum = await sessionFor('quantum@organizer.example')
  cookies.dragon = await sessionFor('dragon@organizer.example')
  cookies.mint = await sessionFor('mint@player.example')
  cookies.nok = await sessionFor('nok@player.example')
  cookies.ploy = await sessionFor('ploy@player.example')
  cookies.boss = await sessionFor('boss@player.example')
  for (const [key, email] of [
    ['quantum', 'quantum@organizer.example'],
    ['nok', 'nok@player.example'],
    ['mint', 'mint@player.example'],
    ['ploy', 'ploy@player.example'],
    ['boss', 'boss@player.example'],
  ] as const) {
    ids[key] = (await prisma.user.findUniqueOrThrow({ where: { email } })).id
  }
})
afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-O-01 (I) the owner cancels: event, registrations and history change together (AC-O-01, FR-10, FR-28, BR-12)', () => {
  it('E-15: 200 CANCELLED with reason and time; 3 active → EVENT_CANCELLED; the CANCELLED row is untouched; one PUBLISHED → CANCELLED row', async () => {
    const event = await makeEvent()
    const earlier = new Date(T.getTime() - HOUR)
    await register(event.id, ids.nok)
    await register(event.id, ids.mint)
    await register(event.id, ids.boss, 'CHECKED_IN')
    await prisma.registration.create({ data: { eventId: event.id, participantId: ids.ploy, status: 'CANCELLED', cancelledAt: earlier } })
    const before = await storedRegs(event.id)

    const res = await cancel(event.id, cookies.quantum)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: event.id,
      status: 'CANCELLED',
      cancelReason: REASON,
      cancelledAt: T.toISOString(),
      registeredCount: 0,
      viewer: { action: 'MANAGE' },
    })
    expect(res.body).not.toHaveProperty('cancelledById')

    const row = await storedEvent(event.id)
    expect([row.status, row.cancelledAt, row.cancelledById, row.cancelReason]).toEqual(['CANCELLED', T, ids.quantum, REASON])

    const after = await storedRegs(event.id)
    expect(after.map((r) => r.status)).toEqual(['EVENT_CANCELLED', 'EVENT_CANCELLED', 'EVENT_CANCELLED', 'CANCELLED'])
    expect(after.slice(0, 3).every((r) => r.cancelledAt?.getTime() === T.getTime())).toBe(true)
    expect(after[3]).toEqual(before[3])

    expect(await storedChanges(event.id)).toEqual([
      { field: 'status', oldValue: 'PUBLISHED', newValue: 'CANCELLED', changedById: ids.quantum, changedAt: T },
    ])
  })

  it('an event with no registrations cancels too; the reason is stored trimmed', async () => {
    const event = await makeEvent()
    const res = await cancel(event.id, cookies.quantum, { reason: `   ${REASON}  ` })
    expect(res.status).toBe(200)
    expect((await storedEvent(event.id)).cancelReason).toBe(REASON)
  })
})

describe('TEST-O-02 (I) after cancelling, everything agrees (AC-O-02, BR-04, FR-10)', () => {
  let eventId = 0
  beforeAll(async () => {
    const event = await makeEvent()
    eventId = event.id
    await register(eventId, ids.nok)
    await register(eventId, ids.mint)
    expect((await cancel(eventId, cookies.quantum)).status).toBe(200)
  })

  it('E-09 by a player is 409 REGISTRATION_CLOSED and stores nothing', async () => {
    const before = await storedRegs(eventId)
    const res = await request(app).post(`/api/events/${eventId}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', cookies.boss).send({})
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('REGISTRATION_CLOSED')
    expect(await storedRegs(eventId)).toEqual(before)
  })

  it('a second E-15 is 409 ALREADY_CANCELLED and keeps the first reason and time', async () => {
    setNow(new Date(T.getTime() + HOUR))
    const res = await cancel(eventId, cookies.quantum, { reason: 'A different reason here.' })
    setNow(T)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ALREADY_CANCELLED')
    const row = await storedEvent(eventId)
    expect([row.cancelReason, row.cancelledAt]).toEqual([REASON, T])
    expect(await storedChanges(eventId)).toHaveLength(1)
  })

  it('E-14 publish of a cancelled event is 409 ALREADY_CANCELLED', async () => {
    const res = await request(app).post(`/api/organizer/events/${eventId}/publish`).set('Origin', TEST_ORIGIN).set('Cookie', cookies.quantum).send({})
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ALREADY_CANCELLED')
  })

  it('E-13 edit of a cancelled event is 409 ALREADY_CANCELLED and changes nothing (cancellation is final)', async () => {
    const res = await request(app)
      .patch(`/api/organizer/events/${eventId}`)
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', cookies.quantum)
      .send({ title: 'A new title after cancelling' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ALREADY_CANCELLED')
    expect((await storedEvent(eventId)).title).not.toBe('A new title after cancelling')
  })

  it('E-04 leaves the event out of the default list', async () => {
    const res = await get('/api/events')
    expect(res.status).toBe(200)
    expect(res.body.items.map((e: { id: number }) => e.id)).not.toContain(eventId)
  })

  it('E-04 with include=cancelled lists it with status CANCELLED, and only then (FR-14, BR-04)', async () => {
    const res = await get('/api/events?include=cancelled')
    expect(res.status).toBe(200)
    expect(res.body.items).toContainEqual(expect.objectContaining({ id: eventId, status: 'CANCELLED' }))
    const plain = await get('/api/events')
    expect(plain.body.items.map((e: { id: number }) => e.id)).not.toContain(eventId)
  })

  it('E-05 as a visitor: still visible, with the reason and time, action CLOSED, and never cancelledById', async () => {
    const res = await get(`/api/events/${eventId}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: eventId,
      status: 'CANCELLED',
      cancelReason: REASON,
      cancelledAt: T.toISOString(),
      viewer: { action: 'CLOSED' },
    })
    expect(res.text).not.toContain('cancelledById')
  })

  it('E-05 for a player who was registered: action CLOSED and the reason is visible', async () => {
    const res = await get(`/api/events/${eventId}`, cookies.nok)
    expect(res.status).toBe(200)
    expect(res.body.viewer.action).toBe('CLOSED')
    expect(res.body.cancelReason).toBe(REASON)
  })

  it('E-05 for a published event has null cancel fields', async () => {
    const open = await makeEvent()
    const res = await get(`/api/events/${open.id}`)
    expect(res.body).toMatchObject({ cancelReason: null, cancelledAt: null })
  })

  it('E-10 shows the affected player their registration as EVENT_CANCELLED', async () => {
    const res = await get('/api/me/registrations', cookies.nok)
    expect(res.status).toBe(200)
    const item = res.body.items.find((r: { event: { id: number } }) => r.event.id === eventId)
    expect(item).toMatchObject({ status: 'EVENT_CANCELLED', event: { status: 'CANCELLED', seatsRemaining: 24 } })
  })

  it('E-07 lists it for the owner as CANCELLED', async () => {
    const res = await get('/api/organizer/events', cookies.quantum)
    expect(res.body.items).toContainEqual(expect.objectContaining({ id: eventId, status: 'CANCELLED', registeredCount: 0 }))
  })
})

describe('TEST-O-03 (I) the reason is checked before anything else changes (AC-O-03, BR-12)', () => {
  it.each([
    ['missing', {}],
    ['4 characters', { reason: 'abcd' }],
    ['201 characters', { reason: 'x'.repeat(201) }],
    ['only spaces', { reason: '     ' }],
    ['not a string', { reason: 12345 }],
  ])('a reason that is %s: 400 VALIDATION_FAILED with the reason message, and nothing changes', async (_label, body) => {
    const event = await makeEvent()
    await register(event.id, ids.nok)
    const counts = await tableCounts()

    const res = await cancel(event.id, cookies.quantum, body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details).toContainEqual({ field: 'reason', message: REASON_MESSAGE })
    expect(await tableCounts()).toEqual(counts)
    expect((await storedEvent(event.id)).status).toBe('PUBLISHED')
    expect((await storedRegs(event.id))[0]!.status).toBe('REGISTERED')
  })

  it('an unknown field in the body is 400 and changes nothing', async () => {
    const event = await makeEvent()
    const res = await cancel(event.id, cookies.quantum, { reason: REASON, status: 'PUBLISHED' })
    expect(res.status).toBe(400)
    expect((await storedEvent(event.id)).status).toBe('PUBLISHED')
  })

  it('5 and 200 characters are accepted (two events)', async () => {
    const [a, b] = [await makeEvent(), await makeEvent()]
    expect((await cancel(a.id, cookies.quantum, { reason: 'abcde' })).status).toBe(200)
    expect((await cancel(b.id, cookies.quantum, { reason: 'x'.repeat(200) })).status).toBe(200)
    expect((await storedEvent(b.id)).cancelReason).toHaveLength(200)
  })

  it('a bad path id is 400 INVALID_PATH_PARAMETER', async () => {
    const res = await cancel('abc', cookies.quantum)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_PATH_PARAMETER')
  })

  it('validation comes before ownership: a bad reason on a missing event is 400, a good one is 404', async () => {
    expect((await cancel(999999, cookies.quantum, { reason: 'abcd' })).status).toBe(400)
    expect((await cancel(999999, cookies.quantum)).status).toBe(404)
  })
})

describe('TEST-O-04 (I) only an upcoming, published event can be cancelled (AC-O-04, BR-04)', () => {
  it.each([
    ['started 1 minute ago', -1 / 60],
    ['starting exactly now', 0],
  ])('an event %s: 409 EVENT_STARTED and nothing changes', async (_label, hours) => {
    const event = await makeEvent({ startAt: new Date(T.getTime() + hours * HOUR) })
    await register(event.id, ids.nok)
    const counts = await tableCounts()

    const res = await cancel(event.id, cookies.quantum)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EVENT_STARTED')
    expect(await tableCounts()).toEqual(counts)
    expect((await storedEvent(event.id)).status).toBe('PUBLISHED')
    expect((await storedRegs(event.id))[0]!.status).toBe('REGISTERED')
  })

  it('an event one minute from now can still be cancelled', async () => {
    const event = await makeEvent({ startAt: new Date(T.getTime() + 60_000) })
    expect((await cancel(event.id, cookies.quantum)).status).toBe(200)
  })

  it('a draft: 409 NOT_PUBLISHED and nothing changes', async () => {
    const draft = await makeEvent({ status: 'DRAFT' })
    const counts = await tableCounts()
    const res = await cancel(draft.id, cookies.quantum)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('NOT_PUBLISHED')
    expect(await tableCounts()).toEqual(counts)
    expect((await storedEvent(draft.id)).status).toBe('DRAFT')
  })
})

describe('TEST-O-05 (I) only the owner can cancel (AC-O-05, BR-13, BR-14, SR-05)', () => {
  it.each([
    ["another organizer (Dragon's Den)", 'dragon', 404, 'EVENT_NOT_FOUND'],
    ['a participant (Mint)', 'mint', 403, 'FORBIDDEN'],
    ['a visitor', undefined, 401, 'UNAUTHENTICATED'],
  ] as const)('%s is refused and nothing changes', async (_who, key, status, code) => {
    const event = await makeEvent()
    await register(event.id, ids.nok)
    const counts = await tableCounts()

    const res = await cancel(event.id, key ? cookies[key] : undefined)
    expect(res.status).toBe(status)
    expect(res.body.error.code).toBe(code)
    expect(await tableCounts()).toEqual(counts)
    expect((await storedEvent(event.id)).status).toBe('PUBLISHED')
  })

  it("another organizer's event is the same 404 as a missing one", async () => {
    const event = await makeEvent()
    const foreign = await cancel(event.id, cookies.dragon)
    const missing = await cancel(999999, cookies.dragon)
    expect(foreign.text).toBe(missing.text)
  })

  it('a foreign Origin is 403 FORBIDDEN and nothing changes', async () => {
    const event = await makeEvent()
    const res = await cancel(event.id, cookies.quantum, { reason: REASON }, 'http://evil.example')
    expect(res.status).toBe(403)
    expect((await storedEvent(event.id)).status).toBe('PUBLISHED')
  })

  it('GET on the cancel path is 404 (POST only)', async () => {
    const res = await get(E15(1), cookies.quantum)
    expect(res.status).toBe(404)
  })
})
