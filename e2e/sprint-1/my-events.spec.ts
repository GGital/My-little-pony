import { expect, test } from '@playwright/test'
import { EMAIL, resetSeed, signIn } from './helpers'

// Feature-H (contracts §11): the E2E half of TEST-H-01, moved here from I-10 (contracts v1.8).
test.beforeAll(resetSeed)

// Sprint 2 (S2-01) registers Mint for EV-9 in the seed, so Mint has four cards (Sprint 2 contracts §0.4).
test('TEST-H-01 (E2E) — Mint sees four cards, soonest first, that open their events (AC-H-01)', async ({ page }) => {
  await signIn(page, EMAIL.mint)
  await page.goto('/me/registrations')
  const cards = page.locator('a.event-card')
  await expect(cards.locator('.event-card__title')).toHaveText([
    'Live Now Casual',
    'Friday Night Constructed',
    'Early Deadline Sealed',
    'Last Seat Sealed',
  ])

  await cards.nth(1).click()
  await expect(page).toHaveURL(/\/events\/\d+$/)
  await expect(page.getByRole('heading', { name: 'Friday Night Constructed' })).toBeVisible()
})

test('TEST-H-01 (E2E) — Nok sees the empty state with Find an Event (AC-H-01)', async ({ page }) => {
  await signIn(page, EMAIL.nok)
  await page.goto('/me/registrations')
  const empty = page.getByTestId('empty-state')
  await expect(empty.getByRole('heading', { name: "You haven't registered for any events yet" })).toBeVisible()
  await empty.getByRole('link', { name: 'Find an Event' }).click()
  await expect(page).toHaveURL('/events')
})
