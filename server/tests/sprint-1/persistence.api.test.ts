import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, makeUserWithPassword, readSessionCookie, signIn } from '../helpers/auth.js'
import { makeEvent, makeOrganizer, makeParticipant, prisma, resetDb } from '../helpers/db.js'

// TEST-SR1-01 · AC-SR1-01 · NFR-06 (STS §2.1)
// I-01 has no API yet, so the write goes through the data layer. The same check through the API and after a real
// server restart is repeated in I-12 (manual part of TEST-SR1-01 and journey JRN-01).
describe('TEST-SR1-01 data survives a new database connection', () => {
  beforeAll(resetDb)
  afterAll(() => prisma.$disconnect())

  it('reads back an event and a registration, with identical values, through a separate Prisma client', async () => {
    const organizer = await makeOrganizer('Quantum Cards')
    const participant = await makeParticipant('Mint')
    const event = await makeEvent(organizer.id, { capacity: 24 })
    const registration = await prisma.registration.create({
      data: { eventId: event.id, participantId: participant.id },
    })
    await prisma.$disconnect()

    const fresh = new PrismaClient()
    try {
      expect(await fresh.event.findUniqueOrThrow({ where: { id: event.id } })).toEqual(event)
      expect(await fresh.registration.findUniqueOrThrow({ where: { id: registration.id } })).toEqual(registration)
      expect(registration.status).toBe('REGISTERED')
    } finally {
      await fresh.$disconnect()
    }
  })
})

// I-12 (contracts v1.1 §1): the same check through the API. A new app with a new Prisma client stands in for the
// restarted server: nothing in memory survives, so whatever E-10 shows afterwards came from PostgreSQL. The manual
// part (stop and start the real server, reload /me/registrations) is recorded in STS §6.
describe('TEST-SR1-01 (I-12) — what the API wrote survives a new app and a new database connection', () => {
  beforeAll(resetDb)

  it('an event published with E-06 and a registration made with E-09 read back identically after a "restart"', async () => {
    const first = makeApp()
    const { user: organizer, password: oPass } = await makeUserWithPassword('ORGANIZER', 'Quantum Cards')
    const { user: participant, password: pPass } = await makeUserWithPassword('PARTICIPANT', 'Mint')
    const oCookie = cookieHeader(readSessionCookie(await signIn(request(first), organizer.email, oPass))!.value)
    const pCookie = cookieHeader(readSessionCookie(await signIn(request(first), participant.email, pPass))!.value)

    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const created = await request(first)
      .post('/api/events')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', oCookie)
      .send({
        title: 'Persistence Night',
        type: 'CASUAL',
        format: 'CONSTRUCTED',
        venueName: 'Quantum Cards',
        venueAddress: '1 Test Road',
        city: 'Bangkok',
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        capacity: 24,
      })
    expect(created.status).toBe(201)
    const registered = await request(first)
      .post(`/api/events/${created.body.id}/registrations`)
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', pCookie)
    expect(registered.status).toBe(201)
    const beforeEvent = (await request(first).get(`/api/events/${created.body.id}`)).body
    const beforeMine = (await request(first).get('/api/me/registrations').set('Cookie', pCookie)).body
    await prisma.$disconnect()

    const fresh = new PrismaClient()
    try {
      const restarted = makeApp({ prisma: fresh })
      expect((await request(restarted).get(`/api/events/${created.body.id}`)).body).toEqual(beforeEvent)
      const mine = await request(restarted).get('/api/me/registrations').set('Cookie', pCookie)
      expect(mine.status).toBe(200)
      expect(mine.body).toEqual(beforeMine)
      expect(mine.body.items).toHaveLength(1)
      expect(mine.body.items[0]).toMatchObject({ id: registered.body.id, status: 'REGISTERED', event: { title: 'Persistence Night' } })
    } finally {
      await fresh.$disconnect()
    }
  })
})
