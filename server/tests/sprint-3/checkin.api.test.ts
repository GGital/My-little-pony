import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb, tableCounts } from '../helpers/db.js'

// Feature-P, E-18 POST and E-19 DELETE /api/organizer/registrations/:id/check-in, and the E-08 changes (Sprint 3
// contracts §1, §0.2). STS §2.1: TEST-P-01 … P-05 (I). The unit rules are in unit/, the races in
// checkin.concurrency.api.test.ts.
const app = makeApp()
const SEED_PASSWORD = 'test-only-seed-password'
const MIN = 60_000
const HOUR = 60 * MIN
const T = new Date('2030-03-01T10:02:00.000Z') // 17:02 Bangkok
const CHECK_IN = (id: number | string) => `/api/organizer/registrations/${id}/check-in`
const E08 = (eventId: number) => `/api/organizer/events/${eventId}/registrations`
const FOREIGN = 'https://evil.example'

const cookies = { quantum: '', dragon: '', mint: '' }
const ids = { quantum: 0, mint: 0, ploy: 0, boss: 0, nok: 0 }

async function sessionFor(email: string) {
  const res = await signIn(request(app), email, SEED_PASSWORD)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}
type Opts = { cookie?: string; origin?: string | null; body?: unknown }
const checkIn = (id: number | string, { cookie, origin = TEST_ORIGIN, body }: Opts = {}) => {
  const req = request(app).post(CHECK_IN(id))
  if (origin) req.set('Origin', origin)
  if (cookie) req.set('Cookie', cookie)
  return body === undefined ? req : req.send(body as object)
}
const undo = (id: number | string, { cookie, origin = TEST_ORIGIN }: Opts = {}) => {
  const req = request(app).delete(CHECK_IN(id))
  if (origin) req.set('Origin', origin)
  if (cookie) req.set('Cookie', cookie)
  return req
}
const e08 = (eventId: number) => request(app).get(E08(eventId)).set('Cookie', cookies.quantum)

let n = 0
/** An event of Quantum Cards written straight to the database (CH-13 forbids E-06 starts this close; STS §1.3). */
const makeEvent = (startAt: Date, over: { endAt?: Date; cancelled?: boolean } = {}) =>
  prisma.event.create({
    data: {
      organizerId: ids.quantum,
      title: `Check-in test ${++n}`,
      type: 'CASUAL',
      format: 'CONSTRUCTED',
      venueName: 'Quantum Cards',
      venueAddress: '1 Test Road',
      city: 'Bangkok',
      startAt,
      endAt: over.endAt ?? new Date(startAt.getTime() + 4 * HOUR),
      capacity: 24,
      status: over.cancelled ? 'CANCELLED' : 'PUBLISHED',
      publishedAt: new Date(T.getTime() - 48 * HOUR),
      ...(over.cancelled ? { cancelledAt: T, cancelledById: ids.quantum, cancelReason: 'Store closed for repairs.' } : {}),
    },
  })
const register = (eventId: number, participantId: number, status: 'REGISTERED' | 'CANCELLED' | 'EVENT_CANCELLED' = 'REGISTERED') =>
  prisma.registration.create({ data: { eventId, participantId, status, cancelledAt: status === 'REGISTERED' ? null : T } })

/** Read straight from the tables, independently of the endpoints (STS §1.1). */
const storedReg = (id: number) => prisma.registration.findUniqueOrThrow({ where: { id } })
const attendanceChanges = (eventId: number) =>
  prisma.eventChange.findMany({ where: { eventId, field: 'attendance' }, orderBy: { id: 'asc' } })

beforeAll(async () => {
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  // Sign in on the fixed clock: a session made on the real clock has expired by T (2030).
  setNow(T)
  cookies.quantum = await sessionFor('quantum@organizer.example')
  cookies.dragon = await sessionFor('dragon@organizer.example')
  cookies.mint = await sessionFor('mint@player.example')
  const users = await prisma.user.findMany({ select: { id: true, email: true } })
  const idOf = (email: string) => users.find((u) => u.email === email)!.id
  ids.quantum = idOf('quantum@organizer.example')
  ids.mint = idOf('mint@player.example')
  ids.ploy = idOf('ploy@player.example')
  ids.boss = idOf('boss@player.example')
  ids.nok = idOf('nok@player.example')
}, 120_000)
afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-P-01 (I) · AC-P-01, FR-21, FR-28: the owner checks Mint in', () => {
  it('200 CHECKED_IN at T by Quantum Cards; the row and one attendance change row are stored; E-08 counts it; seats unchanged', async () => {
    setNow(T)
    const event = await makeEvent(new Date(T.getTime() + 30 * MIN))
    const mint = await register(event.id, ids.mint)
    const before = (await e08(event.id)).body

    const res = await checkIn(mint.id, { cookie: cookies.quantum, body: {} })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      id: mint.id,
      participant: { displayName: 'Mint' },
      status: 'CHECKED_IN',
      createdAt: mint.createdAt.toISOString(),
      cancelledAt: null,
      checkedInAt: T.toISOString(),
      checkedInBy: { displayName: 'Quantum Cards' },
    })
    expect(JSON.stringify(res.body)).not.toMatch(/mint@player\.example|participantId|checkedInById/) // BR-16

    const stored = await storedReg(mint.id)
    expect([stored.status, stored.checkedInAt?.toISOString(), stored.checkedInById]).toEqual(['CHECKED_IN', T.toISOString(), ids.quantum])
    const changes = await attendanceChanges(event.id)
    expect(changes.map((c) => [c.registrationId, c.oldValue, c.newValue, c.changedById, c.changedAt.toISOString()])).toEqual([
      [mint.id, 'REGISTERED', 'CHECKED_IN', ids.quantum, T.toISOString()],
    ])

    const after = await e08(event.id)
    expect(after.status).toBe(200)
    expect(after.body.counts).toEqual({ active: 1, checkedIn: 1 })
    expect(after.body.checkIn).toEqual({
      open: true,
      state: 'OPEN',
      opensAt: new Date(event.startAt.getTime() - 60 * MIN).toISOString(),
      closesAt: event.endAt.toISOString(),
    })
    expect(after.body.items[0]).toMatchObject({ id: mint.id, status: 'CHECKED_IN', checkedInAt: T.toISOString(), checkedInBy: { displayName: 'Quantum Cards' } })
    // Seats unchanged: a check-in keeps the seat (active = REGISTERED + CHECKED_IN).
    expect([after.body.event.registeredCount, after.body.event.seatsRemaining]).toEqual([before.event.registeredCount, before.event.seatsRemaining])
  })

  it('accepts no body at all as well as {}', async () => {
    setNow(T)
    const event = await makeEvent(new Date(T.getTime() + 30 * MIN))
    const mint = await register(event.id, ids.mint)
    expect((await checkIn(mint.id, { cookie: cookies.quantum })).status).toBe(200)
  })
})

describe('TEST-P-02 (I) · AC-P-02, BR-18, NFR-11: the window boundaries on the server clock', () => {
  it('S − 61 → 409; S − 60 → 200; E − 1 → 200; E → 409; the undo at E → 409; E-08 open false/true/true/false', async () => {
    const S = new Date(T.getTime() + 2 * HOUR)
    const E = new Date(S.getTime() + 4 * HOUR)
    const event = await makeEvent(S, { endAt: E })
    const [mint, ploy, boss, nok] = await Promise.all([ids.mint, ids.ploy, ids.boss, ids.nok].map((p) => register(event.id, p)))

    const step = async (at: Date, regId: number) => {
      setNow(at)
      const res = await checkIn(regId, { cookie: cookies.quantum, body: {} })
      const list = await e08(event.id)
      return [res.status, res.body.error?.code ?? res.body.status, list.body.checkIn?.open]
    }
    expect(await step(new Date(S.getTime() - 61 * MIN), mint!.id)).toEqual([409, 'NOT_IN_CHECK_IN_WINDOW', false])
    expect(await step(new Date(S.getTime() - 60 * MIN), ploy!.id)).toEqual([200, 'CHECKED_IN', true])
    expect(await step(new Date(E.getTime() - 1 * MIN), boss!.id)).toEqual([200, 'CHECKED_IN', true])
    expect(await step(E, nok!.id)).toEqual([409, 'NOT_IN_CHECK_IN_WINDOW', false])

    const late = await undo(ploy!.id, { cookie: cookies.quantum })
    expect([late.status, late.body.error?.code]).toEqual([409, 'NOT_IN_CHECK_IN_WINDOW'])
    expect((await storedReg(ploy!.id)).status).toBe('CHECKED_IN')
    expect((await storedReg(mint!.id)).status).toBe('REGISTERED')
    expect((await storedReg(nok!.id)).status).toBe('REGISTERED')
  })
})

describe('TEST-P-03 (I) · AC-P-03, FR-22, BR-19: the owner undoes a check-in', () => {
  it('200 REGISTERED with both check-in fields null; a second attendance row CHECKED_IN → REGISTERED; the count goes back', async () => {
    setNow(T)
    const event = await makeEvent(new Date(T.getTime() + 30 * MIN))
    const mint = await register(event.id, ids.mint)
    expect((await checkIn(mint.id, { cookie: cookies.quantum, body: {} })).status).toBe(200)

    const later = new Date(T.getTime() + 5 * MIN)
    setNow(later)
    const res = await undo(mint.id, { cookie: cookies.quantum })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: mint.id, status: 'REGISTERED', checkedInAt: null, checkedInBy: null })

    const stored = await storedReg(mint.id)
    expect([stored.status, stored.checkedInAt, stored.checkedInById]).toEqual(['REGISTERED', null, null])
    const changes = await attendanceChanges(event.id)
    expect(changes.map((c) => [c.registrationId, c.oldValue, c.newValue, c.changedAt.toISOString()])).toEqual([
      [mint.id, 'REGISTERED', 'CHECKED_IN', T.toISOString()],
      [mint.id, 'CHECKED_IN', 'REGISTERED', later.toISOString()],
    ])
    expect((await e08(event.id)).body.counts).toEqual({ active: 1, checkedIn: 0 })
  })
})

describe('TEST-P-04 (I) · AC-P-04, BR-18, BR-19: statuses that cannot be checked in or undone', () => {
  it('Mint ALREADY_CHECKED_IN; Ploy and Boss REGISTRATION_NOT_ACTIVE; undo of Nok NOT_CHECKED_IN; nothing changes', async () => {
    setNow(T)
    const start = new Date(T.getTime() + 30 * MIN)
    const event = await makeEvent(start)
    const cancelledEvent = await makeEvent(start, { cancelled: true })
    const mint = await register(event.id, ids.mint)
    expect((await checkIn(mint.id, { cookie: cookies.quantum, body: {} })).status).toBe(200)
    const ploy = await register(event.id, ids.ploy, 'CANCELLED')
    const nok = await register(event.id, ids.nok)
    const boss = await register(cancelledEvent.id, ids.boss, 'EVENT_CANCELLED')
    const before = { counts: await tableCounts(), rows: await prisma.registration.findMany({ orderBy: { id: 'asc' } }) }

    const codes = [
      await checkIn(mint.id, { cookie: cookies.quantum, body: {} }),
      await checkIn(ploy.id, { cookie: cookies.quantum, body: {} }),
      await checkIn(boss.id, { cookie: cookies.quantum, body: {} }),
      await undo(nok.id, { cookie: cookies.quantum }),
    ].map((r) => [r.status, r.body.error?.code])
    expect(codes).toEqual([
      [409, 'ALREADY_CHECKED_IN'],
      [409, 'REGISTRATION_NOT_ACTIVE'],
      [409, 'REGISTRATION_NOT_ACTIVE'],
      [409, 'NOT_CHECKED_IN'],
    ])
    expect(await tableCounts()).toEqual(before.counts)
    expect(await prisma.registration.findMany({ orderBy: { id: 'asc' } })).toEqual(before.rows)
  })
})

describe('TEST-P-05 (I) · AC-P-05, BR-14, NFR-02: who may check in, and the order of the checks', () => {
  it.each([
    ['E-18', checkIn],
    ['E-19', undo],
  ] as const)('%s: another organizer 404 byte-identical to 999999; participant 403; visitor 401; foreign Origin 403; abc 400', async (_id, call) => {
    setNow(T)
    const event = await makeEvent(new Date(T.getTime() + 30 * MIN))
    const mint = await register(event.id, ids.mint)
    const before = await tableCounts()

    const missing = await call(999999, { cookie: cookies.quantum, body: {} })
    expect([missing.status, missing.body.error?.code]).toEqual([404, 'REGISTRATION_NOT_FOUND'])
    const other = await call(mint.id, { cookie: cookies.dragon, body: {} })
    expect(other.status).toBe(404)
    expect(other.text).toBe(missing.text)

    expect((await call(mint.id, { cookie: cookies.mint, body: {} })).status).toBe(403)
    expect((await call(mint.id, { body: {} })).status).toBe(401)
    const foreign = await call(mint.id, { cookie: cookies.quantum, origin: FOREIGN, body: {} })
    expect([foreign.status, foreign.body.error?.code]).toEqual([403, 'FORBIDDEN'])
    const bad = await call('abc', { cookie: cookies.quantum, body: {} })
    expect([bad.status, bad.body.error?.code]).toEqual([400, 'INVALID_PATH_PARAMETER'])

    expect(await tableCounts()).toEqual(before)
    expect((await storedReg(mint.id)).status).toBe('REGISTERED')
  })

  it('E-18 takes no input: a body with a field is 400 before any lookup', async () => {
    setNow(T)
    const event = await makeEvent(new Date(T.getTime() + 30 * MIN))
    const mint = await register(event.id, ids.mint)
    const res = await checkIn(mint.id, { cookie: cookies.quantum, body: { checkedInBy: 99 } })
    expect([res.status, res.body.error?.code]).toEqual([400, 'VALIDATION_FAILED'])
    expect((await storedReg(mint.id)).status).toBe('REGISTERED')
  })
})

// TEST-B-03 rows (E-18, E-19), SDS §7.1: the permission-matrix cells of the new endpoints. TEST-SR2-03 has their route
// rows in helpers/routes.ts.
describe('TEST-B-03 rows (E-18, E-19) POST and DELETE /api/organizer/registrations/:id/check-in', () => {
  it('visitor 401; participant 403; another organizer 404; the owner 200 for both', async () => {
    setNow(T)
    const event = await makeEvent(new Date(T.getTime() + 30 * MIN))
    const mint = await register(event.id, ids.mint)
    expect((await checkIn(mint.id, {})).status).toBe(401)
    expect((await checkIn(mint.id, { cookie: cookies.mint })).status).toBe(403)
    expect((await checkIn(mint.id, { cookie: cookies.dragon })).status).toBe(404)
    expect((await checkIn(mint.id, { cookie: cookies.quantum })).status).toBe(200)
    expect((await undo(mint.id, {})).status).toBe(401)
    expect((await undo(mint.id, { cookie: cookies.mint })).status).toBe(403)
    expect((await undo(mint.id, { cookie: cookies.dragon })).status).toBe(404)
    expect((await undo(mint.id, { cookie: cookies.quantum })).status).toBe(200)
  })
})
