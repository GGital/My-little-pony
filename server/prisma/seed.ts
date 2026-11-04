import { pathToFileURL } from 'node:url'
import { PrismaClient, type EventFormat, type EventType, type Role } from '@prisma/client'
import { hashPassword } from '../src/domain/password.js'

// Idempotent demo seed: exactly the accounts and events of Sprint 1 contracts §0.3 (SR-01, AC-SR1-02).
// Users are matched by email and events by seedKey, so a second run finds everything and creates nothing.
// Times are relative to the moment the seed first runs, so upcoming events stay upcoming.
export const SEED_PASSWORD_MIN_LENGTH = 12

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const USERS: { email: string; displayName: string; role: Role }[] = [
  { email: 'quantum@organizer.example', displayName: 'Quantum Cards', role: 'ORGANIZER' },
  { email: 'dragon@organizer.example', displayName: "Dragon's Den", role: 'ORGANIZER' },
  { email: 'mint@player.example', displayName: 'Mint', role: 'PARTICIPANT' },
  { email: 'ploy@player.example', displayName: 'Ploy', role: 'PARTICIPANT' },
  { email: 'boss@player.example', displayName: 'Boss', role: 'PARTICIPANT' },
  { email: 'nok@player.example', displayName: 'Nok', role: 'PARTICIPANT' },
]

type SeedEvent = {
  seedKey: string
  owner: string
  title: string
  type: EventType
  format: EventFormat
  venueName: string
  venueAddress: string
  city: string
  startOffset: number
  hours: number
  capacity: number
  feeLabel?: string
  structureNote?: string
  contact?: string
  description?: string
  registered: string[]
}

const QUANTUM = {
  venueName: 'Quantum Cards',
  venueAddress: '1631 Kanchanaphisek Rd, Bang Khae, Bangkok 10160',
  city: 'Bangkok',
  contact: 'hello@quantumcards.example',
}
const DRAGON = {
  venueName: "Dragon's Den",
  venueAddress: '88 Rama I Rd, Pathum Wan, Bangkok 10330',
  city: 'Bangkok',
  contact: 'play@dragonsden.example',
}

const EVENTS: SeedEvent[] = [
  {
    seedKey: 'EV-1', owner: 'quantum@organizer.example', ...QUANTUM, title: 'Friday Night Constructed',
    type: 'CASUAL', format: 'CONSTRUCTED', startOffset: 2 * DAY, hours: 4, capacity: 24, feeLabel: 'THB 250',
    structureNote: '4 rounds · Best of 1',
    description: 'Bring a legal constructed deck. Promo pack for every player. Please arrive 15 minutes early.',
    registered: ['mint@player.example', 'ploy@player.example', 'boss@player.example'],
  },
  {
    seedKey: 'EV-2', owner: 'quantum@organizer.example', ...QUANTUM, title: 'Last Seat Sealed',
    type: 'RELEASE', format: 'SEALED', startOffset: 3 * DAY, hours: 5, capacity: 4, feeLabel: 'THB 900',
    structureNote: '3 rounds · Best of 3', description: 'Small-table sealed event. Product included in the entry.',
    registered: ['mint@player.example', 'ploy@player.example', 'boss@player.example'],
  },
  {
    seedKey: 'EV-3', owner: 'dragon@organizer.example', ...DRAGON, title: 'Store Championship Qualifier',
    type: 'TOURNAMENT', format: 'CONSTRUCTED', startOffset: 4 * DAY, hours: 6, capacity: 2, feeLabel: 'THB 400',
    structureNote: 'Swiss · Top 8 cut', description: 'Competitive rules apply. Deck lists are checked at the door.',
    registered: ['ploy@player.example', 'boss@player.example'],
  },
  {
    seedKey: 'EV-4', owner: 'dragon@organizer.example', ...DRAGON, title: 'Live Now Casual',
    type: 'CASUAL', format: 'CONSTRUCTED', startOffset: -1 * HOUR, hours: 4, capacity: 8,
    description: 'Already running: shows how a started event looks.', registered: ['mint@player.example'],
  },
  {
    seedKey: 'EV-5', owner: 'dragon@organizer.example', ...DRAGON, title: 'Dragon Draft Night',
    type: 'CASUAL', format: 'DRAFT', startOffset: 5 * DAY, hours: 4, capacity: 16, feeLabel: 'THB 600',
    structureNote: '3 rounds · Best of 3', registered: [],
  },
  {
    seedKey: 'EV-6', owner: 'quantum@organizer.example', ...QUANTUM, title: 'Release Weekend Sealed · เปิดกล่องสุดสัปดาห์',
    type: 'RELEASE', format: 'SEALED', startOffset: 7 * DAY, hours: 8, capacity: 32, feeLabel: 'THB 900',
    description: 'New-set release weekend. ชวนเพื่อนมาเปิดกล่องด้วยกัน', registered: [],
  },
]

export async function seed(prisma: PrismaClient, password = process.env.SEED_PASSWORD): Promise<void> {
  if (!password || password.length < SEED_PASSWORD_MIN_LENGTH) {
    throw new Error(`SEED_PASSWORD must be set and at least ${SEED_PASSWORD_MIN_LENGTH} characters`)
  }

  const ids = new Map<string, number>()
  for (const user of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } })
    const row = existing ?? (await prisma.user.create({ data: { ...user, passwordHash: await hashPassword(password) } }))
    ids.set(user.email, row.id)
  }

  const now = Date.now()
  for (const { seedKey, owner, startOffset, hours, registered, ...fields } of EVENTS) {
    const startAt = new Date(now + startOffset)
    const event = await prisma.event.upsert({
      where: { seedKey },
      update: {},
      create: {
        ...fields,
        seedKey,
        organizerId: ids.get(owner)!,
        startAt,
        endAt: new Date(startAt.getTime() + hours * HOUR),
        status: 'PUBLISHED',
        publishedAt: new Date(now),
      },
    })
    for (const email of registered) {
      const participantId = ids.get(email)!
      const active = await prisma.registration.findFirst({
        where: { eventId: event.id, participantId, status: { in: ['REGISTERED', 'CHECKED_IN'] } },
      })
      if (!active) await prisma.registration.create({ data: { eventId: event.id, participantId } })
    }
  }
}

// `npm run db:seed` runs this file directly; the tests import seed() instead.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const prisma = new PrismaClient()
  seed(prisma)
    .then(() => console.log('Seed complete: 2 organizers, 4 participants, 6 events (Sprint 1 contracts §0.3).'))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
