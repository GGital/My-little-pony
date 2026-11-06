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
