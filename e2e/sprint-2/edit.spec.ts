import { expect, test } from '@playwright/test'
import { EMAIL, resetSeed, signIn } from '../sprint-1/helpers'

// TEST-L-01 (E2E) · AC-L-01, FR-09, UAT #64 (Sprint 2 contracts §3): Quantum Cards edits EV-1 from the dashboard; the
// new title is on the public page and the History panel records the change. The full JRN-03 comes with S2-08.
test.beforeAll(resetSeed)

test('TEST-L-01 (E2E) — dashboard → Edit EV-1, change the title: "Changes saved.", public page and History agree (AC-L-01)', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer')
  await page.getByRole('link', { name: 'Edit Friday Night Constructed' }).click()
  await expect(page).toHaveURL(/\/organizer\/events\/1\/edit$/)

  const save = page.getByRole('button', { name: 'SAVE CHANGES' })
  await expect(save).toBeDisabled()
  await page.locator('#title').fill('Friday Night Modern')
  await save.click()
  await expect(page.getByText('Changes saved.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'History' })).toContainText('Quantum Cards changed title')

  await page.goto('/events/1')
  await expect(page.getByRole('heading', { name: 'Friday Night Modern' })).toBeVisible()
})
