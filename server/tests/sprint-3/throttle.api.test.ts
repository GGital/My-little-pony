import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetNow, setNow } from '../../src/clock.js'
import { makeApp } from '../helpers/app.js'
import { cookieHeader, makeUserWithPassword, readSessionCookie, signIn } from '../helpers/auth.js'
import { MINUTE, prisma, resetDb } from '../helpers/db.js'
import { ALL_ROUTES } from '../helpers/routes.js'

// Feature-T (Sprint 3 contracts §5): E-01 sign-in throttling against the real test database.
const app = makeApp()
const F = new Date('2030-03-01T08:00:00.000Z') // the time of the 5th failure
const SEC = 1000
const WRONG = 'not-the-password-1'
const MESSAGE = 'Too many sign-in attempts. Try again in 10 minutes.'
const MINT = 'mint@player.example'
const GHOST = 'ghost@player.example'
const PLOY = 'ploy@player.example'

let mint: Awaited<ReturnType<typeof makeUserWithPassword>>
let ploy: Awaited<ReturnType<typeof makeUserWithPassword>>

const attempt = (email: string, password: string, target: Parameters<typeof request>[0] = app) =>
  signIn(request(target), email, password)
const failedRows = (email: string) => prisma.loginAttempt.count({ where: { email, succeeded: false } })

/** Five wrong passwords, all at the current (fixed) time. */
async function failFive(email: string) {
  for (let i = 0; i < 5; i++) {
    const res = await attempt(email, WRONG)
    expect(res.status).toBe(401)
  }
}

beforeAll(async () => {
  await resetDb()
  mint = await makeUserWithPassword('PARTICIPANT', 'Mint', MINT)
  ploy = await makeUserWithPassword('PARTICIPANT', 'Ploy', PLOY)
})
beforeEach(async () => {
  await prisma.session.deleteMany()
  await prisma.loginAttempt.deleteMany()
  setNow(F)
})
afterEach(() => resetNow())
afterAll(() => prisma.$disconnect())

describe('TEST-T-01 — five wrong passwords, then even the right one is refused (AC-T-01, NFR-16, FR-02)', () => {
  it('answers 401 five times, then 429 TOO_MANY_ATTEMPTS with Retry-After 600, no session and no cookie', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await attempt(MINT, WRONG)
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    }

    const res = await attempt(MINT, mint.password)

    expect(res.status).toBe(429)
    expect(res.body).toEqual({ error: { code: 'TOO_MANY_ATTEMPTS', message: MESSAGE } })
    expect(res.headers['retry-after']).toBe('600')
    expect(readSessionCookie(res)).toBeUndefined()
    expect(res.headers['set-cookie']).toBeUndefined()
    expect(await prisma.session.count()).toBe(0)
    expect(await failedRows(MINT)).toBe(5)
  })
})

describe('TEST-T-02 — the lock lasts until the 5th failure is 10 minutes old (AC-T-02, D-29, NFR-11)', () => {
  it('429 at F + 9:59 with Retry-After 1, 20 more attempts add no rows, 200 with a session at F + 10:00', async () => {
    await failFive(MINT)

    setNow(new Date(F.getTime() + 10 * MINUTE - SEC))
    const early = await attempt(MINT, mint.password)
    expect(early.status).toBe(429)
    expect(early.headers['retry-after']).toBe('1')

    for (let i = 0; i < 20; i++) {
      const res = await attempt(MINT, i % 2 ? mint.password : WRONG)
      expect(res.status).toBe(429)
    }
    expect(await prisma.loginAttempt.count({ where: { email: MINT } })).toBe(5)

    setNow(new Date(F.getTime() + 10 * MINUTE))
    const ok = await attempt(MINT, mint.password)
    expect(ok.status).toBe(200)
    expect(readSessionCookie(ok)?.value).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})

describe('TEST-T-03 — unknown emails are throttled the same way, and spelling variants share a counter (AC-T-03, D-27, FR-02)', () => {
  it('ghost gets the same 429 body as Mint, in about the same time; upper-case and padded variants share one counter', async () => {
    for (let i = 0; i < 5; i++) expect((await attempt(GHOST, WRONG)).status).toBe(401)
    const ghostLocked = await attempt(GHOST, WRONG)
    expect(ghostLocked.status).toBe(429)
    expect(await failedRows(GHOST)).toBe(5)

    const variants = ['MINT@player.example', ' mint@player.example ', 'Mint@Player.Example', MINT, ' MINT@player.example']
    for (const v of variants) expect((await attempt(v, WRONG)).status).toBe(401)
    expect(await failedRows(MINT)).toBe(5) // one counter, stored lower-case and trimmed

    const mintLocked = await attempt(MINT, mint.password)
    expect(mintLocked.status).toBe(429)
    expect(mintLocked.body).toEqual(ghostLocked.body)
    expect(mintLocked.headers['retry-after']).toBe(ghostLocked.headers['retry-after'])

    const meanMs = async (email: string, password: string) => {
      const t0 = performance.now()
      for (let i = 0; i < 20; i++) await attempt(email, password)
      return (performance.now() - t0) / 20
    }
    const ghostMs = await meanMs(GHOST, WRONG)
    const mintMs = await meanMs(MINT, mint.password)
    expect(Math.abs(ghostMs - mintMs)).toBeLessThan(50)
  })
})

describe('TEST-T-04 — a lock is per email and ends cleanly (AC-T-04, NFR-16)', () => {
  it('Ploy signs in while Mint is locked; at F + 10 min Mint signs in, and her next failure is 401, not 429', async () => {
    await failFive(MINT)
    expect((await attempt(MINT, mint.password)).status).toBe(429)

    expect((await attempt(PLOY, ploy.password)).status).toBe(200)

    setNow(new Date(F.getTime() + 10 * MINUTE))
    expect((await attempt(MINT, mint.password)).status).toBe(200)
    const next = await attempt(MINT, WRONG)
    expect(next.status).toBe(401)
    expect(next.body.error.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('TEST-T-05 — the lock lives in PostgreSQL and no response leaks it (AC-T-05, NFR-06, NFR-07)', () => {
  it('a new Prisma client and a new app instance still answer 429', async () => {
    await failFive(MINT)

    const freshDb = new PrismaClient()
    try {
      const restarted = makeApp({ prisma: freshDb })
      const res = await attempt(MINT, mint.password, restarted)
      expect(res.status).toBe(429)
      expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS')
    } finally {
      await freshDb.$disconnect()
    }
  })

  it('no response of any route contains LoginAttempt, attemptedAt or an attempted password', async () => {
    await failFive(MINT)
    const locked = await attempt(MINT, mint.password)
    const bodies = [JSON.stringify(locked.body), JSON.stringify(locked.headers)]

    const signedIn = await attempt(PLOY, ploy.password)
    const cookie = cookieHeader(readSessionCookie(signedIn)!.value)
    for (const route of ALL_ROUTES) {
      const base = request(app)
      const call = route.method === 'GET' ? base.get(route.path) : route.method === 'POST' ? base.post(route.path) : base.patch(route.path)
      const res = await call.set('Cookie', cookie).send()
      bodies.push(JSON.stringify(res.body), JSON.stringify(res.headers))
    }

    for (const text of bodies) {
      expect(text).not.toContain('LoginAttempt')
      expect(text).not.toContain('attemptedAt')
      expect(text).not.toContain(WRONG)
      expect(text).not.toContain(mint.password)
    }
  })
})

describe('TEST-T-06 — parallel attempts cannot get past the limit (AC-T-01, NFR-16)', () => {
  it('10 simultaneous wrong passwords give 5 × 401 and 5 × 429, and exactly 5 failure rows', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => attempt(MINT, WRONG)))

    expect(results.filter((r) => r.status === 401)).toHaveLength(5)
    expect(results.filter((r) => r.status === 429)).toHaveLength(5)
    expect(await failedRows(MINT)).toBe(5)
  })
})
