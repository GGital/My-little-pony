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

// Decision 24 Nov 2026 (S2-01 review of the plan): TEST-SR8-01 is split. S2-01 covers the creation row and E-17.
// The capacity (T + 1 h) and deadline (T + 2 h) steps need E-13, so they are added to this test in S2-04 (#81).
describe('TEST-SR8-01 (S2-01 part) creating an event records who and when, and E-17 shows it (AC-SR8-01, FR-28)', () => {
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
