import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from '../../src/domain/password.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { MINUTE, HOUR, makeEvent, makeUser, prisma, resetDb } from '../helpers/db.js'

// TEST-P-06 (AC-P-06, BR-19, NFR-05), Sprint 3 STS §1.4. E-18 locks the event row, as E-16 and E-09 do, so
// (a) two check-ins of one registration give one 200 and one 409 ALREADY_CHECKED_IN with one change row, and
// (b) the owner's check-in racing the player's own cancel ends in exactly one of CHECKED_IN or CANCELLED, never both
// timestamps. 20 rounds each, on the real clock: every event starts 30 minutes from now (window open, deadline open).
const app = makeApp()
const ROUNDS = 20
const CHECK_IN = (id: number) => `/api/organizer/registrations/${id}/check-in`

let ownerId = 0
let playerId = 0
let owner = ''
let player = ''

beforeAll(async () => {
  await resetDb()
  const password = 'race-test-password'
  const passwordHash = await hashPassword(password)
  const organizer = await makeUser('ORGANIZER', 'Race Owner', { passwordHash })
  const participant = await makeUser('PARTICIPANT', 'Race Player', { passwordHash })
  const session = async (email: string) => {
    const res = await signIn(request(app), email, password)
    expect(res.status).toBe(200)
    return cookieHeader(readSessionCookie(res)!.value)
  }
  ownerId = organizer.id
  playerId = participant.id
  owner = await session(organizer.email)
  player = await session(participant.email)
}, 120_000)
afterAll(() => prisma.$disconnect())

const freshRegistration = async () => {
  const event = await makeEvent(ownerId, { startAt: new Date(Date.now() + 30 * MINUTE), endAt: new Date(Date.now() + 4 * HOUR) })
  const reg = await prisma.registration.create({ data: { eventId: event.id, participantId: playerId } })
  return { event, reg }
}
const checkIn = (id: number) => request(app).post(CHECK_IN(id)).set('Origin', TEST_ORIGIN).set('Cookie', owner).send({})

describe('TEST-P-06a — two check-ins of the same registration at once (AC-P-06, BR-19, NFR-05)', () => {
  it(`${ROUNDS} rounds: one 200, one 409 ALREADY_CHECKED_IN, one change row`, async () => {
    for (let round = 1; round <= ROUNDS; round++) {
      const { event, reg } = await freshRegistration()
      const results = await Promise.all([checkIn(reg.id), checkIn(reg.id)])
      const outcome = results.map((r) => `${r.status} ${r.body.error?.code ?? r.body.status}`).sort()
      expect(outcome, `round ${round}`).toEqual(['200 CHECKED_IN', '409 ALREADY_CHECKED_IN'])
      const changes = await prisma.eventChange.count({ where: { eventId: event.id, field: 'attendance' } })
      expect(changes, `round ${round}`).toBe(1)
    }
  }, 300_000)
})

describe('TEST-P-06b — the owner checks in while the player cancels (AC-P-06, BR-19, NFR-05)', () => {
  it(`${ROUNDS} rounds: exactly CHECKED_IN or CANCELLED, never both timestamps, and the loser got the matching 409`, async () => {
    const outcomes = new Set<string>()
    for (let round = 1; round <= ROUNDS; round++) {
      const { reg } = await freshRegistration()
      const [ownerRes, playerRes] = await Promise.all([
        checkIn(reg.id),
        request(app).post(`/api/me/registrations/${reg.id}/cancel`).set('Origin', TEST_ORIGIN).set('Cookie', player).send({}),
      ])
      const stored = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } })
      expect(stored.checkedInAt !== null && stored.cancelledAt !== null, `round ${round}: both timestamps`).toBe(false)
      if (stored.status === 'CHECKED_IN') {
        expect([ownerRes.status, playerRes.status, playerRes.body.error?.code], `round ${round}`).toEqual([200, 409, 'ALREADY_CHECKED_IN'])
        outcomes.add('check-in first')
      } else {
        expect(stored.status, `round ${round}`).toBe('CANCELLED')
        expect([playerRes.status, ownerRes.status, ownerRes.body.error?.code], `round ${round}`).toEqual([200, 409, 'REGISTRATION_NOT_ACTIVE'])
        outcomes.add('cancel first')
      }
    }
    expect(outcomes.size, `outcomes seen: ${[...outcomes].join(', ')}`).toBeGreaterThanOrEqual(1)
  }, 300_000)
})
