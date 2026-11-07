import { expect, test } from '@playwright/test'
import { EMAIL, EV, resetSeed, signIn } from './helpers'

// Feature-F (contracts §9) and AC-C-06, on the seeded app.
test.beforeAll(resetSeed)

test('TEST-F-01 (E2E) — /events lists EV-1, 2, 3, 5, 6 in start order; EV-3 shows FULL 2 / 2 (AC-F-01)', async ({ page }) => {
  await page.goto('/events')
  const cards = page.locator('a.event-card')
  await expect(cards).toHaveCount(5)
  await expect(cards.locator('.event-card__title')).toHaveText([
    'Friday Night Constructed',
    'Last Seat Sealed',
    'Store Championship Qualifier',
    'Dragon Draft Night',
    'Release Weekend Sealed · เปิดกล่องสุดสัปดาห์',
  ])
  await expect(cards.nth(2).locator('.chip--full')).toHaveText('FULL 2 / 2')
  await expect(page.getByText('Live Now Casual')).toHaveCount(0)
})

test('TEST-F-03 (E2E) — /events/999999 shows the not-found page (AC-F-03)', async ({ page }) => {
  await page.goto('/events/999999')
  await expect(page.getByRole('heading', { name: "We couldn't find that page" })).toBeVisible()
})

test('TEST-F-04 (E2E) — the started EV-4 shows a disabled REGISTRATION CLOSED (AC-F-04)', async ({ page }) => {
  await signIn(page, EMAIL.nok)
  await page.goto(`/events/${EV[4]}`)
  await expect(page.getByRole('heading', { name: 'Live Now Casual' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'REGISTRATION CLOSED' })).toBeDisabled()
})

test('TEST-C-06 (E2E) — a description with <script> and <b> is shown as text and never runs (AC-C-06)', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.dismiss()
  })
  await signIn(page, EMAIL.quantum)
  const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
  const res = await page.request.post('/api/events', {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      title: 'Script Check Night',
      type: 'CASUAL',
      format: 'CONSTRUCTED',
      venueName: 'Quantum Cards',
      venueAddress: '1 Test Road',
      city: 'Bangkok',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      capacity: 8,
      description: '<script>alert(1)</script><b>bold</b>',
    },
  })
  expect(res.status()).toBe(201)
  const { id } = (await res.json()) as { id: number }

  await page.goto(`/events/${id}`)
  await expect(page.getByText('<script>alert(1)</script><b>bold</b>')).toBeVisible()
  await expect(page.locator('.description b')).toHaveCount(0)
  expect(dialogs).toEqual([])
})
