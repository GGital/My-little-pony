// Run with DATABASE_URL set to the TEST database, after e2e-seed.ts: add 25 upcoming CASUAL / CONSTRUCTED events
// titled "PagingTest Event NN" so a search for "PagingTest" has 25 results and page 2 exists (AC-J-05, 20 a page).
// An optional argument names the venue (JRN-04 uses "Quantum Cards", so a search for "quantum" has a page 2 too).
import { PrismaClient } from '@prisma/client'

const test = process.env.DATABASE_URL_TEST
if (!test || process.env.DATABASE_URL !== test) {
  throw new Error('e2e-search-events.ts runs only with DATABASE_URL set to DATABASE_URL_TEST')
}

const prisma = new PrismaClient()
try {
  const organizer = await prisma.user.findFirstOrThrow({ where: { role: 'ORGANIZER' } })
  const day = 24 * 60 * 60 * 1000
  const hour = 60 * 60 * 1000
  await prisma.event.createMany({
    data: Array.from({ length: 25 }, (_, i) => {
      const startAt = new Date(Date.now() + 10 * day + i * hour)
      return {
        organizerId: organizer.id,
        title: `PagingTest Event ${String(i + 1).padStart(2, '0')}`,
        type: 'CASUAL' as const,
        format: 'CONSTRUCTED' as const,
        venueName: process.argv[2] ?? 'Paging Venue',
        venueAddress: 'Paging Address',
        city: 'Bangkok',
        startAt,
        endAt: new Date(startAt.getTime() + 2 * hour),
        capacity: 16,
        status: 'PUBLISHED' as const,
      }
    }),
  })
} finally {
  await prisma.$disconnect()
}
