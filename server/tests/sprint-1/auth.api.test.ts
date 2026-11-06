import { createHash } from 'node:crypto'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, makeUserWithPassword, readSessionCookie, signIn } from '../helpers/auth.js'
import { HOUR, MINUTE, prisma, resetDb } from '../helpers/db.js'
import { probeRoutes } from '../helpers/probes.js'

// Feature-A (contracts §4): E-01 sign in, E-02 sign out, E-03 who am I, against the real test database.
const app = makeApp({ extraRoutes: probeRoutes })
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
const me = (token?: string) => {
  const req = request(app).get('/api/auth/me')
  return token === undefined ? req : req.set('Cookie', cookieHeader(token))
}
const logout = (token?: string, origin: string | null = TEST_ORIGIN) => {
  let req = request(app).post('/api/auth/logout')
  if (origin) req = req.set('Origin', origin)
  return token === undefined ? req : req.set('Cookie', cookieHeader(token))
}
const UNAUTHENTICATED = { error: { code: 'UNAUTHENTICATED', message: expect.any(String) } }

let mint: Awaited<ReturnType<typeof makeUserWithPassword>>

/** Signs Mint in and returns the cookie token. */
async function signInMint() {
  const res = await signIn(request(app), 'mint@player.example', mint.password)
  expect(res.status).toBe(200)
  return readSessionCookie(res)!.value
}

beforeAll(async () => {
  await resetDb()
  mint = await makeUserWithPassword('PARTICIPANT', 'Mint', 'mint@player.example')
})
beforeEach(() => prisma.session.deleteMany())
afterEach(() => resetNow())
afterAll(() => prisma.$disconnect())

describe('TEST-A-01 — sign in, then who am I (AC-A-01, FR-01, FR-03)', () => {
  it('a trimmed, mixed-case email signs in: 200 AuthUser, a tcg.sid cookie, E-03 the same user, one hashed Session row', async () => {
    const res = await signIn(request(app), '  MINT@player.example ', mint.password)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: mint.user.id, displayName: 'Mint', email: 'mint@player.example', role: 'PARTICIPANT' })
    const cookie = readSessionCookie(res)
    expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/) // 32 random bytes, base64url

    const who = await me(cookie!.value)
    expect(who.status).toBe(200)
    expect(who.body).toEqual(res.body)

    const rows = await prisma.session.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(mint.user.id)
    expect(rows[0]?.id).toBe(sha256(cookie!.value))
    expect(rows[0]?.id).not.toBe(cookie!.value)
  })
})

describe('TEST-A-02 — failed sign-in tells nothing (AC-A-02, FR-02)', () => {
  it('wrong password and unknown email: identical 401 INVALID_CREDENTIALS, no Session row, no cookie', async () => {
    const wrong = await signIn(request(app), 'mint@player.example', `${mint.password}x`)
    const ghost = await signIn(request(app), 'ghost@player.example', mint.password)

    for (const res of [wrong, ghost]) {
      expect(res.status).toBe(401)
      expect(res.headers['set-cookie']).toBeUndefined()
    }
    expect(wrong.body).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } })
    expect(ghost.body).toEqual(wrong.body)
    expect(await prisma.session.count()).toBe(0)
  })

  it('an unknown email takes as long as a wrong password (dummy hash): mean difference < 50 ms over 20 tries', async () => {
    const timeOf = async (email: string) => {
      const start = performance.now()
      const res = await signIn(request(app), email, 'not-the-password')
      expect(res.status).toBe(401)
      return performance.now() - start
    }
    let known = 0
    let unknown = 0
    for (let i = 0; i < 20; i++) {
      known += await timeOf('mint@player.example')
      unknown += await timeOf(`ghost${i}@player.example`)
    }
    expect(Math.abs(known - unknown) / 20).toBeLessThan(50)
  })

  it.each([
    ['a missing email', { password: 'x' }, 'email', 'Enter your email address.'],
    ['an email without @', { email: 'mint', password: 'x' }, 'email', 'Enter your email address.'],
    ['an empty password', { email: 'mint@player.example', password: '' }, 'password', 'Enter your password.'],
    ['a password over 128 characters', { email: 'mint@player.example', password: 'x'.repeat(129) }, 'password', 'Enter your password.'],
    ['an extra key', { email: 'mint@player.example', password: 'x', role: 'ORGANIZER' }, 'role', 'This value cannot be set.'],
  ])('E-01 with %s → 400 VALIDATION_FAILED on that field, no session', async (_label, body, field, message) => {
    const res = await request(app).post('/api/auth/login').set('Origin', TEST_ORIGIN).send(body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details).toContainEqual({ field, message })
    expect(await prisma.session.count()).toBe(0)
  })

  it('E-01 from a foreign Origin → 403 FORBIDDEN even with the right password, no session', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'mint@player.example', password: mint.password })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(res.headers['set-cookie']).toBeUndefined()
    expect(await prisma.session.count()).toBe(0)
  })
})

describe('TEST-A-03 — who am I with and without a session (AC-A-03, FR-03)', () => {
  it('a valid cookie → 200 AuthUser', async () => {
    const res = await me(await signInMint())
    expect(res.status).toBe(200)
    expect(res.body.email).toBe('mint@player.example')
  })

  it.each([
    ['no cookie', undefined],
    ['a malformed cookie (tcg.sid=abc)', 'abc'],
    ['a well-formed but unknown token', 'A'.repeat(43)],
  ])('%s → 401 UNAUTHENTICATED', async (_label, token) => {
    const res = await me(token)
    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
  })
})

describe('TEST-A-04 — sign out really ends the session (AC-A-04, FR-04, NFR-04)', () => {
  it('E-02 → 204, Session row gone, expired cookie; the old cookie then gets 401 everywhere', async () => {
    const token = await signInMint()

    const res = await logout(token)
    expect(res.status).toBe(204)
    expect(await prisma.session.count()).toBe(0)
    const cleared = readSessionCookie(res)
    expect(cleared?.value).toBe('')
    expect(new Date(cleared!.attributes.get('expires')!).getTime()).toBeLessThan(Date.now())

    // E-09 is real since I-08; E-10 arrives in I-10, until then the probe runs the same requireAuth (contracts v1.3 §4).
    const e09 = await request(app).post('/api/events/1/registrations').set('Origin', TEST_ORIGIN).set('Cookie', cookieHeader(token))
    for (const res of [await me(token), await logout(token), e09, await request(app).get('/api/__test/protected').set('Cookie', cookieHeader(token))]) {
      expect(res.status).toBe(401)
      expect(res.body).toEqual(UNAUTHENTICATED)
    }
  })

  it('E-02 without a cookie → 401 first, even without an Origin (SDS §2.3 check order)', async () => {
    const res = await logout(undefined, null)
    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
  })

  it('E-02 with a valid cookie but a foreign Origin → 403 FORBIDDEN, and the session survives', async () => {
    const token = await signInMint()
    const res = await logout(token, 'https://evil.example')
    expect(res.status).toBe(403)
    expect(await prisma.session.count()).toBe(1)
    expect((await me(token)).status).toBe(200)
  })

  it('the protected probe answers 200 with the actor while the session is valid', async () => {
    const res = await request(app).get('/api/__test/protected').set('Cookie', cookieHeader(await signInMint()))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ actorId: mint.user.id })
  })
})

describe('TEST-A-06 — cookie attributes and the 8-hour absolute expiry (AC-A-06, NFR-04)', () => {
  const T = new Date('2026-11-06T02:00:00.000Z')

  it('HttpOnly, SameSite=Lax, Path=/, Max-Age=28800; E-03 200 at T + 7 h 59 min, 401 at T + 8 h', async () => {
    setNow(T)
    const res = await signIn(request(app), 'mint@player.example', mint.password)
    expect(res.status).toBe(200)
    const cookie = readSessionCookie(res)!
    expect(cookie.attributes.has('httponly')).toBe(true)
    expect(cookie.attributes.get('samesite')?.toLowerCase()).toBe('lax')
    expect(cookie.attributes.get('path')).toBe('/')
    expect(cookie.attributes.get('max-age')).toBe('28800')
    expect(cookie.attributes.has('secure')).toBe(false) // only when NODE_ENV=production

    setNow(new Date(T.getTime() + 8 * HOUR - MINUTE))
    expect((await me(cookie.value)).status).toBe(200)
    setNow(new Date(T.getTime() + 8 * HOUR))
    expect((await me(cookie.value)).status).toBe(401)
  })

  it('signing in again after expiry deletes the expired session row (SDS §8)', async () => {
    setNow(T)
    const first = await signIn(request(app), 'mint@player.example', mint.password)
    expect(first.status).toBe(200)
    const old = readSessionCookie(first)!.value
    setNow(new Date(T.getTime() + 9 * HOUR))
    await signInMint()
    const ids = (await prisma.session.findMany({ where: { userId: mint.user.id } })).map((s) => s.id)
    expect(ids).toHaveLength(1)
    expect(ids).not.toContain(sha256(old))
  })
})

describe('TEST-A-05 (I) — hashes stored, never returned (AC-A-05, NFR-03)', () => {
  const SEED_PASSWORD = 'test-only-seed-password'
  const HASH = /^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/

  beforeAll(async () => {
    await resetDb()
    await seed(prisma, SEED_PASSWORD)
  })

  it('every seeded passwordHash has the scrypt format', async () => {
    const users = await prisma.user.findMany({ select: { passwordHash: true } })
    expect(users.length).toBe(6)
    for (const { passwordHash } of users) expect(passwordHash).toMatch(HASH)
  })

  it('no Sprint 1 response carries a password field, a hash or the seed password', async () => {
    const signedIn = await signIn(request(app), 'mint@player.example', SEED_PASSWORD)
    expect(signedIn.status).toBe(200)
    const token = readSessionCookie(signedIn)!.value
    const responses = [
      signedIn,
      await signIn(request(app), 'mint@player.example', 'wrong-password'),
      await signIn(request(app), 'mint@player.example', ''),
      await me(token),
      await me(),
      await request(app).get('/api/health'),
      await logout(token),
      await me(token),
    ]

    const keys = (value: unknown): string[] =>
      value && typeof value === 'object'
        ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v)])
        : []
    for (const res of responses) {
      expect(keys(res.body)).not.toContain('password')
      expect(keys(res.body)).not.toContain('passwordHash')
      expect(res.text).not.toContain(SEED_PASSWORD)
      expect(res.text).not.toContain('scrypt$')
    }
  })
})
