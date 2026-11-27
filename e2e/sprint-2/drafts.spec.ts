import { expect, test } from '@playwright/test'
import { EMAIL, resetSeed, signIn } from '../sprint-1/helpers'

// TEST-K-03 (E2E) · AC-K-03, FR-08 (Sprint 2 contracts §2): Quantum Cards publishes the seeded draft EV-7
// ("Prerelease Planning Night") from the dashboard; it then appears on /events for everyone.
test.beforeAll(resetSeed)

test('TEST-K-03 (E2E) — dashboard → Publish on EV-7: "Your event is live." and EV-7 is on /events (AC-K-03)', async ({ page }) => {
  await page.goto('/events')
  await expect(page.locator('.event-card__title').first()).toBeVisible()
  await expect(page.getByText('Prerelease Planning Night')).toHaveCount(0)

  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer')
  const draft = page.locator('.event-card', { hasText: 'Prerelease Planning Night' })
  await expect(draft.getByText('Draft', { exact: true })).toBeVisible()
  await draft.getByRole('button', { name: 'Publish Prerelease Planning Night' }).click()

  await expect(page.getByText('Your event is live.')).toBeVisible()
  await expect(draft.getByText('Published', { exact: true })).toBeVisible()

  await page.goto('/events')
  await expect(page.locator('.event-card__title', { hasText: 'Prerelease Planning Night' })).toBeVisible()
})
