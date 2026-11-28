import { PrismaClient, type Role } from '@prisma/client'

/** One client per test file; DATABASE_URL already points at the test database (vitest.config.ts). */
export const prisma = new PrismaClient()

/** Empties every table and restarts ids, so each test file starts from nothing (STS §1.3). */
export async function resetDb() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Registration", "Session", "Event", "User", "LoginAttempt" RESTART IDENTITY CASCADE')
}

let counter = 0
const next = () => ++counter

export async function makeUser(role: Role, name?: string, over: { email?: string; passwordHash?: string } = {}) {
  const i = next()
  return prisma.user.create({
    data: {
      email: over.email ?? `user${i}@test.example`,
      displayName: name ?? `User ${i}`,
      passwordHash: over.passwordHash ?? 'scrypt$test',
      role,
    },
  })
}
export const makeOrganizer = (name?: string) => makeUser('ORGANIZER', name)
export const makeParticipant = (name?: string) => makeUser('PARTICIPANT', name)

export const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR
export const MINUTE = 60 * 1000

export async function makeEvent(organizerId: number, over: Partial<{ capacity: number; startAt: Date; endAt: Date }> = {}) {
  const startAt = over.startAt ?? new Date(Date.now() + 24 * HOUR)
  return prisma.event.create({
    data: {
      organizerId,
      title: `Test event ${next()}`,
      type: 'CASUAL',
      format: 'CONSTRUCTED',
      venueName: 'Test Venue',
      venueAddress: '1 Test Road',
      city: 'Bangkok',
      startAt,
      endAt: over.endAt ?? new Date(startAt.getTime() + 4 * HOUR),
      capacity: over.capacity ?? 24,
      publishedAt: new Date(),
    },
  })
}

/** Inserts an event with raw SQL, bypassing every application rule, so only database constraints can refuse it. */
export function insertEventRaw(organizerId: number, capacity: number, startAt: Date, endAt: Date) {
  return prisma.$executeRaw`
    INSERT INTO "Event" ("organizerId", "title", "type", "format", "venueName", "venueAddress", "city",
                         "startAt", "endAt", "capacity", "status", "updatedAt")
    VALUES (${organizerId}, 'Raw', 'CASUAL', 'CONSTRUCTED', 'V', 'A', 'C',
            ${startAt}, ${endAt}, ${capacity}, 'PUBLISHED', now())`
}

/**
 * Inserts a registration with raw SQL, bypassing every application rule. A CHECKED_IN row gets the check-in fields that
 * registration_checkin_fields requires (Sprint 3, BR-19), checked in by the participant id itself (any user id will do), so
 * the constraint a test aims at is the only one that can refuse the row.
 */
export function insertRegistrationRaw(eventId: number, participantId: number, status: string) {
  const checkedIn = status === 'CHECKED_IN'
  return prisma.$executeRaw`
    INSERT INTO "Registration" ("eventId", "participantId", "status", "checkedInAt", "checkedInById")
    VALUES (${eventId}, ${participantId}, ${status}::"RegistrationStatus",
            ${checkedIn ? new Date() : null}, ${checkedIn ? participantId : null})`
}

/** Row count of every table, read independently of the code under test (STS §1.1 rule 3). */
export async function tableCounts() {
  const [users, sessions, events, registrations, eventChanges] = await Promise.all([
    prisma.user.count(),
    prisma.session.count(),
    prisma.event.count(),
    prisma.registration.count(),
    prisma.eventChange.count(), // Sprint 2 (SR-08): history rows count too, so "GET never writes" watches them
  ])
  return { users, sessions, events, registrations, eventChanges }
}
