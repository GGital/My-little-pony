import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
