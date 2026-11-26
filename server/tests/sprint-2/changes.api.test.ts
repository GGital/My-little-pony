import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb } from '../helpers/db.js'

// SR-08 change history, E-17 GET /api/organizer/events/:id/changes (Sprint 2 contracts §1). STS §2.1.
const app = makeApp()
const SEED_PASSWORD = 'test-only-seed-password'
const T = new Date('2030-03-01T08:00:00.000Z')
const E17 = (id: number | string) => `/api/organizer/events/${id}/changes`

const NEW_EVENT = {
  title: 'History Night',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  venueAddress: '1631 Kanchanaphisek Rd',
  city: 'Bangkok',
  startAt: '2030-03-10T10:00:00.000Z',
  endAt: '2030-03-10T14:00:00.000Z',
  capacity: 24,
}

const cookies = { quantum: '', dragon: '', mint: '' }
let quantumId = 0

async function sessionFor(email: string) {
  const res = await signIn(request(app), email, SEED_PASSWORD)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}

const createAsQuantum = () =>
  request(app).post('/api/events').set('Origin', TEST_ORIGIN).set('Cookie', cookies.quantum).send(NEW_EVENT)

/** Read straight from the table, independently of E-17 (STS §1.1 rule 2). */
const storedChanges = (eventId: number) => prisma.$queryRaw<
  { field: string; oldValue: string | null; newValue: string; changedById: number; changedAt: Date }[]
>`SELECT "field"::text AS field, "oldValue", "newValue", "changedById", "changedAt"
  FROM "EventChange" WHERE "eventId" = ${eventId} ORDER BY id`

beforeAll(async () => {
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  setNow(T)
  cookies.quantum = await sessionFor('quantum@organizer.example')
  cookies.dragon = await sessionFor('dragon@organizer.example')
  cookies.mint = await sessionFor('mint@player.example')
  quantumId = (await prisma.user.findUniqueOrThrow({ where: { email: 'quantum@organizer.example' } })).id
})
afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

// Decisions 24 and 25 Nov 2026: TEST-SR8-01 is split. S2-01 covers the creation row and E-17; S2-04 (#81) adds the
// capacity step (T + 1 h, E-13); S2-06 (#83) adds the deadline step (T + 2 h, E-13 registrationDeadline, Feature-M).
describe('TEST-SR8-01 (S2-01 + S2-04 parts) creating and editing an event records who and when, and E-17 shows it (AC-SR8-01, FR-28)', () => {
  it('E-06 writes status null → PUBLISHED in the same request; E-17 returns it with only the display name', async () => {
    const created = await createAsQuantum()
    expect(created.status).toBe(201)

    expect(await storedChanges(created.body.id)).toEqual([
      { field: 'status', oldValue: null, newValue: 'PUBLISHED', changedById: quantumId, changedAt: T },
    ])

    const res = await request(app).get(E17(created.body.id)).set('Cookie', cookies.quantum)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      items: [
        {
          id: expect.any(Number),
          field: 'status',
          oldValue: null,
          newValue: 'PUBLISHED',
          changedAt: T.toISOString(),
          changedBy: { displayName: 'Quantum Cards' },
        },
      ],
    })
    const text = JSON.stringify(res.body)
    expect(text).not.toContain('@')
    expect(text).not.toMatch(/changedById|organizerId|email|"userId"/)
  })

  it('S2-04 step: at T + 1 h, E-13 capacity 24 → 30 writes a capacity row; E-17 lists it first', async () => {
    setNow(T)
    const created = await createAsQuantum()
    const later = new Date(T.getTime() + 60 * 60 * 1000)
    setNow(later)
    const edit = await request(app)
      .patch(`/api/organizer/events/${created.body.id}`)
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', cookies.quantum)
      .send({ capacity: 30 })
    expect(edit.status).toBe(200)

    const res = await request(app).get(E17(created.body.id)).set('Cookie', cookies.quantum)
    expect(res.status).toBe(200)
    expect(res.body.items.map((c: Record<string, unknown>) => [c.field, c.oldValue, c.newValue, c.changedAt, c.changedBy])).toEqual([
      ['capacity', '24', '30', later.toISOString(), { displayName: 'Quantum Cards' }],
      ['status', null, 'PUBLISHED', T.toISOString(), { displayName: 'Quantum Cards' }],
    ])
    setNow(T)
  })

  it('S2-06 step (completes AC-SR8-01): T + 1 h capacity 24 → 30, T + 2 h a deadline; E-17 has 3 rows, newest first', async () => {
    setNow(T)
    const created = await createAsQuantum()
    const edit = (body: object) =>
      request(app).patch(`/api/organizer/events/${created.body.id}`).set('Origin', TEST_ORIGIN).set('Cookie', cookies.quantum).send(body)
    const plusOne = new Date(T.getTime() + 60 * 60 * 1000)
    const plusTwo = new Date(T.getTime() + 2 * 60 * 60 * 1000)
    const deadline = '2030-03-09T10:00:00.000Z'
    setNow(plusOne)
    expect((await edit({ capacity: 30 })).status).toBe(200)
    setNow(plusTwo)
    expect((await edit({ registrationDeadline: deadline })).status).toBe(200)

    const res = await request(app).get(E17(created.body.id)).set('Cookie', cookies.quantum)
    expect(res.status).toBe(200)
    expect(res.body.items.map((c: Record<string, unknown>) => [c.field, c.oldValue, c.newValue, c.changedAt, c.changedBy])).toEqual([
      ['deadline', NEW_EVENT.startAt, deadline, plusTwo.toISOString(), { displayName: 'Quantum Cards' }],
      ['capacity', '24', '30', plusOne.toISOString(), { displayName: 'Quantum Cards' }],
      ['status', null, 'PUBLISHED', T.toISOString(), { displayName: 'Quantum Cards' }],
    ])
    const text = JSON.stringify(res.body)
    expect(text).not.toContain('@')
    expect(text).not.toMatch(/changedById|organizerId|email|"userId"/)
    setNow(T)
  })

  it('lists the newest change first (changedAt desc, then id desc)', async () => {
    const created = await createAsQuantum()
    const later = new Date(T.getTime() + 60 * 60 * 1000)
    // Two rows written directly, as E-13 will write them in S2-04; only the order of E-17 is checked here.
    await prisma.$executeRaw`
      INSERT INTO "EventChange" ("eventId", "changedById", "field", "oldValue", "newValue", "changedAt") VALUES
        (${created.body.id}, ${quantumId}, 'capacity'::"ChangeField", '24', '30', ${later}),
        (${created.body.id}, ${quantumId}, 'details'::"ChangeField", NULL, 'description', ${later})`

    const res = await request(app).get(E17(created.body.id)).set('Cookie', cookies.quantum)
    expect(res.status).toBe(200)
    expect(res.body.items.map((c: { field: string }) => c.field)).toEqual(['details', 'capacity', 'status'])
  })
})

describe('TEST-SR8-04 only the owner reads the history (AC-SR8-04, NFR-02)', () => {
  let eventId = 0
  beforeAll(async () => {
    eventId = (await createAsQuantum()).body.id
  })

  it("another organizer gets 404, byte-identical to a missing id", async () => {
    const other = await request(app).get(E17(eventId)).set('Cookie', cookies.dragon)
    const missing = await request(app).get(E17(999999)).set('Cookie', cookies.quantum)
    expect(other.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('EVENT_NOT_FOUND')
    expect(other.text).toBe(missing.text)
  })

  it('a participant gets 403, a visitor 401, and a malformed id 400', async () => {
    const participant = await request(app).get(E17(eventId)).set('Cookie', cookies.mint)
    const visitor = await request(app).get(E17(eventId))
    const malformed = await request(app).get(E17('abc')).set('Cookie', cookies.quantum)
    expect([participant.status, visitor.status, malformed.status]).toEqual([403, 401, 400])
    expect(participant.body.error.code).toBe('FORBIDDEN')
    expect(visitor.body.error.code).toBe('UNAUTHENTICATED')
    expect(malformed.body.error.code).toBe('INVALID_PATH_PARAMETER')
  })
})
