import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
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

  // Contracts v1.2 §2 / STS TEST-SR2-02 (I-07 adds the real E-06 case):
  it('real E-06 with organizer session, wrong types, bad date and unknown field → 400 VALIDATION_FAILED', async () => {
    const signedIn = await signIn(request(app), 'quantum@organizer.example', 'test-only-seed-password')
    expect(signedIn.status).toBe(200)
    const cookie = cookieHeader(readSessionCookie(signedIn)!.value)

    const before = await tableCounts()
    const res = await request(app)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', cookie)
      .send({
        type: 'CASUAL',
        format: 'CONSTRUCTED',
        venueName: 'Quantum Cards',
        venueAddress: '1631 Kanchanaphisek Rd',
        city: 'Bangkok',
        endAt: '2026-11-07T14:00:00.000Z',
        capacity: 'ten',
        title: 7,
        startAt: 'tomorrow',
        organizerId: 99,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort()
    expect(fields).toEqual(['capacity', 'organizerId', 'startAt', 'title'])
    expect(await tableCounts()).toEqual(before)
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

  // Contracts v1.2 §2: I-04 adds the participant and organizer sessions. Sign-in itself writes a Session row,
  // so the counts are taken after signing in and before the GETs.
  it.each([
    ['participant', 'mint@player.example'],
    ['organizer', 'quantum@organizer.example'],
  ])('with a signed-in %s, GET on every Sprint 1 route leaves every table unchanged', async (_role, email) => {
    const signedIn = await signIn(request(app), email, 'test-only-seed-password')
    expect(signedIn.status).toBe(200)
    const cookie = cookieHeader(readSessionCookie(signedIn)!.value)

    const before = await tableCounts()
    for (const route of SPRINT1_ROUTES) {
      const res = await request(app).get(route.path).set('Cookie', cookie)
      expect(res.status, `${route.id} ${route.path}`).toBeLessThan(500)
    }
    expect(await tableCounts()).toEqual(before)
  })

  const getPaths = new Set(SPRINT1_ROUTES.filter((r) => r.method === 'GET').map((r) => r.path))
  const postOnlyRoutes = SPRINT1_ROUTES.filter((r) => r.method === 'POST' && !getPaths.has(r.path)).map((r) => r.path)

  it.each([...postOnlyRoutes, ...PROBE_POST_ONLY])(
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

  // Contracts v1.2 §2: I-08 adds the real E-09 cases (Nok on EV-5, which has no registrations in the seed).
  it('real E-09: text/plain → 415, foreign Origin → 403, both storing nothing; no body → 201', async () => {
    const nok = cookieHeader(readSessionCookie(await signIn(request(app), 'nok@player.example', 'test-only-seed-password'))!.value)
    const ev5 = await prisma.event.findFirstOrThrow({ where: { seedKey: 'EV-5' } })
    const e09 = () => request(app).post(`/api/events/${ev5.id}/registrations`).set('Cookie', nok)
    const before = await tableCounts()

    const text = await e09().set('Origin', TEST_ORIGIN).set('Content-Type', 'text/plain').send('hello')
    expect(text.status).toBe(415)
    const foreign = await e09().set('Origin', 'https://evil.example')
    expect(foreign.status).toBe(403)
    expect(foreign.body.error.code).toBe('FORBIDDEN')
    expect(await tableCounts()).toEqual(before)

    const none = await e09().set('Origin', TEST_ORIGIN)
    expect(none.status).toBe(201)
    expect(await tableCounts()).toEqual({ ...before, registrations: before.registrations + 1 })
  })

  it('none of the rejected requests stored anything', async () => {
    const before = await tableCounts()
    await echo().set('Origin', TEST_ORIGIN).set('Content-Type', 'text/plain').send('hello')
    await echo().send(VALID_BODY)
    expect(await tableCounts()).toEqual(before)
  })
})
