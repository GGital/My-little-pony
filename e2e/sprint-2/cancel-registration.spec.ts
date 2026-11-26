import { expect, test } from '@playwright/test'
import { EMAIL, resetSeed, signIn, signOut } from '../sprint-1/helpers'

// TEST-N-01 (E2E) · AC-N-01, AC-N-02, JRN-03 (Sprint 2 contracts §5): a player registers, cancels the seat in My
// Events (confirmation dialog, Cancelled chip, toast), and registers again; the event page goes back to REGISTER
// and then REGISTERED.
test.beforeAll(resetSeed)

test('TEST-N-01 (E2E) — Fern registers, cancels in My Events, then registers again', async ({ page }) => {
  await signIn(page, EMAIL.fern)
  await page.goto('/events/1')
  await page.getByRole('button', { name: 'REGISTER', exact: true }).click()
  await expect(page.getByRole('button', { name: /REGISTERED/ })).toBeVisible()

  await page.goto('/me/registrations')
  const card = page.locator('.registration-row', { hasText: 'Friday Night Constructed' })
  await card.getByRole('button', { name: 'Cancel registration' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/Cancel your seat at Friday Night Constructed\? You can register again while seats are left\./)).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel registration' }).click()

  await expect(page.getByText('Your registration is cancelled.')).toBeVisible()
  await expect(card.getByText(/Cancelled/)).toBeVisible()

  await page.goto('/events/1')
  await expect(page.getByRole('button', { name: 'REGISTER', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'REGISTER', exact: true }).click()
  await expect(page.getByRole('button', { name: /REGISTERED/ })).toBeVisible()
  await signOut(page)
})
