import { expect, test } from '@playwright/test'
import { EMAIL, resetSeed, signIn, signOut } from './helpers'

// Feature-A (contracts §4): the E2E half of TEST-A-04, moved here from I-04 (contracts v1.3).
test.beforeAll(resetSeed)

test('TEST-A-04 (E2E) — after signing out, Back shows no registration data and asks to sign in (AC-A-04)', async ({ page }) => {
  await signIn(page, EMAIL.mint)
  await page.goto('/me/registrations')
  await expect(page.getByRole('link', { name: /Friday Night Constructed/ })).toBeVisible()

  // Signing out on a guarded page lands on /events (TEST-C-04); Back returns to /me/registrations.
  await signOut(page)
  await expect(page).toHaveURL('/events')
  await page.goBack()

  await expect(page).toHaveURL('/login?returnTo=%2Fme%2Fregistrations')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByText('Friday Night Constructed')).toHaveCount(0)
})
