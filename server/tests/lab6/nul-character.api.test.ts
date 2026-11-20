import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetNow } from '../../src/clock.js'
import { seed } from '../../prisma/seed.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb, tableCounts } from '../helpers/db.js'

// Lab 6 UAT finding #63 (KitLoop Finding 8): U+0000 in any event text field must be refused with 400 and a
// field-level message (NFR-15, NFR-09), not reach PostgreSQL (which cannot store it) and come back as a 500.

const SEED_PASSWORD = 'test-only-seed-password'
const NUL = String.fromCharCode(0)
const app = makeApp()
let quantumCookie: string

function validEvent() {
  return {
    title: 'UAT-NUL-check',
    type: 'CASUAL',
    format: 'CONSTRUCTED',
    venueName: 'UAT Test Store',
    venueAddress: '1 Test Road',
    city: 'Bangkok',
    startAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    endAt: new Date(Date.now() + 27 * 3600000).toISOString(),
    capacity: 24,
  }
}

const post = (body: object) =>
  request(app).post('/api/events').set('Origin', TEST_ORIGIN).set('Cookie', quantumCookie).send(body)

beforeAll(async () => {
  resetNow()
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  const res = await signIn(request(app), 'quantum@organizer.example', SEED_PASSWORD)
  expect(res.status).toBe(200)
  quantumCookie = cookieHeader(readSessionCookie(res)!.value)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('TEST-L6-63 (I) — U+0000 in event text is a validation error, not a server error (#63, NFR-15, NFR-09)', () => {
  it('description "UAT" + U+0000 + "TEST" → 400 VALIDATION_FAILED naming description, 0 rows stored', async () => {
    const before = await tableCounts()
    const res = await post({ ...validEvent(), description: `UAT${NUL}TEST` })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details).toEqual([
      { field: 'description', message: 'Remove the unsupported invisible character (U+0000).' },
    ])
    expect(await tableCounts()).toEqual(before)
  })

  it('U+0000 in required and other optional fields → one detail per field, 0 rows stored', async () => {
    const before = await tableCounts()
    const res = await post({
      ...validEvent(),
      title: `UAT${NUL}title`,
      venueName: `Store${NUL}`,
      venueAddress: `1${NUL} Test Road`,
      city: `Bang${NUL}kok`,
      feeLabel: `THB${NUL}100`,
      structureNote: `Best${NUL}of 3`,
      contact: `qa${NUL}@example.com`,
    })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort()
    expect(fields).toEqual(['city', 'contact', 'feeLabel', 'structureNote', 'title', 'venueAddress', 'venueName'])
    expect(await tableCounts()).toEqual(before)
  })

  it('control: Thai text and line breaks in the description still publish → 201, stored as sent', async () => {
    const description = 'แข่งขันรอบคัดเลือก\nBring a legal deck.\r\nตารางเวลา'
    const res = await post({ ...validEvent(), description })

    expect(res.status).toBe(201)
    const stored = await prisma.event.findUnique({ where: { id: res.body.id } })
    expect(stored?.description).toBe(description)
  })
})
