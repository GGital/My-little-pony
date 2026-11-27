import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { verifyPassword } from '../../src/domain/password.js'
import { prisma, resetDb } from '../helpers/db.js'

// TEST-SR1-02 · AC-SR1-02 · NFR-06 (STS §2.1). Expected data: Sprint 1 contracts §0.3, plus Sprint 2 contracts §0.4
// (revised in S2-01: EV-7 … EV-9, games and store contact; Sprint 2 STS §2.10).
const PASSWORD = 'local-test-only-seed-password'

const USERS = [
  ['quantum@organizer.example', 'Quantum Cards', 'ORGANIZER'],
  ['dragon@organizer.example', "Dragon's Den", 'ORGANIZER'],
  ['mint@player.example', 'Mint', 'PARTICIPANT'],
  ['ploy@player.example', 'Ploy', 'PARTICIPANT'],
  ['boss@player.example', 'Boss', 'PARTICIPANT'],
  ['nok@player.example', 'Nok', 'PARTICIPANT'],
] as const

// seedKey → [owner email, capacity, registered participants]
const EVENTS: Record<string, [string, number, string[]]> = {
  'EV-1': ['quantum@organizer.example', 24, ['Mint', 'Ploy', 'Boss']],
  'EV-2': ['quantum@organizer.example', 4, ['Mint', 'Ploy', 'Boss']],
  'EV-3': ['dragon@organizer.example', 2, ['Ploy', 'Boss']],
  'EV-4': ['dragon@organizer.example', 8, ['Mint']],
  'EV-5': ['dragon@organizer.example', 16, []],
  'EV-6': ['quantum@organizer.example', 32, []],
}

const counts = async () => ({
  users: await prisma.user.count(),
  events: await prisma.event.count(),
  registrations: await prisma.registration.count(),
})

describe('TEST-SR1-02 the seed creates the contract data once and only once', () => {
  beforeAll(resetDb)
  afterAll(() => prisma.$disconnect())

  it('creates 2 organizers, 4 participants, the 6 events of contracts §0.3 and the 3 of Sprint 2 §0.4', async () => {
    await seed(prisma, PASSWORD)

    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
    expect(users.map((u) => [u.email, u.displayName, u.role])).toEqual(USERS)

    for (const [key, [owner, capacity, names]] of Object.entries(EVENTS)) {
      const event = await prisma.event.findUniqueOrThrow({
        where: { seedKey: key },
        include: { organizer: true, registrations: { include: { participant: true } } },
      })
      expect(event.organizer.email, key).toBe(owner)
      expect(event.capacity, key).toBe(capacity)
      expect(event.status, key).toBe('PUBLISHED')
      expect(event.registrations.map((r) => r.participant.displayName).sort(), key).toEqual([...names].sort())
      expect(event.registrations.every((r) => r.status === 'REGISTERED'), key).toBe(true)
    }
    // Sprint 2 adds EV-7 (no registrations), EV-8 (Boss) and EV-9 (Mint): 9 events, 11 registrations.
    expect(await counts()).toEqual({ users: 6, events: 9, registrations: 11 })
  })

  it('gives EV-3 no free seat, EV-2 exactly one, and EV-4 a start in the past and an end in the future', async () => {
    const now = Date.now()
    const ev2 = await prisma.event.findUniqueOrThrow({ where: { seedKey: 'EV-2' }, include: { registrations: true } })
    const ev3 = await prisma.event.findUniqueOrThrow({ where: { seedKey: 'EV-3' }, include: { registrations: true } })
    const ev4 = await prisma.event.findUniqueOrThrow({ where: { seedKey: 'EV-4' } })
    expect(ev2.capacity - ev2.registrations.length).toBe(1)
    expect(ev3.capacity - ev3.registrations.length).toBe(0)
    expect(ev4.startAt.getTime()).toBeLessThan(now)
    expect(ev4.endAt.getTime()).toBeGreaterThan(now)
    // The Sprint 1 events only: EV-7 … EV-9 are checked in their own case below.
    const sprint1 = ['EV-1', 'EV-2', 'EV-3', 'EV-5', 'EV-6']
    const upcoming = await prisma.event.count({ where: { seedKey: { in: sprint1 }, startAt: { gt: new Date(now) } } })
    expect(upcoming).toBe(5)
  })

  it('adds EV-7 as a DRAFT, EV-8 CANCELLED with Boss EVENT_CANCELLED, EV-9 with a passed deadline and Mint (§0.4)', async () => {
    const now = Date.now()
    const load = (seedKey: string) =>
      prisma.event.findUniqueOrThrow({
        where: { seedKey },
        include: { organizer: true, cancelledBy: true, registrations: { include: { participant: true } } },
      })
    const [ev7, ev8, ev9] = await Promise.all([load('EV-7'), load('EV-8'), load('EV-9')])

    expect([ev7.title, ev7.organizer.displayName, ev7.status, ev7.capacity]).toEqual(['Prerelease Planning Night', 'Quantum Cards', 'DRAFT', 16])
    expect(ev7.publishedAt).toBeNull()
    expect(ev7.registrations).toEqual([])
    expect(ev7.startAt.getTime()).toBeGreaterThan(now)

    expect([ev8.title, ev8.organizer.displayName, ev8.status, ev8.capacity]).toEqual(['Rainy Day Casual', "Dragon's Den", 'CANCELLED', 12])
    expect(ev8.cancelReason).toBe('Store closed for flooding repairs.')
    expect(ev8.cancelledBy?.displayName).toBe("Dragon's Den")
    expect(ev8.cancelledAt).not.toBeNull()
    expect(ev8.registrations.map((r) => [r.participant.displayName, r.status, r.cancelledAt !== null])).toEqual([
      ['Boss', 'EVENT_CANCELLED', true],
    ])

    expect([ev9.title, ev9.organizer.displayName, ev9.status, ev9.capacity]).toEqual(['Early Deadline Sealed', 'Quantum Cards', 'PUBLISHED', 8])
    expect(ev9.startAt.getTime()).toBeGreaterThan(now)
    expect(ev9.registrationDeadline!.getTime()).toBeLessThan(now)
    expect(ev9.registrations.map((r) => [r.participant.displayName, r.status])).toEqual([['Mint', 'REGISTERED']])
  })

  it('gives each event its game and each store its games and public contact (§0.4, Feature-U)', async () => {
    const events = await prisma.event.findMany({ select: { seedKey: true, game: true }, orderBy: { seedKey: 'asc' } })
    expect(Object.fromEntries(events.map((e) => [e.seedKey, e.game]))).toEqual({
      'EV-1': 'MAGIC', 'EV-2': 'MAGIC', 'EV-3': 'YUGIOH', 'EV-4': 'LORCANA', 'EV-5': 'MAGIC',
      'EV-6': 'POKEMON', 'EV-7': 'ONE_PIECE', 'EV-8': 'YUGIOH', 'EV-9': 'POKEMON',
    })
    const store = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } })
    const [quantum, dragon, mint] = await Promise.all([
      store('quantum@organizer.example'), store('dragon@organizer.example'), store('mint@player.example'),
    ])
    expect(quantum.games).toEqual(['POKEMON', 'MAGIC', 'ONE_PIECE', 'YUGIOH', 'DIGIMON'])
    expect([quantum.contactPhone, quantum.contactEmail, quantum.contactWebsite, quantum.contactLine]).toEqual([
      '02 555 0101', 'hello@quantumcards.example', 'https://quantumcards.example', '@quantumcards',
    ])
    expect(dragon.games).toEqual(['MAGIC', 'YUGIOH', 'LORCANA'])
    expect([dragon.contactPhone, dragon.contactEmail, dragon.contactWebsite, dragon.contactLine]).toEqual([
      '02 555 0202', 'play@dragonsden.example', null, null,
    ])
    expect([mint.games, mint.contactPhone]).toEqual([[], null])
  })

  it('stores scrypt hashes that verify with the seed password', async () => {
    const mint = await prisma.user.findUniqueOrThrow({ where: { email: 'mint@player.example' } })
    expect(mint.passwordHash).toMatch(/^scrypt\$32768\$8\$1\$/)
    expect(await verifyPassword(PASSWORD, mint.passwordHash)).toBe(true)
    expect(await verifyPassword('wrong-password', mint.passwordHash)).toBe(false)
  })

  it('adds nothing when it runs a second time', async () => {
    const before = await counts()
    await seed(prisma, PASSWORD)
    expect(await counts()).toEqual(before)
  })

  it('refuses to run without a password of at least 12 characters', async () => {
    await expect(seed(prisma, '')).rejects.toThrow(/SEED_PASSWORD/)
    await expect(seed(prisma, 'short')).rejects.toThrow(/at least 12/)
  })
})
