import { pathToFileURL } from 'node:url'
import { PrismaClient, type EventFormat, type EventStatus, type EventType, type Game, type Role } from '@prisma/client'
import { hashPassword } from '../src/domain/password.js'

// Idempotent demo seed: exactly the accounts and events of Sprint 1 contracts §0.3 and Sprint 2 contracts §0.4
// (SR-01, AC-SR1-02). All values are synthetic.
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

// Sprint 2 §0.4 (Feature-U, D-37): each store's games and public contact. Never the sign-in email.
const STORES: Record<string, { games: Game[]; contactPhone: string; contactEmail: string; contactWebsite: string | null; contactLine: string | null }> = {
  'quantum@organizer.example': {
    games: ['POKEMON', 'MAGIC', 'ONE_PIECE', 'YUGIOH', 'DIGIMON'],
    contactPhone: '02 555 0101',
    contactEmail: 'hello@quantumcards.example',
    contactWebsite: 'https://quantumcards.example',
    contactLine: '@quantumcards',
  },
  'dragon@organizer.example': {
    games: ['MAGIC', 'YUGIOH', 'LORCANA'],
    contactPhone: '02 555 0202',
    contactEmail: 'play@dragonsden.example',
    contactWebsite: null,
    contactLine: null,
  },
}

type SeedEvent = {
  seedKey: string
  owner: string
  title: string
  type: EventType
  format: EventFormat
  game: Game
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
  // Sprint 2 §0.4: the life-cycle state EV-7 … EV-9 need. Without these, the event is PUBLISHED with no deadline.
  status?: EventStatus
  deadlineOffset?: number
  cancelReason?: string
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
    seedKey: 'EV-1', owner: 'quantum@organizer.example', ...QUANTUM, title: 'Friday Night Constructed', game: 'MAGIC',
    type: 'CASUAL', format: 'CONSTRUCTED', startOffset: 2 * DAY, hours: 4, capacity: 24, feeLabel: 'THB 250',
    structureNote: '4 rounds · Best of 1',
    description: 'Bring a legal constructed deck. Promo pack for every player. Please arrive 15 minutes early.',
    registered: ['mint@player.example', 'ploy@player.example', 'boss@player.example'],
  },
  {
    seedKey: 'EV-2', owner: 'quantum@organizer.example', ...QUANTUM, title: 'Last Seat Sealed', game: 'MAGIC',
    type: 'RELEASE', format: 'SEALED', startOffset: 3 * DAY, hours: 5, capacity: 4, feeLabel: 'THB 900',
    structureNote: '3 rounds · Best of 3', description: 'Small-table sealed event. Product included in the entry.',
    registered: ['mint@player.example', 'ploy@player.example', 'boss@player.example'],
  },
  {
    seedKey: 'EV-3', owner: 'dragon@organizer.example', ...DRAGON, title: 'Store Championship Qualifier', game: 'YUGIOH',
    type: 'TOURNAMENT', format: 'CONSTRUCTED', startOffset: 4 * DAY, hours: 6, capacity: 2, feeLabel: 'THB 400',
    structureNote: 'Swiss · Top 8 cut', description: 'Competitive rules apply. Deck lists are checked at the door.',
    registered: ['ploy@player.example', 'boss@player.example'],
  },
  {
    seedKey: 'EV-4', owner: 'dragon@organizer.example', ...DRAGON, title: 'Live Now Casual', game: 'LORCANA',
    type: 'CASUAL', format: 'CONSTRUCTED', startOffset: -1 * HOUR, hours: 4, capacity: 8,
    description: 'Already running: shows how a started event looks.', registered: ['mint@player.example'],
  },
  {
    seedKey: 'EV-5', owner: 'dragon@organizer.example', ...DRAGON, title: 'Dragon Draft Night', game: 'MAGIC',
    type: 'CASUAL', format: 'DRAFT', startOffset: 5 * DAY, hours: 4, capacity: 16, feeLabel: 'THB 600',
    structureNote: '3 rounds · Best of 3', registered: [],
  },
  {
    seedKey: 'EV-6', owner: 'quantum@organizer.example', ...QUANTUM, title: 'Release Weekend Sealed · เปิดกล่องสุดสัปดาห์',
    game: 'POKEMON', type: 'RELEASE', format: 'SEALED', startOffset: 7 * DAY, hours: 8, capacity: 32, feeLabel: 'THB 900',
    description: 'New-set release weekend. ชวนเพื่อนมาเปิดกล่องด้วยกัน', registered: [],
  },
  // Sprint 2 contracts §0.4: a draft, a cancelled event and a deadline that has passed.
  {
    seedKey: 'EV-7', owner: 'quantum@organizer.example', ...QUANTUM, title: 'Prerelease Planning Night', game: 'ONE_PIECE',
    type: 'RELEASE', format: 'SEALED', startOffset: 10 * DAY, hours: 4, capacity: 16, status: 'DRAFT',
    description: 'Draft: the date and the product are still being confirmed.', registered: [],
  },
  {
    seedKey: 'EV-8', owner: 'dragon@organizer.example', ...DRAGON, title: 'Rainy Day Casual', game: 'YUGIOH',
    type: 'CASUAL', format: 'CONSTRUCTED', startOffset: 6 * DAY, hours: 4, capacity: 12, status: 'CANCELLED',
    cancelReason: 'Store closed for flooding repairs.', registered: ['boss@player.example'],
  },
  {
    seedKey: 'EV-9', owner: 'quantum@organizer.example', ...QUANTUM, title: 'Early Deadline Sealed', game: 'POKEMON',
    type: 'CASUAL', format: 'SEALED', startOffset: 2 * DAY, hours: 4, capacity: 8, deadlineOffset: -1 * HOUR,
    description: 'Registration closed early so the product can be ordered.', registered: ['mint@player.example'],
  },
]

export async function seed(prisma: PrismaClient, password = process.env.SEED_PASSWORD): Promise<void> {
  if (!password || password.length < SEED_PASSWORD_MIN_LENGTH) {
    throw new Error(`SEED_PASSWORD must be set and at least ${SEED_PASSWORD_MIN_LENGTH} characters`)
  }

  const ids = new Map<string, number>()
  for (const user of USERS) {
    const store = STORES[user.email] ?? {}
    const existing = await prisma.user.findUnique({ where: { email: user.email } })
    // An existing account keeps its password. The Sprint 2 store fields are applied again, which changes nothing.
    const row = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: store })
      : await prisma.user.create({ data: { ...user, ...store, passwordHash: await hashPassword(password) } })
    ids.set(user.email, row.id)
  }

  const now = Date.now()
  const seededAt = new Date(now)
  for (const { seedKey, owner, startOffset, hours, registered, status = 'PUBLISHED', deadlineOffset, cancelReason, ...fields } of EVENTS) {
    const startAt = new Date(now + startOffset)
    const organizerId = ids.get(owner)!
    const cancelled = status === 'CANCELLED'
    // An event that already exists keeps its times and state (§0.4); only the Sprint 2 game is filled in.
    const event = await prisma.event.upsert({
      where: { seedKey },
      update: { game: fields.game },
      create: {
        ...fields,
        seedKey,
        organizerId,
        startAt,
        endAt: new Date(startAt.getTime() + hours * HOUR),
        status,
        publishedAt: status === 'DRAFT' ? null : seededAt,
        registrationDeadline: deadlineOffset === undefined ? null : new Date(now + deadlineOffset),
        ...(cancelled ? { cancelledAt: seededAt, cancelledById: organizerId, cancelReason } : {}),
      },
    })
    for (const email of registered) {
      const participantId = ids.get(email)!
      // Any earlier row counts, so a registration a player has since cancelled is not created again on a re-run.
      const existing = await prisma.registration.findFirst({ where: { eventId: event.id, participantId } })
      if (existing) continue
      await prisma.registration.create({
        data: cancelled
          ? { eventId: event.id, participantId, status: 'EVENT_CANCELLED', cancelledAt: seededAt }
          : { eventId: event.id, participantId },
      })
    }
  }
}

// `npm run db:seed` runs this file directly; the tests import seed() instead.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const prisma = new PrismaClient()
  seed(prisma)
    .then(() => console.log('Seed complete: 2 organizers, 4 participants, 9 events (Sprint 1 §0.3, Sprint 2 §0.4).'))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
