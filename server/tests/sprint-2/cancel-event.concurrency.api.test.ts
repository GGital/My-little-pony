import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from '../../src/domain/password.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { HOUR, makeEvent, makeOrganizer, makeUser, prisma, resetDb } from '../helpers/db.js'

// TEST-O-06 (AC-O-06, BR-07, NFR-02): cancelling and registering lock the same event row (Sprint 2 contracts §6,
// SDS §4.3a one-lock rule). One E-15 and ten E-09 calls are sent together; the whole thing repeats 20 times.
const app = makeApp()
const ROUNDS = 20
const RACERS = 10
const ACTIVE = { in: ['REGISTERED', 'CHECKED_IN'] as ('REGISTERED' | 'CHECKED_IN')[] }

let organizerId = 0
let ownerCookie = ''
let racers: { id: number; cookie: string }[] = []

const register = (eventId: number, cookie: string) =>
  request(app).post(`/api/events/${eventId}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', cookie)
const cancel = (eventId: number) =>
  request(app)
    .post(`/api/organizer/events/${eventId}/cancel`)
    .set('Origin', TEST_ORIGIN)
    .set('Cookie', ownerCookie)
    .send({ reason: 'Venue is no longer available.' })

async function signedIn(email: string, password: string) {
  const res = await signIn(request(app), email, password)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}

beforeAll(async () => {
  await resetDb()
  const password = 'race-test-password'
  const passwordHash = await hashPassword(password)
  const organizer = await makeUser('ORGANIZER', undefined, { passwordHash })
  organizerId = organizer.id
  ownerCookie = await signedIn(organizer.email, password)
  const users = await Promise.all(Array.from({ length: RACERS }, () => makeUser('PARTICIPANT', undefined, { passwordHash })))
  racers = []
  for (const user of users) racers.push({ id: user.id, cookie: await signedIn(user.email, password) })
}, 120_000)
afterAll(() => prisma.$disconnect())

describe('TEST-O-06 — cancelling never leaves an active registration behind (AC-O-06, BR-07, NFR-02)', () => {
  it(
    `${ROUNDS} rounds: 1 cancel + ${RACERS} registrations at once → event CANCELLED, no active registration, every E-09 is 201 or 409 REGISTRATION_CLOSED`,
    async () => {
      for (let round = 1; round <= ROUNDS; round++) {
        const event = await makeEvent(organizerId, { capacity: 20, startAt: new Date(Date.now() + 24 * HOUR) })

        const [cancelled, ...attempts] = await Promise.all([cancel(event.id), ...racers.map((r) => register(event.id, r.cookie))])

        expect(cancelled.status, `round ${round}: cancel`).toBe(200)
        for (const attempt of attempts) {
          const ok = attempt.status === 201 || (attempt.status === 409 && attempt.body.error.code === 'REGISTRATION_CLOSED')
          expect(ok, `round ${round}: E-09 answered ${attempt.status} ${attempt.body.error?.code ?? ''}`).toBe(true)
        }

        expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status, `round ${round}`).toBe('CANCELLED')
        expect(await prisma.registration.count({ where: { eventId: event.id, status: ACTIVE } }), `round ${round}`).toBe(0)

        // Every registration that got a 201 is now EVENT_CANCELLED; the rest never existed.
        const created = attempts.filter((a) => a.status === 201).length
        expect(await prisma.registration.count({ where: { eventId: event.id, status: 'EVENT_CANCELLED' } }), `round ${round}`).toBe(created)
        expect(await prisma.registration.count({ where: { eventId: event.id } }), `round ${round}`).toBe(created)
      }
    },
    300_000,
  )
})
