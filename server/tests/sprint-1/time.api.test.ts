import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { now, resetNow, setNow } from '../../src/clock.js'
import { hasStarted, upcomingWhere } from '../../src/domain/time.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, makeUserWithPassword, readSessionCookie, signIn } from '../helpers/auth.js'
import { MINUTE, makeEvent, makeOrganizer, prisma, resetDb } from '../helpers/db.js'

const T = new Date('2026-11-05T10:00:00.000Z')
const domainDir = fileURLToPath(new URL('../../src/domain/', import.meta.url))

beforeEach(async () => {
  await resetDb()
  setNow(T)
})
afterEach(() => resetNow())
afterAll(() => prisma.$disconnect())

async function threeEvents() {
  const org = await makeOrganizer()
  const after = await makeEvent(org.id, { startAt: new Date(T.getTime() + MINUTE) })
  const at = await makeEvent(org.id, { startAt: new Date(T.getTime()) })
  const before = await makeEvent(org.id, { startAt: new Date(T.getTime() - MINUTE) })
  return { after, at, before }
}

describe('TEST-SR3-01 — the server clock decides "upcoming" and "started" (AC-SR3-01, NFR-11)', () => {
  it('now() returns the fixed time T, and a copy that cannot move the clock', () => {
    const t = now()
    expect(t.toISOString()).toBe('2026-11-05T10:00:00.000Z')
    t.setUTCFullYear(2000)
    expect(now().toISOString()).toBe('2026-11-05T10:00:00.000Z')
  })

  it('only the T + 1 min event is upcoming in the database query', async () => {
    const { after } = await threeEvents()
    const rows = await prisma.event.findMany({ where: upcomingWhere(), select: { id: true } })
    expect(rows).toEqual([{ id: after.id }])
  })

  it('an event starting exactly at T counts as started, like T − 1 min; T + 1 min has not started', async () => {
    const { after, at, before } = await threeEvents()
    expect(hasStarted(after.startAt)).toBe(false)
    expect(hasStarted(at.startAt)).toBe(true)
    expect(hasStarted(before.startAt)).toBe(true)
  })

  // M4: TEST-SR3-01 boundary case for E-04 and E-05
  it('E-04 returns only T + 1 min event; E-05 for T returns hasStarted: true and viewer.action: CLOSED', async () => {
    const { after, at } = await threeEvents()
    const app = makeApp()

    // E-04 list: only upcoming event (T + 1 min) is returned
    const listRes = await request(app).get('/api/events')
    expect(listRes.status).toBe(200)
    expect(listRes.body.items).toHaveLength(1)
    expect(listRes.body.items[0].id).toBe(after.id)

    // E-05 detail for T (starting at exact now T): counts as started -> hasStarted: true, CLOSED
    const detailRes = await request(app).get(`/api/events/${at.id}`)
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.hasStarted).toBe(true)
    expect(detailRes.body.viewer.action).toBe('CLOSED')
  })

  // Contracts v1.2 §3: I-08 adds the E-09 case. The event starting exactly at T is closed; T + 1 min is open.
  it('E-09 at T: the T event → 409 REGISTRATION_CLOSED, the T + 1 min event → 201', async () => {
    const { after, at } = await threeEvents()
    const app = makeApp()
    const { user, password } = await makeUserWithPassword('PARTICIPANT')
    const cookie = cookieHeader(readSessionCookie(await signIn(request(app), user.email, password))!.value)
    const e09 = (id: number) =>
      request(app).post(`/api/events/${id}/registrations`).set('Origin', TEST_ORIGIN).set('Cookie', cookie)

    const closed = await e09(at.id)
    expect(closed.status).toBe(409)
    expect(closed.body.error.code).toBe('REGISTRATION_CLOSED')
    expect((await e09(after.id)).status).toBe(201)
  })

  it('times survive the database to the millisecond and serialise as UTC ending in Z', async () => {
    const { after } = await threeEvents()
    const row = await prisma.event.findUniqueOrThrow({ where: { id: after.id } })
    expect(row.startAt.getTime()).toBe(T.getTime() + MINUTE)
    const json = JSON.parse(JSON.stringify(row)) as Record<string, unknown>
    expect(json.startAt).toBe('2026-11-05T10:01:00.000Z')
    for (const key of ['startAt', 'endAt', 'createdAt', 'updatedAt']) expect(json[key]).toMatch(/Z$/)
  })

  it('after resetNow() the clock follows real time again', () => {
    resetNow()
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(5_000)
  })

  it('setNow() refuses to run outside NODE_ENV=test', () => {
    const saved = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(() => setNow(T)).toThrow(/test/)
    } finally {
      process.env.NODE_ENV = saved
    }
  })

  it('rule code in src/domain never reads the system clock directly (contracts §3 item 1)', () => {
    const files = readdirSync(domainDir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const code = readFileSync(path.join(domainDir, file), 'utf8')
      expect(code, file).not.toMatch(/Date\.now\s*\(|new Date\(\s*\)/)
    }
  })
})
