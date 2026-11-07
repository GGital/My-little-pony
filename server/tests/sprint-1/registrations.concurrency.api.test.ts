import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from '../../src/domain/password.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { HOUR, makeEvent, makeOrganizer, makeParticipant, makeUser, prisma, resetDb } from '../helpers/db.js'

// TEST-G-06 (AC-G-06, BR-07, NFR-05): the last-seat race of SDS §4.4 / diagram D1, on the real database.
// STS §1.4: 20 participants with their own sessions fire at once; the whole thing repeats 20 times.
const app = makeApp()
const ROUNDS = 20
const RACERS = 20
const ACTIVE = { in: ['REGISTERED', 'CHECKED_IN'] as ('REGISTERED' | 'CHECKED_IN')[] }

let organizerId = 0
let racers: string[] = []
let single = ''

const register = (eventId: number, cookie: string) =>
  request(app).post(`/api/events/${eventId}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', cookie)
const statuses = (responses: { status: number; body: { error?: { code: string } } }[]) =>
  responses.map((r) => (r.status === 201 ? '201' : `${r.status} ${r.body.error?.code}`)).sort()

beforeAll(async () => {
  await resetDb()
  organizerId = (await makeOrganizer()).id
  // One scrypt hash for every racer keeps set-up fast; each still signs in through the real E-01.
  const password = 'race-test-password'
  const passwordHash = await hashPassword(password)
  const users = await Promise.all(
    Array.from({ length: RACERS + 1 }, () => makeUser('PARTICIPANT', undefined, { passwordHash })),
  )
  const cookies: string[] = []
  for (const user of users) {
    const res = await signIn(request(app), user.email, password)
    expect(res.status).toBe(200)
    cookies.push(cookieHeader(readSessionCookie(res)!.value))
  }
  single = cookies.pop()!
  racers = cookies
}, 120_000)
afterAll(() => prisma.$disconnect())

describe('TEST-G-06 — the last seat can never be sold twice (AC-G-06, BR-07, NFR-05)', () => {
  it(
    `${ROUNDS} rounds: ${RACERS} racers for 1 seat → one 201, ${RACERS - 1} × 409 EVENT_FULL; 5 calls by one participant → one 201, four 409 ALREADY_REGISTERED`,
    async () => {
      for (let round = 1; round <= ROUNDS; round++) {
        // Capacity 5 with 4 active: exactly one seat left.
        const event = await makeEvent(organizerId, { capacity: 5, startAt: new Date(Date.now() + 24 * HOUR) })
        for (let i = 0; i < 4; i++) {
          const other = await makeParticipant()
          await prisma.registration.create({ data: { eventId: event.id, participantId: other.id } })
        }

        const race = await Promise.all(racers.map((cookie) => register(event.id, cookie)))
        expect(statuses(race), `round ${round}`).toEqual(['201', ...Array(RACERS - 1).fill('409 EVENT_FULL')])
        expect(await prisma.registration.count({ where: { eventId: event.id, status: ACTIVE } })).toBe(5)

        // One participant double- (quintuple-) clicking on an open event.
        const open = await makeEvent(organizerId, { capacity: 24, startAt: new Date(Date.now() + 24 * HOUR) })
        const clicks = await Promise.all(Array.from({ length: 5 }, () => register(open.id, single)))
        expect(statuses(clicks), `round ${round}`).toEqual(['201', ...Array(4).fill('409 ALREADY_REGISTERED')])
        expect(await prisma.registration.count({ where: { eventId: open.id, status: ACTIVE } })).toBe(1)
      }
    },
    300_000,
  )
})
