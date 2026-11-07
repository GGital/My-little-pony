import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { TEST_ORIGIN, makeApp, spyLogger } from '../helpers/app.js'
import { cookieHeader, makeUserWithPassword, readSessionCookie, signIn } from '../helpers/auth.js'
import { makeEvent, makeParticipant, prisma, resetDb } from '../helpers/db.js'
import { LEAKY_ERROR_TEXT, probeRoutes } from '../helpers/probes.js'

/** Anything a safe error body must never contain (AC-SR2-01). */
const LEAKS: [string, RegExp][] = [
  ['stack', /stack/i],
  ['stack frame', /\bat \S/],
  ['SQL', /SELECT|INSERT|UPDATE|DELETE FROM/i],
  ['ORM name', /prisma/i],
  ['file path', /\/home\/|\/src\/|\.ts\b|[A-Z]:\\/],
  ["another user's email", /mint@player\.example/],
  ['cookie value', /leak-me-cookie/],
]

const COOKIE = 'tcg.sid=leak-me-cookie'

/** One request for each status in AC-SR2-01. */
const CASES = [
  {
    status: 400,
    code: 'VALIDATION_FAILED',
    send: (r: request.Agent) => r.post('/api/__test/echo').set('Origin', TEST_ORIGIN).send({ title: 7 }),
  },
  { status: 401, code: 'UNAUTHENTICATED', send: (r: request.Agent) => r.get('/api/__test/error/UNAUTHENTICATED') },
  {
    status: 403,
    code: 'FORBIDDEN',
    send: (r: request.Agent) =>
      r.post('/api/__test/echo').set('Origin', 'https://evil.example').send({ title: 'x', capacity: 1, startAt: '2026-11-06T10:00:00Z' }),
  },
  { status: 404, code: 'NOT_FOUND', send: (r: request.Agent) => r.get('/api/no-such-route') },
  { status: 409, code: 'EVENT_FULL', send: (r: request.Agent) => r.get('/api/__test/error/EVENT_FULL') },
  { status: 500, code: 'INTERNAL_ERROR', send: (r: request.Agent) => r.get('/api/__test/boom') },
]

/** The shape and leak checks of AC-SR2-01, shared by the probe cases and the real-endpoint cases. */
function expectSafeError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status)
  expect(res.headers['content-type']).toMatch(/^application\/json/)
  expect(Object.keys(res.body)).toEqual(['error'])
  const { error } = res.body
  expect(error.code).toBe(code)
  expect(typeof error.message).toBe('string')
  expect(error.message.length).toBeGreaterThan(0)
  expect(Object.keys(error).every((k) => ['code', 'message', 'details'].includes(k))).toBe(true)
  for (const [what, pattern] of LEAKS) expect(res.text, `body leaks ${what}`).not.toMatch(pattern)
}

describe('TEST-SR2-01 — every error body has the same safe shape (AC-SR2-01, NFR-07)', () => {
  it.each(CASES)('$status $code', async ({ status, code, send }) => {
    const agent = request.agent(makeApp({ extraRoutes: probeRoutes }))
    expectSafeError(await send(agent).set('Cookie', COOKIE), status, code)
  })

  it('500 logs the real error on the server, without cookies or headers', async () => {
    const { log, entries } = spyLogger()
    await request(makeApp({ log, extraRoutes: probeRoutes })).get('/api/__test/boom').set('Cookie', COOKIE)

    const errors = entries.filter((e) => e.level === 'error')
    expect(errors).toHaveLength(1)
    // The real cause is kept for the team: the whole original message, read from the field itself
    // (searching the JSON-encoded entry fails because encoding escapes the quotes in the SQL).
    expect(String(errors[0]?.fields?.error)).toContain(LEAKY_ERROR_TEXT)
    expect(Object.keys(errors[0]?.fields ?? {}).sort()).toEqual(['error', 'method', 'path'])
    expect(JSON.stringify(errors[0])).not.toMatch(/leak-me-cookie|cookie|headers/i)
  })

  it('400 lists the failing fields in details', async () => {
    const res = await request(makeApp({ extraRoutes: probeRoutes }))
      .post('/api/__test/echo')
      .set('Origin', TEST_ORIGIN)
      .send({ title: 7 })
    expect(res.status).toBe(400)
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'title', message: expect.any(String) })]),
    )
  })
})

// I-12 (contracts v1.2 §2): the 401 and the 409 from real endpoints, not the catalogue probe.
describe('TEST-SR2-01 (I-12) — real 401 and 409 bodies have the same safe shape (AC-SR2-01, NFR-07)', () => {
  const app = makeApp()
  let cookie = ''
  let fullEventId = 0

  beforeAll(async () => {
    await resetDb()
    const { user, password } = await makeUserWithPassword('PARTICIPANT', 'Nok', 'nok@player.example')
    cookie = cookieHeader(readSessionCookie(await signIn(request(app), user.email, password))!.value)
    const { user: organizer } = await makeUserWithPassword('ORGANIZER', 'Quantum Cards')
    const full = await makeEvent(organizer.id, { capacity: 1 })
    const other = await makeParticipant('Ploy')
    await prisma.registration.create({ data: { eventId: full.id, participantId: other.id } })
    fullEventId = full.id
  })

  it('E-03 signed out (an unknown cookie) → 401 UNAUTHENTICATED', async () => {
    expectSafeError(await request(app).get('/api/auth/me').set('Cookie', COOKIE), 401, 'UNAUTHENTICATED')
  })

  it('E-09 on a full event → 409 EVENT_FULL, and the body names no other participant', async () => {
    const res = await request(app).post(`/api/events/${fullEventId}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', cookie)
    expectSafeError(res, 409, 'EVENT_FULL')
    expect(res.text).not.toMatch(/Ploy|@/)
  })
})
