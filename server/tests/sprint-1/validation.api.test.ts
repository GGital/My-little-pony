import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { prisma, resetDb, tableCounts } from '../helpers/db.js'
import { PROBE_POST_ONLY, probeRoutes } from '../helpers/probes.js'
import { SPRINT1_ROUTES } from '../helpers/routes.js'

const app = makeApp({ extraRoutes: probeRoutes })
const echo = () => request(app).post('/api/__test/echo')
const VALID_BODY = { title: 'Friday Night Constructed', capacity: 24, startAt: '2026-11-06T10:00:00.000Z' }

beforeAll(async () => {
  await resetDb()
  // A realistic database to compare before and after (STS TEST-SR2-03: "seeded test DB").
  await seed(prisma, 'test-only-seed-password')
})
afterAll(() => prisma.$disconnect())

describe('TEST-SR2-02 — zod .strict() reports every failing field (AC-SR2-02, NFR-15)', () => {
  it('wrong types, a bad date and an unknown field → 400 with one details entry per field', async () => {
    const before = await tableCounts()
    const res = await echo()
      .set('Origin', TEST_ORIGIN)
      .send({ capacity: 'ten', title: 7, startAt: 'tomorrow', organizerId: 99 })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort()
    expect(fields).toEqual(['capacity', 'organizerId', 'startAt', 'title'])
    for (const d of res.body.error.details) expect(d.message.length).toBeGreaterThan(0)
    expect(await tableCounts()).toEqual(before)
  })

  it('a valid body passes through as the parsed value', async () => {
    const res = await echo().set('Origin', TEST_ORIGIN).send(VALID_BODY)
    expect(res.status).toBe(201)
    expect(res.body).toEqual(VALID_BODY)
  })
})

describe('TEST-SR2-03 — GET never writes (AC-SR2-03, NFR-15)', () => {
  it('calling every Sprint 1 route with GET leaves every table unchanged', async () => {
    const before = await tableCounts()
    expect(before.users).toBeGreaterThan(0) // the seed really ran
    for (const route of SPRINT1_ROUTES) {
      const res = await request(app).get(route.path)
      expect(res.status, `${route.id} ${route.path}`).toBeLessThan(500)
    }
    expect(await tableCounts()).toEqual(before)
  })

  it.each([...SPRINT1_ROUTES.filter((r) => r.method === 'POST').map((r) => r.path), ...PROBE_POST_ONLY])(
    'GET on POST-only %s → 404 NOT_FOUND',
    async (path) => {
      const res = await request(app).get(path)
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } })
    },
  )
})

describe('TEST-SR2-05 — JSON only, 100 kB limit, origin check (NFR-15)', () => {
  it('a text/plain body → 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await echo().set('Origin', TEST_ORIGIN).set('Content-Type', 'text/plain').send('hello')
    expect(res.status).toBe(415)
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
  })

  it('a 101 kB body → 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await echo()
      .set('Origin', TEST_ORIGIN)
      .send({ ...VALID_BODY, title: 'x'.repeat(101 * 1024) })
    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('a foreign Origin → 403 FORBIDDEN', async () => {
    const res = await echo().set('Origin', 'https://evil.example').send(VALID_BODY)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('no Origin at all → 403 FORBIDDEN', async () => {
    const res = await echo().send(VALID_BODY)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('malformed JSON → 400 VALIDATION_FAILED, not a 500', async () => {
    const res = await echo().set('Origin', TEST_ORIGIN).set('Content-Type', 'application/json').send('{"title":')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('a POST with no body is not a 415 (E-09 sends none); it reaches validation', async () => {
    const res = await echo().set('Origin', TEST_ORIGIN)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('none of the rejected requests stored anything', async () => {
    const before = await tableCounts()
    await echo().set('Origin', TEST_ORIGIN).set('Content-Type', 'text/plain').send('hello')
    await echo().send(VALID_BODY)
    expect(await tableCounts()).toEqual(before)
  })
})
