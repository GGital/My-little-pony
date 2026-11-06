import { expect, test } from '@playwright/test'
import { EMAIL, EV, bangkokLocal, resetSeed, signIn } from './helpers'

// Feature-D, E and I (contracts §7, §8, §12) as Quantum Cards on the seeded app.
test.beforeAll(resetSeed)
test.beforeEach(async ({ page }) => signIn(page, EMAIL.quantum))

test('TEST-E-01 (E2E) — /organizer lists exactly Quantum Cards\' events in start order (AC-E-01)', async ({ page }) => {
  await page.goto('/organizer')
  await expect(page.locator('.event-card .event-card__title')).toHaveText([
    'Friday Night Constructed',
    'Last Seat Sealed',
    'Release Weekend Sealed · เปิดกล่องสุดสัปดาห์',
  ])
  await expect(page.getByText('Store Championship Qualifier')).toHaveCount(0)
})

test('TEST-I-01 (E2E) — EV-1 lists Mint, Ploy, Boss; EV-6 says "No registrations yet." (AC-I-01)', async ({ page }) => {
  await page.goto('/organizer')
  await page.getByRole('link', { name: 'Registrations for Friday Night Constructed' }).click()
  await expect(page).toHaveURL(`/organizer/events/${EV[1]}/registrations`)
  await expect(page.getByText('3 / 24 · 21 seats left')).toBeVisible()
  const rows = page.getByRole('table').getByRole('row')
  await expect(rows).toHaveCount(4)
  for (const [i, name] of ['Mint', 'Ploy', 'Boss'].entries()) {
    await expect(rows.nth(i + 1).getByRole('cell').nth(1)).toHaveText(name)
    await expect(rows.nth(i + 1).getByRole('cell').nth(3)).toHaveText('REGISTERED')
  }

  await page.goto(`/organizer/events/${EV[6]}/registrations`)
  await expect(page.getByRole('heading', { name: 'No registrations yet.' })).toBeVisible()
})

test('TEST-D-01 (E2E) — fill the form and publish: the detail page says "Your event is live." (AC-D-01)', async ({ page }) => {
  await page.goto('/organizer/events/new')
  await page.locator('#title').fill('Sunday Sealed League')
  await page.getByText('SEALED', { exact: true }).click()
  await page.locator('#venueName').fill('Quantum Cards')
  await page.locator('#venueAddress').fill('1631 Kanchanaphisek Rd')
  await page.locator('#city').fill('Bangkok')
  await page.locator('#startAt').fill(bangkokLocal(9, 13))
  await page.locator('#endAt').fill(bangkokLocal(9, 18))
  await page.locator('#capacity').fill('24')
  await page.getByRole('button', { name: 'PUBLISH EVENT' }).click()

  await expect(page).toHaveURL(/\/events\/\d+$/)
  await expect(page.getByText('Your event is live.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sunday Sealed League' })).toBeVisible()

  await page.goto('/events')
  const card = page.locator('a.event-card', { hasText: 'Sunday Sealed League' })
  await expect(card).toContainText('0 / 24')
  await expect(card).toContainText('24 seats left')
})
