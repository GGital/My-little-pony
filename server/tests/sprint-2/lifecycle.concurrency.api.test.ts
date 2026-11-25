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
