import { expect, test } from '@playwright/test'
import { EMAIL, EV, resetSeed, signIn } from './helpers'

// Feature-G (contracts §10): the E2E halves of TEST-G-01 and TEST-G-02, moved here from I-08 (contracts v1.6).
test.beforeEach(resetSeed)

test('TEST-G-01 (E2E) — Nok registers for EV-1: "You\'re in.", REGISTERED, live-region text (AC-G-01)', async ({ page }) => {
  await signIn(page, EMAIL.nok)
  await page.goto(`/events/${EV[1]}`)
  await page.getByRole('button', { name: 'REGISTER', exact: true }).click()

  await expect(page.getByRole('heading', { name: "You're in." })).toBeFocused()
  await expect(page.getByRole('button', { name: 'REGISTERED' })).toBeDisabled()
  await expect(page.getByText('4 / 24 taken · 20 left')).toBeVisible()
  await expect(page.locator('[aria-live="polite"]')).not.toBeEmpty()
})

// EV-3 is already full, so its button reads FULL and cannot be pressed. The 409 path needs a seat that goes while the
// page is open: Nok opens EV-2 (one seat left), Fern takes the seat in her own session, then Nok presses REGISTER.
test('TEST-G-02 (E2E) — the last seat goes while the page is open: red alert, no flip, FULL 4 / 4 (AC-G-02)', async ({ page, browser }) => {
  await signIn(page, EMAIL.nok)
  await page.goto(`/events/${EV[2]}`)
  await expect(page.getByRole('button', { name: 'REGISTER', exact: true })).toBeEnabled()

  const fern = await browser.newContext()
  const fernPage = await fern.newPage()
  await signIn(fernPage, EMAIL.fern)
  await fernPage.goto(`/events/${EV[2]}`)
  await fernPage.getByRole('button', { name: 'REGISTER', exact: true }).click()
  await expect(fernPage.getByRole('heading', { name: "You're in." })).toBeVisible()
  await fern.close()

  await page.getByRole('button', { name: 'REGISTER', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('This event filled up a moment ago, so no registration was made.')
  await expect(page.getByRole('heading', { name: "You're in." })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'FULL' })).toBeDisabled()
  await expect(page.getByText('4 / 4').first()).toBeVisible()
})
