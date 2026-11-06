import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetNow, setNow } from '../../src/clock.js'
import { seed } from '../../prisma/seed.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb, tableCounts } from '../helpers/db.js'

const SEED_PASSWORD = 'test-only-seed-password'
const app = makeApp()

let quantumCookie: string
let mintCookie: string

const VALID_EVENT_PAYLOAD = {
  title: 'Quantum Constructed Championship',
  type: 'TOURNAMENT',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  venueAddress: '1631 Kanchanaphisek Rd',
  city: 'Bangkok',
  startAt: '2026-11-07T10:00:00.000+07:00',
  endAt: '2026-11-07T14:00:00.000+07:00',
  capacity: 24,
  feeLabel: 'THB 250',
  structureNote: '4 rounds · Best of 1',
  contact: 'hello@quantumcards.example',
  description: 'Bring a legal constructed deck to compete for glory.',
}

beforeAll(async () => {
  await resetDb()
  await seed(prisma, SEED_PASSWORD)

  const [resQuantum, resMint] = await Promise.all([
    signIn(request(app), 'quantum@organizer.example', SEED_PASSWORD),
    signIn(request(app), 'mint@player.example', SEED_PASSWORD),
  ])
  expect(resQuantum.status).toBe(200)
  expect(resMint.status).toBe(200)

  quantumCookie = cookieHeader(readSessionCookie(resQuantum)!.value)
  mintCookie = cookieHeader(readSessionCookie(resMint)!.value)
})

afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-D-01 (I) — Valid event creation and publication (AC-D-01, FR-06)', () => {
  it('posts a valid event tomorrow with capacity 24 → 201, stored row PUBLISHED, listed in E-04', async () => {
    const fixedNow = new Date('2026-11-06T10:00:00.000Z')
    setNow(fixedNow)

    try {
      const startAt = new Date('2026-11-07T10:00:00.000Z').toISOString()
      const endAt = new Date('2026-11-07T14:00:00.000Z').toISOString()

      const res = await request(app)
        .post('/api/events')
        .set('Origin', TEST_ORIGIN)
        .set('Cookie', quantumCookie)
        .send({
          ...VALID_EVENT_PAYLOAD,
          title: 'Tomorrow Constructed Clash',
          startAt,
          endAt,
          capacity: 24,
        })

      expect(res.status).toBe(201)
      expect(res.body.title).toBe('Tomorrow Constructed Clash')
      expect(res.body.status).toBe('PUBLISHED')
      expect(res.body.capacity).toBe(24)
      expect(res.body.registeredCount).toBe(0)
      expect(res.body.seatsRemaining).toBe(24)
      expect(res.body.viewer).toEqual({ action: 'MANAGE', registrationId: null })
      expect(res.body.hasStarted).toBe(false)
      expect(res.body.organizer.displayName).toBe('Quantum Cards')

      // Verify stored row in database
      const organizer = await prisma.user.findUniqueOrThrow({ where: { email: 'quantum@organizer.example' } })
      const eventInDb = await prisma.event.findUniqueOrThrow({ where: { id: res.body.id } })
      expect(eventInDb.organizerId).toBe(organizer.id)
      expect(eventInDb.status).toBe('PUBLISHED')
      expect(eventInDb.publishedAt?.toISOString()).toBe(fixedNow.toISOString())

      // Verify listed in E-04 (GET /api/events)
      const listRes = await request(app).get('/api/events')
      expect(listRes.status).toBe(200)
      const listed = listRes.body.items.find((e: { id: number }) => e.id === res.body.id)
      expect(listed).toBeDefined()
      expect(listed.registeredCount).toBe(0)
      expect(listed.seatsRemaining).toBe(24)
    } finally {
      resetNow()
    }
  })
})

describe('TEST-D-02 (I) — Capacity boundary and invalid values (AC-D-02, BR-01)', () => {
  it.each([0, -1, 1.5, 257, '24', null])(
    'capacity = %s → 400 VALIDATION_FAILED with exact message, 0 rows stored',
    async (cap) => {
      const before = await tableCounts()
      const res = await request(app)
        .post('/api/events')
        .set('Origin', TEST_ORIGIN)
        .set('Cookie', quantumCookie)
        .send({ ...VALID_EVENT_PAYLOAD, capacity: cap })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_FAILED')
      const capErr = res.body.error.details.find((d: { field: string }) => d.field === 'capacity')
      expect(capErr).toBeDefined()
      expect(capErr.message).toBe('Capacity must be a whole number from 1 to 256.')
      expect(await tableCounts()).toEqual(before)
    },
  )

  it.each([1, 256])('capacity = %d gives 201 and stores row', async (cap) => {
    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const endAt = new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString()
    const res = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', quantumCookie)
      .send({ ...VALID_EVENT_PAYLOAD, title: `Cap ${cap} Event`, capacity: cap, startAt, endAt })

    expect(res.status).toBe(201)
    expect(res.body.capacity).toBe(cap)
    expect(res.body.seatsRemaining).toBe(cap)
  })
})

describe('TEST-D-03 (I) — Time rules enforcement (AC-D-03, BR-02)', () => {
  const T = new Date('2026-11-06T10:00:00.000Z')

  it.each([
    ['start = T', () => T.toISOString(), () => new Date(T.getTime() + 2 * 3600000).toISOString(), 'startAt', 'The start must be in the future.'],
    ['start = T - 1 min', () => new Date(T.getTime() - 60000).toISOString(), () => new Date(T.getTime() + 2 * 3600000).toISOString(), 'startAt', 'The start must be in the future.'],
    ['end = start', () => new Date(T.getTime() + 3600000).toISOString(), () => new Date(T.getTime() + 3600000).toISOString(), 'endAt', 'The end must be after the start.'],
    ['end = start + 24 h 1 min', () => new Date(T.getTime() + 3600000).toISOString(), () => new Date(T.getTime() + (25 * 3600000 + 60000)).toISOString(), 'endAt', 'An event can last at most 24 hours.'],
  ])('%s → 422 EVENT_TIME_INVALID naming %s, 0 rows stored', async (_label, getStart, getEnd, expectedField, expectedMessage) => {
    setNow(T)
    try {
      const before = await tableCounts()
      const res = await request(app)
        .post('/api/events')
        .set('Origin', TEST_ORIGIN)
        .set('Cookie', quantumCookie)
        .send({
          ...VALID_EVENT_PAYLOAD,
          title: 'Time Rule Event',
          startAt: getStart(),
          endAt: getEnd(),
        })

      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('EVENT_TIME_INVALID')
      const detail = res.body.error.details.find((d: { field: string }) => d.field === expectedField)
      expect(detail).toBeDefined()
      expect(detail.message).toBe(expectedMessage)
      expect(await tableCounts()).toEqual(before)
    } finally {
      resetNow()
    }
  })

  it('end = start + 24 h → 201 accepted', async () => {
    setNow(T)
    try {
      const startAt = new Date(T.getTime() + 3600000).toISOString()
      const endAt = new Date(T.getTime() + 25 * 3600000).toISOString()
      const res = await request(app)
        .post('/api/events')
        .set('Origin', TEST_ORIGIN)
        .set('Cookie', quantumCookie)
        .send({
          ...VALID_EVENT_PAYLOAD,
          title: '24 Hour Marathon',
          startAt,
          endAt,
        })

      expect(res.status).toBe(201)
    } finally {
      resetNow()
    }
  })
})

describe('TEST-D-04 (I) — Validation details and string rules (AC-D-04, BR-03)', () => {
  it('body missing all required fields → 400 with details for EVERY failing field in one response, 0 rows stored', async () => {
    const before = await tableCounts()
    const res = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', quantumCookie)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort()
    const expectedFields = ['capacity', 'city', 'endAt', 'format', 'startAt', 'title', 'type', 'venueAddress', 'venueName'].sort()
    expect(fields).toEqual(expectedFields)
    expect(await tableCounts()).toEqual(before)
  })

  it('whitespace-only text counts as missing, 0 rows stored', async () => {
    const before = await tableCounts()
    const res = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', quantumCookie)
      .send({
        ...VALID_EVENT_PAYLOAD,
        title: '   ',
        venueName: '   ',
        venueAddress: '   ',
        city: '   ',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    const fields = res.body.error.details.map((d: { field: string }) => d.field)
    expect(fields).toContain('title')
    expect(fields).toContain('venueName')
    expect(fields).toContain('venueAddress')
    expect(fields).toContain('city')
    expect(await tableCounts()).toEqual(before)
  })

  it('rejects title of 2 chars and 101 chars, description 2,001 chars', async () => {
    const before = await tableCounts()
    const res1 = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', quantumCookie)
      .send({ ...VALID_EVENT_PAYLOAD, title: 'ab' })
    expect(res1.status).toBe(400)

    const res2 = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', quantumCookie)
      .send({ ...VALID_EVENT_PAYLOAD, title: 'a'.repeat(101) })
    expect(res2.status).toBe(400)

    const res3 = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', quantumCookie)
      .send({ ...VALID_EVENT_PAYLOAD, description: 'a'.repeat(2001) })
    expect(res3.status).toBe(400)

    expect(await tableCounts()).toEqual(before)
  })

  it('accepts 3-char and 100-char titles → 201', async () => {
    const startAt = new Date(Date.now() + 24 * 3600000).toISOString()
    const endAt = new Date(Date.now() + 28 * 3600000).toISOString()

    const res1 = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', quantumCookie)
      .send({ ...VALID_EVENT_PAYLOAD, title: 'TCG', startAt, endAt })
    expect(res1.status).toBe(201)

    const res2 = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', quantumCookie)
      .send({ ...VALID_EVENT_PAYLOAD, title: 'T'.repeat(100), startAt, endAt })
    expect(res2.status).toBe(201)
  })
})

describe('TEST-D-05 (I) — Access control: organizer only (AC-D-05, BR-13)', () => {
  it('participant (Mint) → 403 FORBIDDEN, 0 rows stored', async () => {
    const before = await tableCounts()
    const res = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', mintCookie)
      .send(VALID_EVENT_PAYLOAD)

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } })
    expect(await tableCounts()).toEqual(before)
  })

  it('visitor (signed out) → 401 UNAUTHENTICATED, 0 rows stored', async () => {
    const before = await tableCounts()
    const res = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .send(VALID_EVENT_PAYLOAD)

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: expect.any(String) } })
    expect(await tableCounts()).toEqual(before)
  })
})
