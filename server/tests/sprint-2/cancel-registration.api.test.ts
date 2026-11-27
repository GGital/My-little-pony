import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb, tableCounts } from '../helpers/db.js'

// Feature-N, E-16 POST /api/me/registrations/:id/cancel (Sprint 2 contracts §5). STS §2.1.
// TEST-N-01 … 05 here (and TEST-M-04); the unit rules are in unit/, the race in lifecycle.concurrency.api.test.ts.
const app = makeApp()
const SEED_PASSWORD = 'test-only-seed-password'
const T = new Date('2030-03-01T08:00:00.000Z')
const HOUR = 3_600_000
const E16 = (id: number | string) => `/api/me/registrations/${id}/cancel`

const cookies = { quantum: '', dragon: '', mint: '', nok: '', ploy: '', boss: '' }
const ids = { quantum: 0, mint: 0, nok: 0, ploy: 0, boss: 0 }

async function sessionFor(email: string) {
  const res = await signIn(request(app), email, SEED_PASSWORD)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}
const cancel = (id: number | string, cookie: string | undefined, body: unknown = {}, origin: string | null = TEST_ORIGIN) => {
  const req = request(app).post(E16(id))
  if (origin) req.set('Origin', origin)
  if (cookie) req.set('Cookie', cookie)
  return req.send(body as object)
}
const get = (path: string, cookie?: string) => {
  const req = request(app).get(path)
  return cookie ? req.set('Cookie', cookie) : req
}
const registerE09 = (eventId: number, cookie: string) =>
  request(app).post(`/api/events/${eventId}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', cookie)

let n = 0
const makeEvent = (over: { capacity?: number; startAt?: Date; registrationDeadline?: Date | null } = {}) => {
  const startAt = over.startAt ?? new Date(T.getTime() + 24 * HOUR)
  return prisma.event.create({
    data: {
      organizerId: ids.quantum,
      title: `Cancel registration test ${++n}`,
      type: 'CASUAL',
      format: 'CONSTRUCTED',
      venueName: 'Quantum Cards',
      venueAddress: '1 Test Road',
      city: 'Bangkok',
      startAt,
      endAt: new Date(startAt.getTime() + 4 * HOUR),
      capacity: over.capacity ?? 24,
      registrationDeadline: over.registrationDeadline ?? null,
      status: 'PUBLISHED',
      publishedAt: T,
    },
  })
}
const register = (
  eventId: number,
  participantId: number,
  status: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED' | 'EVENT_CANCELLED' = 'REGISTERED',
) =>
  prisma.registration.create({
    data: {
      eventId,
      participantId,
      status,
      cancelledAt: status === 'CANCELLED' || status === 'EVENT_CANCELLED' ? T : null,
      // Sprint 3 (BR-19, registration_checkin_fields): a CHECKED_IN row carries who checked it in and when.
      ...(status === 'CHECKED_IN' ? { checkedInAt: T, checkedInById: ids.quantum } : {}),
    },
  })

/** Read straight from the tables, independently of the endpoints (STS §1.1 rule 2). */
const storedRegs = (eventId: number) => prisma.registration.findMany({ where: { eventId }, orderBy: { id: 'asc' } })
const activeCount = (eventId: number) =>
  prisma.registration.count({ where: { eventId, status: { in: ['REGISTERED', 'CHECKED_IN'] } } })

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
  const users = await prisma.user.findMany({ select: { id: true, email: true } })
  const idOf = (email: string) => users.find((u) => u.email === email)!.id
  ids.quantum = idOf('quantum@organizer.example')
  ids.mint = idOf('mint@player.example')
  ids.nok = idOf('nok@player.example')
  ids.ploy = idOf('ploy@player.example')
  ids.boss = idOf('boss@player.example')
}, 120_000)
afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-N-01 · AC-N-01, FR-19, FR-28: a participant cancels their seat', () => {
  it('200 CANCELLED with cancelledAt = T, 2 / 24 by independent count, the row kept, and the other endpoints agree', async () => {
    const event = await makeEvent()
    await register(event.id, ids.nok)
    await register(event.id, ids.ploy)
    const mint = await register(event.id, ids.mint)
    expect(await activeCount(event.id)).toBe(3)

    const res = await cancel(mint.id, cookies.mint)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: mint.id, status: 'CANCELLED', cancelledAt: T.toISOString() })
    expect(res.body.event).toMatchObject({ id: event.id, registeredCount: 2, seatsRemaining: 22, capacity: 24 })

    const rows = await storedRegs(event.id)
    expect(rows).toHaveLength(3)
    const stored = rows.find((r) => r.id === mint.id)!
    expect([stored.status, stored.cancelledAt?.toISOString()]).toEqual(['CANCELLED', T.toISOString()])
    expect(await activeCount(event.id)).toBe(2)

    const mine = await get('/api/me/registrations', cookies.mint)
    const row = mine.body.items.find((r: { id: number }) => r.id === mint.id)
    expect(row).toMatchObject({ status: 'CANCELLED', cancelledAt: T.toISOString(), canCancel: false })

    const owner = await get(`/api/organizer/events/${event.id}/registrations`, cookies.quantum)
    expect(owner.status).toBe(200)
    expect(JSON.stringify(owner.body)).toContain('CANCELLED')

    const detail = await get(`/api/events/${event.id}`, cookies.mint)
    expect(detail.body.viewer).toMatchObject({ action: 'REGISTER', registrationId: null })
    expect(detail.body.registeredCount).toBe(2)
  })

  it('E-11 and E-05 show canCancel true for an active registration, and E-05 gives the registration id', async () => {
    const event = await makeEvent()
    const mint = await register(event.id, ids.mint)
    const one = await get(`/api/me/registrations/${mint.id}`, cookies.mint)
    expect(one.body).toMatchObject({ status: 'REGISTERED', canCancel: true, cancelledAt: null })
    const detail = await get(`/api/events/${event.id}`, cookies.mint)
    expect(detail.body.viewer).toMatchObject({ action: 'REGISTERED', registrationId: mint.id, canCancel: true })
  })
})

describe('TEST-N-02 · AC-N-02, FR-20, BR-06: registering again makes a new row', () => {
  it('201 with a new id, 2 rows (1 CANCELLED, 1 REGISTERED), then 409 ALREADY_REGISTERED', async () => {
    const event = await makeEvent()
    const old = await register(event.id, ids.mint)
    expect((await cancel(old.id, cookies.mint)).status).toBe(200)

    const again = await registerE09(event.id, cookies.mint)
    expect(again.status).toBe(201)
    expect(again.body.id).not.toBe(old.id)

    const rows = (await storedRegs(event.id)).filter((r) => r.participantId === ids.mint)
    expect(rows.map((r) => r.status).sort()).toEqual(['CANCELLED', 'REGISTERED'])

    const detail = await get(`/api/events/${event.id}`, cookies.mint)
    expect(detail.body.viewer).toMatchObject({ action: 'REGISTERED', registrationId: again.body.id })

    const third = await registerE09(event.id, cookies.mint)
    expect([third.status, third.body.error.code]).toEqual([409, 'ALREADY_REGISTERED'])
    expect(await storedRegs(event.id)).toHaveLength(2)
  })
})

describe('TEST-N-03 · AC-N-03, BR-05: a freed seat goes to the next player', () => {
  it('2 / 2: Ploy cancels → 200; Nok registers → 201; Ploy again → 409 EVENT_FULL; active = 2', async () => {
    const event = await makeEvent({ capacity: 2 })
    const ploy = await register(event.id, ids.ploy)
    await register(event.id, ids.boss)

    expect((await cancel(ploy.id, cookies.ploy)).status).toBe(200)
    expect((await registerE09(event.id, cookies.nok)).status).toBe(201)
    const again = await registerE09(event.id, cookies.ploy)
    expect([again.status, again.body.error.code]).toEqual([409, 'EVENT_FULL'])
    expect(await activeCount(event.id)).toBe(2)
  })
})

describe('TEST-N-04 · AC-N-04, BR-11: rows that cannot be cancelled', () => {
  it('CANCELLED and EVENT_CANCELLED → ALREADY_CANCELLED; CHECKED_IN → ALREADY_CHECKED_IN; past the deadline → REGISTRATION_CLOSED; nothing changes', async () => {
    const e1 = await makeEvent()
    const e2 = await makeEvent()
    const e3 = await makeEvent()
    const e4 = await makeEvent({ registrationDeadline: new Date(T.getTime() + HOUR) })
    const r1 = await register(e1.id, ids.mint, 'CANCELLED')
    const r2 = await register(e2.id, ids.mint, 'EVENT_CANCELLED')
    const r3 = await register(e3.id, ids.mint, 'CHECKED_IN')
    const r4 = await register(e4.id, ids.mint)
    const where = { id: { in: [r1.id, r2.id, r3.id, r4.id] } }
    const before = await prisma.registration.findMany({ where, orderBy: { id: 'asc' } })

    const out: [number, string | undefined][] = []
    for (const r of [r1, r2, r3]) {
      const res = await cancel(r.id, cookies.mint)
      out.push([res.status, res.body.error?.code])
    }
    // e4's deadline (T + 1 h) has passed once the clock is at T + 2 h.
    setNow(new Date(T.getTime() + 2 * HOUR))
    try {
      const res = await cancel(r4.id, cookies.mint)
      out.push([res.status, res.body.error?.code])
    } finally {
      setNow(T)
    }
    expect(out).toEqual([
      [409, 'ALREADY_CANCELLED'],
      [409, 'ALREADY_CANCELLED'],
      [409, 'ALREADY_CHECKED_IN'],
      [409, 'REGISTRATION_CLOSED'],
    ])
    expect(await prisma.registration.findMany({ where, orderBy: { id: 'asc' } })).toEqual(before)
  })
})

describe('TEST-M-04 · AC-M-04, BR-08, BR-11: the deadline closes cancelling too', () => {
  it('canCancel is true at D − 1 min and false at D on E-10, E-11 and E-05; E-16 at D is 409 REGISTRATION_CLOSED', async () => {
    const D = new Date(T.getTime() + 2 * HOUR)
    const event = await makeEvent({ registrationDeadline: D })
    const reg = await register(event.id, ids.mint)
    const flags = async () => {
      const list = await get('/api/me/registrations', cookies.mint)
      const e10 = list.body.items.find((r: { id: number }) => r.id === reg.id).canCancel
      const e11 = (await get(`/api/me/registrations/${reg.id}`, cookies.mint)).body.canCancel
      const e05 = (await get(`/api/events/${event.id}`, cookies.mint)).body.viewer.canCancel
      return [e10, e11, e05]
    }
    try {
      setNow(new Date(D.getTime() - 60_000))
      expect(await flags()).toEqual([true, true, true])
      setNow(D)
      expect(await flags()).toEqual([false, false, false])
      const res = await cancel(reg.id, cookies.mint)
      expect([res.status, res.body.error.code]).toEqual([409, 'REGISTRATION_CLOSED'])
      expect((await storedRegs(event.id))[0]?.status).toBe('REGISTERED')
    } finally {
      setNow(T)
    }
  })
})

describe('TEST-N-05 · AC-N-05, BR-11, BR-16, BR-17, NFR-02: who may cancel', () => {
  it('another player and a missing id give the same 404; the owner 403; a visitor 401; a foreign Origin 403; a body with participantId 400', async () => {
    const event = await makeEvent()
    const reg = await register(event.id, ids.mint)
    const before = await storedRegs(event.id)
    const tables = await tableCounts()

    const missing = await cancel(999999, cookies.mint)
    expect([missing.status, missing.body.error.code]).toEqual([404, 'REGISTRATION_NOT_FOUND'])

    const ploy = await cancel(reg.id, cookies.ploy)
    expect(ploy.status).toBe(404)
    expect(ploy.text).toBe(missing.text)

    expect((await cancel(reg.id, cookies.quantum)).status).toBe(403)
    expect((await cancel(reg.id, undefined)).status).toBe(401)
    expect((await cancel(reg.id, cookies.mint, {}, 'https://evil.example')).status).toBe(403)
    expect((await cancel(reg.id, cookies.mint, { participantId: ids.ploy })).status).toBe(400)
    expect((await cancel('abc', cookies.mint)).status).toBe(400)

    expect(await storedRegs(event.id)).toEqual(before)
    expect(await tableCounts()).toEqual(tables)
  })

  it('an empty body and no body both cancel', async () => {
    const event = await makeEvent()
    const reg = await register(event.id, ids.mint)
    const res = await request(app).post(E16(reg.id)).set('Origin', TEST_ORIGIN).set('Cookie', cookies.mint)
    expect(res.status).toBe(200)
    const event2 = await makeEvent()
    const reg2 = await register(event2.id, ids.mint)
    expect((await cancel(reg2.id, cookies.mint, {})).status).toBe(200)
  })
})

// TEST-B-03 rows (E-16), SDS §7.1: the permission-matrix cells of the new endpoint. TEST-SR2-03 has its route row in
// helpers/routes.ts.
describe('TEST-B-03 rows (E-16) POST /api/me/registrations/:id/cancel', () => {
  it('visitor 401; owner 403; another organizer (Dragon Den) 403; another player 404; the registered player 200', async () => {
    const event = await makeEvent()
    const reg = await register(event.id, ids.mint)
    expect((await cancel(reg.id, undefined)).status).toBe(401)
    expect((await cancel(reg.id, cookies.quantum)).status).toBe(403)
    expect((await cancel(reg.id, cookies.dragon)).status).toBe(403)
    expect((await cancel(reg.id, cookies.ploy)).status).toBe(404)
    expect((await storedRegs(event.id))[0]!.status).toBe('REGISTERED')
    expect((await cancel(reg.id, cookies.mint)).status).toBe(200)
  })
})
