import crypto from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { makeApp } from '../helpers/app.js'
import { prisma, resetDb } from '../helpers/db.js'

const app = makeApp()

async function cookieFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } })
  const token = crypto.randomBytes(32).toString('base64url')
  const id = crypto.createHash('sha256').update(token).digest('hex')
  await prisma.session.create({
    data: {
      id,
      userId: user.id,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  })
  return `tcg.sid=${token}`
}

beforeAll(async () => {
  await resetDb()
  await seed(prisma, 'test-only-seed-password')
})

afterAll(() => prisma.$disconnect())

describe('TEST-F-01 — public event list E-04 (AC-F-01, FR-11)', () => {
  it('returns upcoming published events in startAt then id order with accurate counts', async () => {
    const res = await request(app).get('/api/events')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('items')
    expect(Array.isArray(res.body.items)).toBe(true)

    const items = res.body.items
    // EV-4 has started, so 5 events: EV-1, EV-2, EV-3, EV-5, EV-6
    expect(items.length).toBe(5)

    // Check order: startAt asc, then id asc
    for (let i = 1; i < items.length; i++) {
      const prev = new Date(items[i - 1].startAt).getTime()
      const curr = new Date(items[i].startAt).getTime()
      expect(curr >= prev).toBe(true)
      if (curr === prev) {
        expect(items[i].id).toBeGreaterThan(items[i - 1].id)
      }
    }

    // Verify EV-3 (Store Championship Qualifier) is full
    const ev3 = items.find((e: { title: string }) => e.title === 'Store Championship Qualifier')
    expect(ev3).toBeDefined()
    expect(ev3.capacity).toBe(2)
    expect(ev3.registeredCount).toBe(2)
    expect(ev3.seatsRemaining).toBe(0)

    // Verify EV-1 counts (3 / 24, 21 left)
    const ev1 = items.find((e: { title: string }) => e.title === 'Friday Night Constructed')
    expect(ev1).toBeDefined()
    expect(ev1.capacity).toBe(24)
    expect(ev1.registeredCount).toBe(3)
    expect(ev1.seatsRemaining).toBe(21)
  })

  it('returns the same list when called with a session', async () => {
    const cookie = await cookieFor('nok@player.example')
    const withoutSession = await request(app).get('/api/events')
    const withSession = await request(app).get('/api/events').set('Cookie', cookie)

    expect(withSession.status).toBe(200)
    expect(withSession.body).toEqual(withoutSession.body)
  })
})

describe('TEST-F-02 — event detail E-05 and viewer.action (AC-F-02, FR-12)', () => {
  it('returns matching viewer.action and all public fields across visitor, player, owner, other organizer', async () => {
    const ev1 = await prisma.event.findFirstOrThrow({ where: { seedKey: 'EV-1' } })
    const ev3 = await prisma.event.findFirstOrThrow({ where: { seedKey: 'EV-3' } })
    const mint = await prisma.user.findUniqueOrThrow({ where: { email: 'mint@player.example' } })
    const mintReg = await prisma.registration.findFirstOrThrow({
      where: { eventId: ev1.id, participantId: mint.id, status: 'REGISTERED' },
    })

    const nokCookie = await cookieFor('nok@player.example')
    const mintCookie = await cookieFor('mint@player.example')
    const dragonCookie = await cookieFor('dragon@organizer.example')
    const quantumCookie = await cookieFor('quantum@organizer.example')

    // 1. As visitor on EV-1
    const resVisitor = await request(app).get(`/api/events/${ev1.id}`)
    expect(resVisitor.status).toBe(200)
    expect(resVisitor.body.viewer).toEqual({ action: 'SIGN_IN_TO_REGISTER', registrationId: null })

    // Check all public fields are present
    const expectedKeys = [
      'id', 'title', 'type', 'format', 'venueName', 'venueAddress', 'city',
      'startAt', 'endAt', 'capacity', 'registeredCount', 'seatsRemaining', 'status',
      'feeLabel', 'structureNote', 'contact', 'description', 'organizer', 'hasStarted', 'viewer'
    ]
    for (const key of expectedKeys) {
      expect(resVisitor.body).toHaveProperty(key)
    }
    expect(resVisitor.body.organizer).toEqual({ displayName: 'Quantum Cards' })
    expect(resVisitor.body.hasStarted).toBe(false)

    // 2. As Nok (participant, not registered) on EV-1
    const resNok = await request(app).get(`/api/events/${ev1.id}`).set('Cookie', nokCookie)
    expect(resNok.status).toBe(200)
    expect(resNok.body.viewer).toEqual({ action: 'REGISTER', registrationId: null })

    // 3. As Mint (participant, registered) on EV-1
    const resMint = await request(app).get(`/api/events/${ev1.id}`).set('Cookie', mintCookie)
    expect(resMint.status).toBe(200)
    expect(resMint.body.viewer).toEqual({ action: 'REGISTERED', registrationId: mintReg.id })

    // 4. As Dragon\'s Den (other organizer) on EV-1
    const resDragon = await request(app).get(`/api/events/${ev1.id}`).set('Cookie', dragonCookie)
    expect(resDragon.status).toBe(200)
    expect(resDragon.body.viewer).toEqual({ action: 'ORGANIZER_CANNOT_REGISTER', registrationId: null })

    // 5. As Quantum Cards (owner) on EV-1
    const resQuantum = await request(app).get(`/api/events/${ev1.id}`).set('Cookie', quantumCookie)
    expect(resQuantum.status).toBe(200)
    expect(resQuantum.body.viewer).toEqual({ action: 'MANAGE', registrationId: null })

    // 6. As Nok on EV-3 (full event)
    const resEv3Nok = await request(app).get(`/api/events/${ev3.id}`).set('Cookie', nokCookie)
    expect(resEv3Nok.status).toBe(200)
    expect(resEv3Nok.body.viewer).toEqual({ action: 'FULL', registrationId: null })
  })
})

describe('TEST-F-03 — non-existent and malformed path parameter (AC-F-03, FR-12)', () => {
  it('E-05 /999999 -> 404 EVENT_NOT_FOUND', async () => {
    const res = await request(app).get('/api/events/999999')
    expect(res.status).toBe(404)
    expect(res.body.error).toEqual({
      code: 'EVENT_NOT_FOUND',
      message: 'This event could not be found.',
    })
  })

  it.each(['abc', '0', '-1'])('E-05 /%s -> 400 INVALID_PATH_PARAMETER', async (badId) => {
    const res = await request(app).get(`/api/events/${badId}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toEqual({
      code: 'INVALID_PATH_PARAMETER',
      message: "That link doesn't look right.",
    })
  })
})

describe('TEST-F-04 — started events hidden from list and closed on detail (AC-F-04, BR-04)', () => {
  it('EV-4 is absent from E-04 list; E-05 returns hasStarted: true and action: CLOSED', async () => {
    const ev4 = await prisma.event.findFirstOrThrow({ where: { seedKey: 'EV-4' } })
    const nokCookie = await cookieFor('nok@player.example')

    // Absent from E-04 list
    const listRes = await request(app).get('/api/events')
    expect(listRes.status).toBe(200)
    const ids = listRes.body.items.map((e: { id: number }) => e.id)
    expect(ids).not.toContain(ev4.id)

    // Present on E-05 detail with hasStarted: true, viewer.action: CLOSED
    const detailRes = await request(app).get(`/api/events/${ev4.id}`).set('Cookie', nokCookie)
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.hasStarted).toBe(true)
    expect(detailRes.body.viewer).toEqual({ action: 'CLOSED', registrationId: null })
  })
})

describe('TEST-F-05 — privacy: no participant IDs, names, emails, or registrations key (AC-F-05, BR-16)', () => {
  it('neither E-04 nor E-05 responses contain participant data or the registrations key', async () => {
    const ev1 = await prisma.event.findFirstOrThrow({ where: { seedKey: 'EV-1' } })
    const nokCookie = await cookieFor('nok@player.example')

    const responses = [
      await request(app).get('/api/events'),
      await request(app).get('/api/events').set('Cookie', nokCookie),
      await request(app).get(`/api/events/${ev1.id}`),
      await request(app).get(`/api/events/${ev1.id}`).set('Cookie', nokCookie),
    ]

    for (const res of responses) {
      expect(res.status).toBe(200)
      const text = JSON.stringify(res.body)
      expect(text).not.toContain('mint@player.example')
      expect(text).not.toContain('ploy@player.example')
      expect(text).not.toContain('boss@player.example')
      expect(text).not.toContain('"registrations"')
      expect(text).not.toMatch(/"participantId"\s*:/)
    }
  })
})
