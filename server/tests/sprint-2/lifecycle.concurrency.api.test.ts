import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from '../../src/domain/password.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { HOUR, makeEvent, makeParticipant, makeUser, prisma, resetDb } from '../helpers/db.js'

// TEST-L-03 (AC-L-03, BR-09, NFR-05): a capacity cut racing new registrations (Sprint 2 STS §1.4). Capacity 10 with
// 8 active; the owner's E-13 capacity 8 and 5 participants' E-09 are sent at once; 20 rounds. Both endpoints lock the
// event row, so either the cut wins (every registration is EVENT_FULL) or some registrations win first (the cut is
// then CAPACITY_BELOW_REGISTERED). Active never exceeds capacity.
const app = makeApp()
const ROUNDS = 20
const RACERS = 5
const ACTIVE = { in: ['REGISTERED', 'CHECKED_IN'] as ('REGISTERED' | 'CHECKED_IN')[] }

let ownerId = 0
let owner = ''
let racers: string[] = []

beforeAll(async () => {
  await resetDb()
  const password = 'race-test-password'
  const passwordHash = await hashPassword(password)
  const organizer = await makeUser('ORGANIZER', 'Race Owner', { passwordHash })
  const players = await Promise.all(Array.from({ length: RACERS }, () => makeUser('PARTICIPANT', undefined, { passwordHash })))
  const session = async (email: string) => {
    const res = await signIn(request(app), email, password)
    expect(res.status).toBe(200)
    return cookieHeader(readSessionCookie(res)!.value)
  }
  ownerId = organizer.id
  owner = await session(organizer.email)
  racers = []
  for (const p of players) racers.push(await session(p.email))
}, 120_000)
afterAll(() => prisma.$disconnect())

describe('TEST-L-03 — a capacity cut and registrations racing for the last seats (AC-L-03, BR-09, NFR-05)', () => {
  it(`${ROUNDS} rounds: active ≤ capacity, and the outcome is one of the two allowed ones`, async () => {
    const outcomes = new Set<string>()
    for (let round = 1; round <= ROUNDS; round++) {
      const event = await makeEvent(ownerId, { capacity: 10, startAt: new Date(Date.now() + 24 * HOUR) })
      for (let i = 0; i < 8; i++) {
        const other = await makeParticipant()
        await prisma.registration.create({ data: { eventId: event.id, participantId: other.id } })
      }

      const [cut, ...registrations] = await Promise.all([
        request(app).patch(`/api/organizer/events/${event.id}`).set('Origin', TEST_ORIGIN).set('Cookie', owner).send({ capacity: 8 }),
        ...racers.map((cookie) =>
          request(app).post(`/api/events/${event.id}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', cookie),
        ),
      ])
      const won = registrations.filter((r) => r.status === 201).length
      const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } })
      const active = await prisma.registration.count({ where: { eventId: event.id, status: ACTIVE } })

      expect(active, `round ${round}`).toBeLessThanOrEqual(stored.capacity)
      expect(active, `round ${round}`).toBe(8 + won)
      if (cut.status === 200) {
        // The cut won the lock first: capacity 8 = active 8, so every registration is full.
        expect([stored.capacity, won], `round ${round}`).toEqual([8, 0])
        expect(registrations.map((r) => r.body.error?.code), `round ${round}`).toEqual(Array(RACERS).fill('EVENT_FULL'))
        outcomes.add('cut first')
      } else {
        // Some registrations won first: the cut is refused and capacity stays 10.
        expect([cut.status, cut.body.error.code, stored.capacity], `round ${round}`).toEqual([409, 'CAPACITY_BELOW_REGISTERED', 10])
        expect(won, `round ${round}`).toBeGreaterThanOrEqual(1)
        expect(won, `round ${round}`).toBeLessThanOrEqual(2)
        outcomes.add('registrations first')
      }
    }
    expect(outcomes.size, `outcomes seen: ${[...outcomes].join(', ')}`).toBeGreaterThanOrEqual(1)
  }, 300_000)
})

// TEST-N-06 (AC-N-06, NFR-05, BR-06): a cancellation and registrations racing for one freed seat (STS §1.4).
// Capacity 2, P1 holds a seat and another player holds the second; P1's E-16 and 10 other players' E-09 are sent at
// once; exactly one E-09 wins and active = 2. Separately, one participant sends E-16 twice: one 200, one
// 409 ALREADY_CANCELLED. 20 rounds. E-16 and E-09 lock the same event row.
describe('TEST-N-06 — cancel racing registrations, and a double cancel (AC-N-06, NFR-05, BR-06)', () => {
  const N_ROUNDS = 20
  const OTHERS = 10
  let organizerId = 0
  let p1: { id: number; cookie: string }
  let others: string[] = []

  const sessionOf = async (email: string, password: string) => {
    const res = await signIn(request(app), email, password)
    expect(res.status).toBe(200)
    return cookieHeader(readSessionCookie(res)!.value)
  }

  beforeAll(async () => {
    const password = 'race-test-password'
    const passwordHash = await hashPassword(password)
    organizerId = (await makeUser('ORGANIZER', 'Cancel Race Owner', { passwordHash })).id
    const first = await makeUser('PARTICIPANT', undefined, { passwordHash })
    p1 = { id: first.id, cookie: await sessionOf(first.email, password) }
    others = []
    for (let i = 0; i < OTHERS; i++) {
      const u = await makeUser('PARTICIPANT', undefined, { passwordHash })
      others.push(await sessionOf(u.email, password))
    }
  }, 120_000)

  it(`${N_ROUNDS} rounds: one of ${OTHERS} registrations wins the freed seat; active = 2`, async () => {
    for (let round = 1; round <= N_ROUNDS; round++) {
      const event = await makeEvent(organizerId, { capacity: 2, startAt: new Date(Date.now() + 24 * HOUR) })
      const mine = await prisma.registration.create({ data: { eventId: event.id, participantId: p1.id } })
      const holder = await makeParticipant()
      await prisma.registration.create({ data: { eventId: event.id, participantId: holder.id } })

      const [cancelled, ...registrations] = await Promise.all([
        request(app).post(`/api/me/registrations/${mine.id}/cancel`).set('Origin', TEST_ORIGIN).set('Cookie', p1.cookie),
        ...others.map((cookie) =>
          request(app).post(`/api/events/${event.id}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', cookie),
        ),
      ])
      const won = registrations.filter((r) => r.status === 201).length
      const active = await prisma.registration.count({ where: { eventId: event.id, status: ACTIVE } })
      expect(cancelled.status, `round ${round}`).toBe(200)
      expect(won, `round ${round}`).toBe(1)
      expect(active, `round ${round}`).toBe(2)
      expect(registrations.filter((r) => r.status !== 201).map((r) => r.body.error?.code), `round ${round}`).toEqual(
        Array(OTHERS - 1).fill('EVENT_FULL'),
      )
    }
  }, 300_000)

  it(`${N_ROUNDS} rounds: two simultaneous cancels give one 200 and one 409 ALREADY_CANCELLED`, async () => {
    for (let round = 1; round <= N_ROUNDS; round++) {
      const event = await makeEvent(organizerId, { capacity: 2, startAt: new Date(Date.now() + 24 * HOUR) })
      const mine = await prisma.registration.create({ data: { eventId: event.id, participantId: p1.id } })
      const send = () => request(app).post(`/api/me/registrations/${mine.id}/cancel`).set('Origin', TEST_ORIGIN).set('Cookie', p1.cookie)
      const [a, b] = await Promise.all([send(), send()])
      expect([a.status, b.status].sort(), `round ${round}`).toEqual([200, 409])
      expect([a, b].find((r) => r.status === 409)!.body.error.code, `round ${round}`).toBe('ALREADY_CANCELLED')
      expect(await prisma.registration.count({ where: { eventId: event.id, status: ACTIVE } }), `round ${round}`).toBe(0)
    }
  }, 300_000)
})
