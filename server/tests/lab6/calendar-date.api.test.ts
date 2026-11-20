import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetNow, setNow } from '../../src/clock.js'
import { seed } from '../../prisma/seed.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb, tableCounts } from '../helpers/db.js'

// Lab 6 UAT finding #57 (KitLoop Finding 2): startAt 2027-02-29T19:00:00+07:00 was accepted with 201 and stored as
// 1 March, because Date.parse rolls an impossible day over. The contract asks for a valid ISO 8601 date-time with
// offset and NFR-15 for 400 with field details on invalid values; nothing may be stored.

const SEED_PASSWORD = 'test-only-seed-password'
const app = makeApp()
let quantumCookie: string

const event = (startAt: string, endAt: string) => ({
  title: 'UAT-API-calendar-check',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'UAT Test Store',
  venueAddress: '1 Test Road',
  city: 'Bangkok',
  startAt,
  endAt,
  capacity: 2,
})

const post = (body: object) =>
  request(app).post('/api/events').set('Origin', TEST_ORIGIN).set('Cookie', quantumCookie).send(body)

beforeAll(async () => {
  setNow(new Date('2026-11-20T10:00:00.000Z'))
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  const res = await signIn(request(app), 'quantum@organizer.example', SEED_PASSWORD)
  expect(res.status).toBe(200)
  quantumCookie = cookieHeader(readSessionCookie(res)!.value)
})

afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-L6-57 (I) — a date that does not exist is a validation error, not a different day (#57, AC-D-03, NFR-15)', () => {
  it.each([
    ['29 February in a non-leap year (the UAT case)', '2027-02-29'],
    ['30 February', '2027-02-30'],
    ['31 April', '2027-04-31'],
    ['31 June', '2027-06-31'],
  ])('%s → 400 VALIDATION_FAILED naming startAt and endAt, 0 rows stored', async (_label, day) => {
    const before = await tableCounts()
    const res = await post(event(`${day}T19:00:00+07:00`, `${day}T22:00:00+07:00`))

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details).toEqual([
      { field: 'startAt', message: 'Enter a start date and time.' },
      { field: 'endAt', message: 'Enter an end date and time.' },
    ])
    expect(await tableCounts()).toEqual(before)
  })

  it('a valid start with an impossible end → 400 naming only endAt', async () => {
    const res = await post(event('2027-02-28T19:00:00+07:00', '2027-02-29T01:00:00+07:00'))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toEqual([{ field: 'endAt', message: 'Enter an end date and time.' }])
  })

  it('control: 29 February in a leap year (2028) is a real date → 201, stored on that day', async () => {
    const res = await post(event('2028-02-29T19:00:00+07:00', '2028-02-29T22:00:00+07:00'))

    expect(res.status).toBe(201)
    expect(res.body.startAt).toBe('2028-02-29T12:00:00.000Z')
    expect(res.body.endAt).toBe('2028-02-29T15:00:00.000Z')
  })
})
