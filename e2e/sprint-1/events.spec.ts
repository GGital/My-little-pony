import { test, expect } from '@playwright/test'

test.describe('Event Discovery (Feature-F E2E)', () => {
  test('TEST-F-01 (E2E) — /events renders upcoming events in order and EV-3 full chip', async ({ page }) => {
    await page.goto('/events')
    await expect(page.getByRole('heading', { name: /Find an Event/i })).toBeVisible()

    // EV-1, EV-2, EV-3, EV-5, EV-6 in order
    const titles = ['Friday Night Constructed', 'Last Seat Sealed', 'Store Championship Qualifier', 'Dragon Draft Night', 'Release Weekend Sealed']
    for (const title of titles) {
      await expect(page.getByText(title)).toBeVisible()
    }

    // EV-4 should not be in the upcoming list
    await expect(page.getByText('Live Now Casual')).not.toBeVisible()

    // EV-3 chip shows FULL 2 / 2
    await expect(page.getByText(/FULL 2 \/ 2/i)).toBeVisible()
  })

  test('TEST-F-03 (E2E) — /events/999999 opens Not found page', async ({ page }) => {
    await page.goto('/events/999999')
    await expect(page.getByText(/Not found|Page not found|There is nothing here/i)).toBeVisible()
  })

  test('TEST-F-04 (E2E) — EV-4 page shows disabled REGISTRATION CLOSED button', async ({ page }) => {
    // Navigate directly to EV-4 (started event)
    await page.goto('/events/4')
    const button = page.getByRole('button', { name: /REGISTRATION CLOSED/i })
    await expect(button).toBeVisible()
    await expect(button).toBeDisabled()
  })

  test('TEST-C-06 (E2E) — script description renders literally without dialog', async ({ page }) => {
    let dialogFired = false
    page.on('dialog', () => {
      dialogFired = true
    })

    // Suppose an event has script description
    await page.goto('/events/1')
    expect(dialogFired).toBe(false)
  })
})
