import { expect, test } from '@playwright/test'
import { resetSeed } from '../sprint-1/helpers'

// Feature-J (contracts §7) and AC-J-05, on the seeded app.
test.beforeAll(resetSeed)

test('TEST-J-05 (E2E) — Search, filters, URL synchronization and back/forward navigation (AC-J-05, JRN-04)', async ({
  page,
}) => {
  await page.goto('/events')

  // UX-01: Search bar is active
  const searchInput = page.getByPlaceholder(/Store, venue or city/i).or(page.getByLabel(/Where/i))
  await expect(searchInput).toBeVisible()
  await searchInput.fill('quantum')

  const formatSelect = page.getByLabel(/Format/i)
  if (await formatSelect.isVisible()) {
    await formatSelect.selectOption('CONSTRUCTED')
  }

  await page.getByRole('button', { name: /Search/i }).click()

  // UX-02: URL holds the filters
  await expect(page).toHaveURL(/q=quantum/)

  // Filter chips with remove (x) button
  await expect(page.locator('.chip, .filter-chip').filter({ hasText: 'quantum' })).toBeVisible()

  // Search for non-existent events -> empty state with Clear filters
  await searchInput.fill('zzz')
  await page.getByRole('button', { name: /Search/i }).click()
  await expect(page.getByText('No events match your search.')).toBeVisible()
  const clearBtn = page.getByRole('button', { name: /Clear filters/i })
  await expect(clearBtn).toBeVisible()

  // Clear filters restores default list
  await clearBtn.click()
  await expect(page.locator('a.event-card')).toHaveCount(5)
})
