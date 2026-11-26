import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb } from '../helpers/db.js'

// Feature-M: the registration deadline on E-06, E-13, E-04, E-05, E-07 and E-09 (Sprint 2 contracts §0.3, §4).
// STS §2.4 TEST-M-01 … 03 (I). TEST-M-04 (canCancel, E-16) moved to S2-07 (decision 26 Nov 2026).
const app = makeApp()
const SEED_PASSWORD = 'test-only-seed-password'
const T = new Date('2030-03-01T08:00:00.000Z')
const MIN = 60_000
const HOUR = 60 * MIN
const at = (ms: number) => new Date(T.getTime() + ms)
const iso = (ms: number) => at(ms).toISOString()

const cookies = { quantum: '', nok: '' }
let n = 0

async function sessionFor(email: string) {
  const res = await signIn(request(app), email, SEED_PASSWORD)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}

/** E-06 by Quantum Cards on the clock as it is: start `startIn` ms after T, 4 h long, optional deadline. */
async function create(startIn: number, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/events')
    .set('Origin', TEST_ORIGIN)
    .set('Cookie', cookies.quantum)
    .send({
      title: `Deadline Night ${++n}`, type: 'CASUAL', format: 'CONSTRUCTED', venueName: 'Quantum Cards',
      venueAddress: '1631 Kanchanaphisek Rd', city: 'Bangkok', capacity: 8,
      startAt: iso(startIn), endAt: iso(startIn + 4 * HOUR), ...extra,
    })
  return res
}
const patch = (id: number, body: object) =>
  request(app).patch(`/api/organizer/events/${id}`).set('Origin', TEST_ORIGIN).set('Cookie', cookies.quantum).send(body)
const register = (id: number) =>
  request(app).post(`/api/events/${id}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', cookies.nok)

beforeAll(async () => {
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  setNow(T)
  cookies.quantum = await sessionFor('quantum@organizer.example')
  cookies.nok = await sessionFor('nok@player.example')
})
afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-M-01 (I) setting a deadline, and the effective deadline everywhere (AC-M-01, BR-08)', () => {
  it('E-06 without a deadline answers the start; with start − 2 h answers that; E-13 sets one and writes a deadline row', async () => {
    setNow(T)
    const plain = await create(24 * HOUR)
    expect(plain.status).toBe(201)
    expect(plain.body.registrationDeadline).toBe(iso(24 * HOUR))
    expect((await prisma.event.findUniqueOrThrow({ where: { id: plain.body.id } })).registrationDeadline).toBeNull()

    const early = await create(24 * HOUR, { registrationDeadline: iso(22 * HOUR) })
    expect(early.status).toBe(201)
    expect(early.body.registrationDeadline).toBe(iso(22 * HOUR))

    const set = await patch(plain.body.id, { registrationDeadline: iso(20 * HOUR) })
    expect(set.status).toBe(200)
    expect(set.body.registrationDeadline).toBe(iso(20 * HOUR))
    const rows = await prisma.eventChange.findMany({ where: { eventId: plain.body.id, field: 'deadline' } })
    expect(rows.map((r) => [r.oldValue, r.newValue])).toEqual([[iso(24 * HOUR), iso(20 * HOUR)]])

    const detail = await request(app).get(`/api/events/${plain.body.id}`)
    expect(detail.body.registrationDeadline).toBe(iso(20 * HOUR))
  })

  it('E-04 and E-07 carry the effective deadline on every summary', async () => {
    setNow(T)
    const event = await create(30 * HOUR, { registrationDeadline: iso(29 * HOUR) })
    // Searched by its title, so paging (20 per page, Feature-J) can't push it off the first page.
    const list = await request(app).get(`/api/events?q=${encodeURIComponent(event.body.title)}`)
    const listed = list.body.items.find((e: { id: number }) => e.id === event.body.id)
    expect(listed.registrationDeadline).toBe(iso(29 * HOUR))
    const mine = await request(app).get('/api/organizer/events').set('Cookie', cookies.quantum)
    for (const item of mine.body.items) expect(item.registrationDeadline, `event ${item.id}`).toEqual(expect.stringMatching(/Z$/))
  })

  it('E-06 refuses a deadline that is not an ISO time with an offset (400 "Enter a date and time.")', async () => {
    setNow(T)
    const res = await create(24 * HOUR, { registrationDeadline: 'tomorrow' })
    expect([res.status, res.body.error.details]).toEqual([400, [{ field: 'registrationDeadline', message: 'Enter a date and time.' }]])
  })
})

describe('TEST-M-02 (I) the deadline rules on E-13 and E-06 (AC-M-02, BR-08, D-23)', () => {
  it('start + 1 min, now and 1 min ago are 422; the start itself and null are 200 (null gives back the start)', async () => {
    setNow(T)
    const event = (await create(24 * HOUR)).body
    const refused = [
      [iso(24 * HOUR + MIN), 'Registration must close at or before the start.'],
      [iso(0), 'The deadline must be in the future.'],
      [iso(-MIN), 'The deadline must be in the future.'],
    ] as const
    for (const [deadline, message] of refused) {
      const res = await patch(event.id, { registrationDeadline: deadline })
      expect([res.status, res.body.error?.details], deadline).toEqual([422, [{ field: 'registrationDeadline', message }]])
    }
    const atStart = await patch(event.id, { registrationDeadline: iso(24 * HOUR) })
    expect([atStart.status, atStart.body.registrationDeadline]).toEqual([200, iso(24 * HOUR)])
    const cleared = await patch(event.id, { registrationDeadline: null })
    expect([cleared.status, cleared.body.registrationDeadline]).toEqual([200, iso(24 * HOUR)])
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).registrationDeadline).toBeNull()
  })

  it('a new start earlier than the stored deadline is 422 on registrationDeadline (D-23); with a new deadline in the same body it is fine', async () => {
    setNow(T)
    const event = (await create(24 * HOUR, { registrationDeadline: iso(20 * HOUR) })).body
    const earlier = await patch(event.id, { startAt: iso(2 * HOUR), endAt: iso(6 * HOUR) })
    expect([earlier.status, earlier.body.error?.details?.[0]?.field]).toEqual([422, 'registrationDeadline'])
    const both = await patch(event.id, { startAt: iso(3 * HOUR), endAt: iso(7 * HOUR), registrationDeadline: iso(2 * HOUR) })
    expect([both.status, both.body.registrationDeadline]).toEqual([200, iso(2 * HOUR)])
  })

  it('E-06 refuses a deadline after the start, and one in the past', async () => {
    setNow(T)
    const late = await create(24 * HOUR, { registrationDeadline: iso(25 * HOUR) })
    const past = await create(24 * HOUR, { registrationDeadline: iso(-HOUR) })
    expect([late.status, late.body.error.details[0]]).toEqual([422, { field: 'registrationDeadline', message: 'Registration must close at or before the start.' }])
    expect([past.status, past.body.error.details[0]]).toEqual([422, { field: 'registrationDeadline', message: 'The deadline must be in the future.' }])
  })
})

describe('TEST-M-03 (I) registration closes at the deadline (AC-M-03, BR-08, BR-04, D-17)', () => {
  it('E-09 one minute before D is 201; at D and one minute after are 409 REGISTRATION_CLOSED; E-05 says CLOSED at D; E-04 still lists it', async () => {
    setNow(T)
    const D = 2 * HOUR
    const created = []
    for (let i = 0; i < 3; i++) created.push((await create(24 * HOUR, { registrationDeadline: iso(D) })).body as { id: number; title: string })
    const ids = created.map((e) => e.id)

    const results = []
    for (const [i, offset] of [-MIN, 0, MIN].entries()) {
      setNow(at(D + offset))
      results.push(await register(ids[i]!))
    }
    expect(results.map((r) => [r.status, r.body.error?.code ?? null])).toEqual([
      [201, null],
      [409, 'REGISTRATION_CLOSED'],
      [409, 'REGISTRATION_CLOSED'],
    ])
    expect(await prisma.registration.count({ where: { eventId: { in: ids } } })).toBe(1)

    setNow(at(D))
    const detail = await request(app).get(`/api/events/${ids[1]}`).set('Cookie', cookies.nok)
    expect(detail.body.viewer.action).toBe('CLOSED')
    const list = await request(app).get(`/api/events?q=${encodeURIComponent(created[1]!.title)}`)
    expect(list.body.items.map((e: { id: number }) => e.id)).toContain(ids[1])
  })
})
