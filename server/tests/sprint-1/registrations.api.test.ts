import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, makeUserWithPassword, readSessionCookie, signIn } from '../helpers/auth.js'
import { HOUR, MINUTE, makeEvent, makeParticipant, prisma, resetDb } from '../helpers/db.js'

// Feature-G (contracts §10): E-09 POST /api/events/:id/registrations, against the real test database.
// Integration tests build their own data and fix the clock (STS §1.3).
const app = makeApp()
const T = new Date('2026-11-07T10:00:00.000Z')
const ACTIVE = { in: ['REGISTERED', 'CHECKED_IN'] as ('REGISTERED' | 'CHECKED_IN')[] }

type SignedIn = { id: number; cookie: string }
let p: SignedIn // participant P, not registered anywhere at the start
let o1: SignedIn // organizer, owner of the events below
let o2: SignedIn // another organizer

async function signedIn(role: 'PARTICIPANT' | 'ORGANIZER'): Promise<SignedIn> {
  const { user, password } = await makeUserWithPassword(role)
  const res = await signIn(request(app), user.email, password)
  expect(res.status).toBe(200)
  return { id: user.id, cookie: cookieHeader(readSessionCookie(res)!.value) }
}

const register = (eventId: number | string, who: SignedIn, body?: object) => {
  const req = request(app).post(`/api/events/${eventId}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', who.cookie)
  return body === undefined ? req : req.send(body)
}
const activeCount = (eventId: number, participantId?: number) =>
  prisma.registration.count({ where: { eventId, status: ACTIVE, ...(participantId ? { participantId } : {}) } })

/** An event owned by o1 starting in `startIn` ms, with `taken` active registrations by other participants. */
async function eventWith(capacity: number, taken: number, startIn = 24 * HOUR) {
  const event = await makeEvent(o1.id, { capacity, startAt: new Date(T.getTime() + startIn) })
  for (let i = 0; i < taken; i++) {
    const other = await makeParticipant()
    await prisma.registration.create({ data: { eventId: event.id, participantId: other.id } })
  }
  return event
}

beforeAll(async () => {
  await resetDb()
  setNow(T)
  p = await signedIn('PARTICIPANT')
  o1 = await signedIn('ORGANIZER')
  o2 = await signedIn('ORGANIZER')
})
beforeEach(() => setNow(T))
afterEach(() => resetNow())
afterAll(() => prisma.$disconnect())

describe('TEST-G-01 — a participant takes a seat (AC-G-01, FR-15)', () => {
  it('201 ParticipantRegistration with updated counts; one new row for P; E-05 then says REGISTERED', async () => {
    const event = await eventWith(24, 3)

    const res = await register(event.id, p)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      status: 'REGISTERED',
      createdAt: expect.stringMatching(/Z$/),
      event: { id: event.id, capacity: 24, registeredCount: 4, seatsRemaining: 20, status: 'PUBLISHED' },
    })
    // Counted independently of the code under test (STS §1.1 rule 3).
    expect(await activeCount(event.id)).toBe(4)
    const row = await prisma.registration.findUniqueOrThrow({ where: { id: res.body.id } })
    expect(row).toMatchObject({ eventId: event.id, participantId: p.id, status: 'REGISTERED' })

    const detail = await request(app).get(`/api/events/${event.id}`).set('Cookie', p.cookie)
    expect(detail.body.viewer).toEqual({ action: 'REGISTERED', registrationId: res.body.id })
    expect(detail.body.registeredCount).toBe(4)
  })

  it('a body of {} is accepted like no body', async () => {
    const event = await eventWith(8, 0)
    expect((await register(event.id, p, {})).status).toBe(201)
  })
})

describe('TEST-G-02 (I) — a full event (AC-G-02, BR-05, FR-16)', () => {
  it('2 / 2 → 409 EVENT_FULL with the contract message; still 2 active rows', async () => {
    const event = await eventWith(2, 2)
    const res = await register(event.id, p)
    expect(res.status).toBe(409)
    expect(res.body).toEqual({
      error: { code: 'EVENT_FULL', message: 'This event filled up a moment ago, so no registration was made.' },
    })
    expect(await activeCount(event.id)).toBe(2)
  })
})

describe('TEST-G-03 — one active registration per participant per event (AC-G-03, BR-06)', () => {
  it('again, then twice at the same time: every response 409 ALREADY_REGISTERED; one active row', async () => {
    const event = await eventWith(24, 0)
    expect((await register(event.id, p)).status).toBe(201)

    const responses = [await register(event.id, p), ...(await Promise.all([register(event.id, p), register(event.id, p)]))]
    for (const res of responses) {
      expect(res.status).toBe(409)
      expect(res.body.error).toEqual({ code: 'ALREADY_REGISTERED', message: "You're already registered for this event." })
    }
    expect(await activeCount(event.id, p.id)).toBe(1)
  })
})

describe('TEST-G-04 (I) — closed when started or not published (AC-G-04, BR-04)', () => {
  it.each([
    ['started 1 min ago', -MINUTE],
    ['starting exactly now (T)', 0],
  ])('%s → 409 REGISTRATION_CLOSED, no row', async (_label, startIn) => {
    const event = await eventWith(24, 0, startIn)
    const res = await register(event.id, p)
    expect(res.status).toBe(409)
    expect(res.body.error).toEqual({ code: 'REGISTRATION_CLOSED', message: 'Registration for this event has closed.' })
    expect(await activeCount(event.id)).toBe(0)
  })

  it('a draft event → 409 REGISTRATION_CLOSED, no row', async () => {
    const event = await eventWith(24, 0)
    await prisma.event.update({ where: { id: event.id }, data: { status: 'DRAFT' } })
    expect((await register(event.id, p)).body.error.code).toBe('REGISTRATION_CLOSED')
    expect(await activeCount(event.id)).toBe(0)
  })
})

describe('TEST-G-05 — organizers cannot register, even for their own event (AC-G-05, BR-10)', () => {
  it('owner and other organizer → 403 FORBIDDEN, no row', async () => {
    const event = await eventWith(24, 0)
    for (const who of [o1, o2]) {
      const res = await register(event.id, who)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    }
    expect(await activeCount(event.id)).toBe(0)
  })
})

describe('E-09 order of checks (contracts §10)', () => {
  it('a missing event → 404 EVENT_NOT_FOUND', async () => {
    const res = await register(999999, p)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND')
  })

  it.each([['abc'], ['0'], ['2147483648']])('path id %s → 400 INVALID_PATH_PARAMETER', async (id) => {
    const res = await register(id, p)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_PATH_PARAMETER')
  })

  it('a body with a field → 400 VALIDATION_FAILED, no row', async () => {
    const event = await eventWith(24, 0)
    const res = await register(event.id, p, { status: 'CHECKED_IN' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(await activeCount(event.id)).toBe(0)
  })

  it('without a session → 401 before anything else; with a foreign Origin → 403, no row', async () => {
    const event = await eventWith(24, 0)
    expect((await request(app).post(`/api/events/abc/registrations`)).status).toBe(401)
    const foreign = await request(app)
      .post(`/api/events/${event.id}/registrations`)
      .set('Origin', 'https://evil.example')
      .set('Cookie', p.cookie)
    expect(foreign.status).toBe(403)
    expect(await activeCount(event.id)).toBe(0)
  })

  it('a closed event that is also full answers REGISTRATION_CLOSED; a full one where P is registered answers ALREADY_REGISTERED', async () => {
    const closedFull = await eventWith(1, 1, -MINUTE)
    expect((await register(closedFull.id, p)).body.error.code).toBe('REGISTRATION_CLOSED')

    const full = await eventWith(2, 1)
    expect((await register(full.id, p)).status).toBe(201)
    expect((await register(full.id, p)).body.error.code).toBe('ALREADY_REGISTERED')
  })
})
