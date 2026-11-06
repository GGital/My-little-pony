import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetNow, setNow } from '../../src/clock.js'
import { makeApp } from '../helpers/app.js'
import { cookieHeader, makeUserWithPassword, readSessionCookie, signIn } from '../helpers/auth.js'
import { DAY, HOUR, makeEvent, makeOrganizer, prisma, resetDb } from '../helpers/db.js'

// Feature-H (contracts §11): E-10 GET /api/me/registrations and E-11 GET /api/me/registrations/:id, on the real
// test database with its own data (STS §1.3).
const app = makeApp()
const T = new Date('2026-11-07T10:00:00.000Z')

type SignedIn = { id: number; cookie: string }
let p1: SignedIn // registered for three events
let p2: SignedIn // registered for none
let p3: SignedIn // holds the "someone else's" registration
let o1: SignedIn
const ids = { soon: 0, later: 0, latest: 0, p3Reg: 0, p1Regs: [] as number[] }

async function signedIn(role: 'PARTICIPANT' | 'ORGANIZER', name?: string): Promise<SignedIn> {
  const { user, password } = await makeUserWithPassword(role, name)
  const res = await signIn(request(app), user.email, password)
  expect(res.status).toBe(200)
  return { id: user.id, cookie: cookieHeader(readSessionCookie(res)!.value) }
}
const get = (path: string, who?: SignedIn) => {
  const req = request(app).get(path)
  return who ? req.set('Cookie', who.cookie) : req
}

beforeAll(async () => {
  await resetDb()
  setNow(T)
  p1 = await signedIn('PARTICIPANT', 'Mint')
  p2 = await signedIn('PARTICIPANT', 'Nok')
  p3 = await signedIn('PARTICIPANT', 'Ploy')
  o1 = await signedIn('ORGANIZER', 'Quantum Cards')
  const org = await makeOrganizer()

  // Created out of start order, so the test proves the sort; one has already started (like EV-4).
  const later = await makeEvent(org.id, { startAt: new Date(T.getTime() + 3 * DAY) })
  const latest = await makeEvent(org.id, { startAt: new Date(T.getTime() + 5 * DAY) })
  const soon = await makeEvent(org.id, { startAt: new Date(T.getTime() - HOUR) })
  const other = await makeEvent(org.id, { capacity: 2, startAt: new Date(T.getTime() + 4 * DAY) })
  Object.assign(ids, { soon: soon.id, later: later.id, latest: latest.id })

  for (const event of [later, latest, soon]) {
    const reg = await prisma.registration.create({ data: { eventId: event.id, participantId: p1.id } })
    ids.p1Regs.push(reg.id)
  }
  ids.p3Reg = (await prisma.registration.create({ data: { eventId: other.id, participantId: p3.id } })).id
})
afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-H-01 — My Events lists only the caller\'s registrations, soonest first (AC-H-01, FR-17)', () => {
  it('P1: exactly three ParticipantRegistrations in event start order, each with its event and counts', async () => {
    const res = await get('/api/me/registrations', p1)

    expect(res.status).toBe(200)
    expect(Object.keys(res.body)).toEqual(['items'])
    expect(res.body.items.map((r: { event: { id: number } }) => r.event.id)).toEqual([ids.soon, ids.later, ids.latest])
    for (const item of res.body.items) {
      expect(item).toMatchObject({
        id: expect.any(Number),
        status: 'REGISTERED',
        createdAt: expect.stringMatching(/Z$/),
        event: { title: expect.any(String), startAt: expect.stringMatching(/Z$/), registeredCount: 1, capacity: 24, seatsRemaining: 23 },
      })
    }
    // Checked against the database, independently of the code under test (STS §1.1 rule 3).
    const own = await prisma.registration.findMany({ where: { participantId: p1.id }, select: { id: true } })
    expect(res.body.items.map((r: { id: number }) => r.id).sort()).toEqual(own.map((r) => r.id).sort())
  })

  it('P2 with no registrations: 200 { items: [] }', async () => {
    const res = await get('/api/me/registrations', p2)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [] })
  })

  it('E-11 returns one of the caller\'s own registrations with its event', async () => {
    const res = await get(`/api/me/registrations/${ids.p1Regs[0]}`, p1)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: ids.p1Regs[0], status: 'REGISTERED', event: { id: ids.later } })
  })
})

describe('TEST-H-02 — another participant\'s registration is never confirmed (AC-H-02, BR-16)', () => {
  it('P1 on P3\'s registration and on a missing id: both 404 REGISTRATION_NOT_FOUND, byte-identical, no P3 data', async () => {
    const others = await get(`/api/me/registrations/${ids.p3Reg}`, p1)
    const missing = await get('/api/me/registrations/999999', p1)

    expect(others.status).toBe(404)
    expect(others.body).toEqual({ error: { code: 'REGISTRATION_NOT_FOUND', message: 'This registration could not be found.' } })
    expect(others.text).toBe(missing.text)
    expect(others.text).not.toContain('Ploy')
  })

  it('an organizer calling E-10 or E-11 → 403 FORBIDDEN; signed out → 401', async () => {
    expect((await get('/api/me/registrations', o1)).status).toBe(403)
    expect((await get(`/api/me/registrations/${ids.p1Regs[0]}`, o1)).status).toBe(403)
    expect((await get('/api/me/registrations')).status).toBe(401)
  })

  it('E-11 path id: abc, 0 and 2147483648 → 400 INVALID_PATH_PARAMETER for a participant', async () => {
    for (const id of ['abc', '0', '2147483648']) {
      const res = await get(`/api/me/registrations/${id}`, p1)
      expect(res.status, id).toBe(400)
      expect(res.body.error.code).toBe('INVALID_PATH_PARAMETER')
    }
  })
})
