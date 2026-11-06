import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetNow, setNow } from '../../src/clock.js'
import { makeApp } from '../helpers/app.js'
import { cookieHeader, makeUserWithPassword, readSessionCookie, signIn } from '../helpers/auth.js'
import { HOUR, makeEvent, makeParticipant, prisma, resetDb } from '../helpers/db.js'

const DAY = 24 * HOUR

// Feature-E (contracts §8): E-07 GET /api/organizer/events on the real test database with its own data (STS §1.3).
const app = makeApp()
const T = new Date('2026-11-07T10:00:00.000Z')

type SignedIn = { id: number; cookie: string }
let o1: SignedIn // owns three events
let o2: SignedIn // owns two events
let oEmpty: SignedIn // owns no events
let p: SignedIn // participant
const ids = {
  o1Started: 0,
  o1Soon: 0,
  o1Later: 0,
  o2First: 0,
  o2Second: 0,
}

async function signedIn(role: 'PARTICIPANT' | 'ORGANIZER', name?: string): Promise<SignedIn> {
  const { user, password } = await makeUserWithPassword(role, name)
  const res = await signIn(request(app), user.email, password)
  expect(res.status).toBe(200)
  return { id: user.id, cookie: cookieHeader(readSessionCookie(res)!.value) }
}

const get = (path: string, who?: SignedIn) => {
  const req = request(app).get(path)
  return who ? req.set('Cookie', who.cookie) : req
}

beforeAll(async () => {
  await resetDb()
  setNow(T)
  o1 = await signedIn('ORGANIZER', 'Quantum Cards')
  o2 = await signedIn('ORGANIZER', "Dragon's Den")
  oEmpty = await signedIn('ORGANIZER', 'New Organizer')
  p = await signedIn('PARTICIPANT', 'Mint')

  // O1's events created out of start order so the test proves the sort.
  // One is already started (like EV-4), one soon (like EV-1), one later (like EV-6).
  const o1Later = await makeEvent(o1.id, { capacity: 32, startAt: new Date(T.getTime() + 5 * DAY) })
  const o1Started = await makeEvent(o1.id, { capacity: 8, startAt: new Date(T.getTime() - HOUR) })
  const o1Soon = await makeEvent(o1.id, { capacity: 4, startAt: new Date(T.getTime() + 2 * DAY) })

  // O2's events
  const o2First = await makeEvent(o2.id, { capacity: 16, startAt: new Date(T.getTime() + 3 * DAY) })
  const o2Second = await makeEvent(o2.id, { capacity: 2, startAt: new Date(T.getTime() + 4 * DAY) })

  Object.assign(ids, {
    o1Started: o1Started.id,
    o1Soon: o1Soon.id,
    o1Later: o1Later.id,
    o2First: o2First.id,
    o2Second: o2Second.id,
  })

  // Registrations on O1's events:
  // o1Started: 1 registration
  // o1Soon: 4 registrations (FULL)
  // o1Later: 0 registrations
  const p2 = await makeParticipant('Ploy')
  const p3 = await makeParticipant('Boss')
  const p4 = await makeParticipant('Nok')

  await prisma.registration.create({ data: { eventId: o1Started.id, participantId: p.id } })

  for (const participant of [p, p2, p3, p4]) {
    await prisma.registration.create({ data: { eventId: o1Soon.id, participantId: participant.id } })
  }
})

afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-E-01 — Organizer sees own events in start order with independent counts (AC-E-01, FR-07)', () => {
  it("O1: exactly three events, in startAt asc order; counts match independent Prisma counts", async () => {
    const res = await get('/api/organizer/events', o1)

    expect(res.status).toBe(200)
    expect(Object.keys(res.body)).toEqual(['items'])
    expect(res.body.items).toHaveLength(3)

    // Order: started (T - 1h) -> soon (T + 2d) -> later (T + 5d)
    expect(res.body.items.map((e: { id: number }) => e.id)).toEqual([
      ids.o1Started,
      ids.o1Soon,
      ids.o1Later,
    ])

    // Verify each event shape and independent count (STS §1.1 rule 3)
    for (const item of res.body.items) {
      expect(item).toMatchObject({
        id: expect.any(Number),
        title: expect.any(String),
        type: expect.any(String),
        format: expect.any(String),
        venueName: expect.any(String),
        city: expect.any(String),
        startAt: expect.stringMatching(/Z$/),
        endAt: expect.stringMatching(/Z$/),
        capacity: expect.any(Number),
        registeredCount: expect.any(Number),
        seatsRemaining: expect.any(Number),
        status: 'PUBLISHED',
      })

      const independentCount = await prisma.registration.count({
        where: {
          eventId: item.id,
          status: { in: ['REGISTERED', 'CHECKED_IN'] },
        },
      })
      expect(item.registeredCount).toBe(independentCount)
      expect(item.seatsRemaining).toBe(Math.max(0, item.capacity - independentCount))
    }
  })

  it('an organizer with no events gets 200 { items: [] }', async () => {
    const res = await get('/api/organizer/events', oEmpty)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [] })
  })
})

describe('TEST-E-02 — Organizer sees none of another organizer\'s events; participant gets 403 (AC-E-02, BR-14)', () => {
  it('O2 sees only its own events, and none of O1\'s ids', async () => {
    const res = await get('/api/organizer/events', o2)

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(2)
    expect(res.body.items.map((e: { id: number }) => e.id)).toEqual([ids.o2First, ids.o2Second])

    const o2Ids = res.body.items.map((e: { id: number }) => e.id)
    expect(o2Ids).not.toContain(ids.o1Started)
    expect(o2Ids).not.toContain(ids.o1Soon)
    expect(o2Ids).not.toContain(ids.o1Later)
  })

  it('a participant calling E-07 gets 403 FORBIDDEN; signed-out gets 401 UNAUTHENTICATED', async () => {
    const participantRes = await get('/api/organizer/events', p)
    expect(participantRes.status).toBe(403)
    expect(participantRes.body.error.code).toBe('FORBIDDEN')

    const visitorRes = await get('/api/organizer/events')
    expect(visitorRes.status).toBe(401)
    expect(visitorRes.body.error.code).toBe('UNAUTHENTICATED')
  })
})

describe('Feature-I — Event Registration List (E-08, contracts §12)', () => {
  let qc: SignedIn
  let dd: SignedIn
  let mint: SignedIn
  let ev1: { id: number; title: string }
  let ev6: { id: number; title: string }
  let regTimes: string[]

  beforeAll(async () => {
    qc = await signedIn('ORGANIZER', 'Quantum Cards')
    dd = await signedIn('ORGANIZER', "Dragon's Den")
    mint = await signedIn('PARTICIPANT', 'Mint')
    const ploy = await makeParticipant('Ploy')
    const boss = await makeParticipant('Boss')

    ev1 = await makeEvent(qc.id, {
      capacity: 24,
      startAt: new Date(T.getTime() + 2 * DAY),
    })

    ev6 = await makeEvent(qc.id, {
      capacity: 32,
      startAt: new Date(T.getTime() + 7 * DAY),
    })

    // Registered Mint, Ploy, Boss (createdAt order), but inserted Boss first, so id order and insert order differ
    // from createdAt order and the test proves the sort. Fern's CANCELLED registration is the earliest and must
    // be neither listed nor counted.
    const fern = await makeParticipant('Fern')
    const r3 = await prisma.registration.create({
      data: { eventId: ev1.id, participantId: boss.id, createdAt: new Date(T.getTime() + 3000) },
    })
    const r1 = await prisma.registration.create({
      data: { eventId: ev1.id, participantId: mint.id, createdAt: new Date(T.getTime() + 1000) },
    })
    await prisma.registration.create({
      data: { eventId: ev1.id, participantId: fern.id, status: 'CANCELLED', createdAt: new Date(T.getTime() + 500) },
    })
    const r2 = await prisma.registration.create({
      data: { eventId: ev1.id, participantId: ploy.id, createdAt: new Date(T.getTime() + 2000) },
    })
    regTimes = [r1.createdAt.toISOString(), r2.createdAt.toISOString(), r3.createdAt.toISOString()]
  })

  describe('TEST-I-01 — Owner sees who registered in createdAt order with counts; empty list (AC-I-01, FR-18)', () => {
    it('O1 gets 200 with three rows in registration order, display names, times, REGISTERED, and counts 3/24/21', async () => {
      const res = await get(`/api/organizer/events/${ev1.id}/registrations`, qc)

      expect(res.status).toBe(200)
      expect(res.body.event).toEqual({
        id: ev1.id,
        title: ev1.title,
        capacity: 24,
        registeredCount: 3,
        seatsRemaining: 21,
      })

      expect(res.body.items).toHaveLength(3)
      expect(res.body.items[0]).toMatchObject({
        participant: { displayName: 'Mint' },
        status: 'REGISTERED',
        createdAt: regTimes[0],
      })
      expect(res.body.items[1]).toMatchObject({
        participant: { displayName: 'Ploy' },
        status: 'REGISTERED',
        createdAt: regTimes[1],
      })
      expect(res.body.items[2]).toMatchObject({
        participant: { displayName: 'Boss' },
        status: 'REGISTERED',
        createdAt: regTimes[2],
      })
    })

    it('O1 gets 200 with items: [] and counts 0/32/32 on an event with no registrations (EV-6)', async () => {
      const res = await get(`/api/organizer/events/${ev6.id}/registrations`, qc)

      expect(res.status).toBe(200)
      expect(res.body.event).toEqual({
        id: ev6.id,
        title: ev6.title,
        capacity: 32,
        registeredCount: 0,
        seatsRemaining: 32,
      })
      expect(res.body.items).toEqual([])
    })
  })

  describe("TEST-I-02 — Another organizer gets 404 EVENT_NOT_FOUND, byte-identical to non-existent id (AC-I-02, BR-14)", () => {
    it("O2 calling E-08 for O1's event and for a non-existent id both get 404 EVENT_NOT_FOUND with identical bodies", async () => {
      const otherRes = await get(`/api/organizer/events/${ev1.id}/registrations`, dd)
      const missingRes = await get(`/api/organizer/events/999999/registrations`, dd)

      expect(otherRes.status).toBe(404)
      expect(otherRes.body.error.code).toBe('EVENT_NOT_FOUND')

      expect(missingRes.status).toBe(404)
      expect(missingRes.body.error.code).toBe('EVENT_NOT_FOUND')

      expect(otherRes.text).toBe(missingRes.text)
    })
  })

  describe('TEST-I-03 — Participant gets 403; response contains no email and no participantId (AC-I-03, BR-16)', () => {
    it('participant gets 403 FORBIDDEN, visitor gets 401 UNAUTHENTICATED', async () => {
      const partRes = await get(`/api/organizer/events/${ev1.id}/registrations`, mint)
      expect(partRes.status).toBe(403)
      expect(partRes.body.error.code).toBe('FORBIDDEN')

      const visitorRes = await get(`/api/organizer/events/${ev1.id}/registrations`)
      expect(visitorRes.status).toBe(401)
      expect(visitorRes.body.error.code).toBe('UNAUTHENTICATED')
    })

    it("owner's response contains no email address and no participantId / email keys (BR-16)", async () => {
      const ownerRes = await get(`/api/organizer/events/${ev1.id}/registrations`, qc)
      expect(ownerRes.status).toBe(200)

      const bodyStr = JSON.stringify(ownerRes.body)
      expect(bodyStr).not.toContain('@')
      expect(bodyStr).not.toContain('participantId')
      expect(bodyStr).not.toContain('"email"')
    })
  })
})
