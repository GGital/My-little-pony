import { expect, test } from '@playwright/test'
import { EMAIL, resetSeed, signIn, signOut } from '../sprint-1/helpers'

// TEST-O-02 (E2E) · AC-O-02, FR-10, BR-04 (Sprint 2 contracts §6): Quantum Cards cancels EV-1 "Friday Night
// Constructed" with a reason; Boss (registered) then sees the red banner and "Event cancelled". The seeded EV-8
// "Rainy Day Casual" (cancelled by Dragon's Den, Boss registered) shows the same to Boss from the start.
test.beforeAll(resetSeed)

const boss = 'boss@player.example'
const REASON = 'Store closed for renovation.'

test('TEST-O-02 (E2E) — Boss sees the seeded cancelled EV-8: red banner with the reason, REGISTRATION CLOSED, "Event cancelled" in My Events', async ({ page }) => {
  await signIn(page, boss)
  await page.goto('/events/8')
  await expect(page.getByRole('heading', { name: 'Rainy Day Casual' })).toBeVisible()
  await expect(page.getByText('Cancelled by the organizer: Store closed for flooding repairs.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'REGISTRATION CLOSED' })).toBeDisabled()

  await page.goto('/me/registrations')
  const card = page.locator('.event-card', { hasText: 'Rainy Day Casual' })
  await expect(card.getByText('Event cancelled')).toBeVisible()
  await signOut(page)
})

test('TEST-O-02 (E2E) — the owner cancels EV-1 from its page; the dashboard, /events and Boss all agree (UX-12, UX-13)', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/events/1')
  await page.getByRole('button', { name: 'Cancel event' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/All 3 registered players will see the event as cancelled\./)).toBeVisible()
  const confirm = dialog.getByRole('button', { name: 'CANCEL EVENT' })
  await dialog.getByLabel('Reason').fill('abcd')
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel('Reason').fill(REASON)
  await expect(dialog.getByText(`${REASON.length} / 200`)).toBeVisible()
  await confirm.click()

  await expect(page.getByText(`Cancelled by the organizer: ${REASON}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'REGISTRATION CLOSED' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Cancel event' })).toHaveCount(0)

  await page.goto('/organizer')
  const row = page.locator('.event-card', { hasText: 'Friday Night Constructed' })
  await expect(row.getByText('Cancelled', { exact: true })).toBeVisible()

  await page.goto('/events')
  await expect(page.locator('.event-card__title', { hasText: 'Friday Night Constructed' })).toHaveCount(0)
  await signOut(page)

  await signIn(page, boss)
  await page.goto('/me/registrations')
  const mine = page.locator('.event-card', { hasText: 'Friday Night Constructed' })
  await expect(mine.getByText('Event cancelled')).toBeVisible()
  await page.goto('/events/1')
  await expect(page.getByText(`Cancelled by the organizer: ${REASON}`)).toBeVisible()
})
