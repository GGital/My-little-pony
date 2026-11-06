import { expect, test } from '@playwright/test'
import { EMAIL, EV, resetSeed, signIn, signOut, submitSignIn } from './helpers'

// Feature-C (contracts §6): route guards and the safe return after sign-in, in a real browser.
test.beforeAll(resetSeed)

test.describe('TEST-C-02 (E2E) — guarded routes (AC-C-02, FR-05)', () => {
  test('signed out, /me/registrations goes to the sign-in page with returnTo', async ({ page }) => {
    await page.goto('/me/registrations')
    await expect(page).toHaveURL('/login?returnTo=%2Fme%2Fregistrations')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('as Mint, /organizer shows "not available" and calls no organizer endpoint', async ({ page }) => {
    const organizerCalls: string[] = []
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/organizer')) organizerCalls.push(r.url())
    })
    await signIn(page, EMAIL.mint)
    await page.goto('/organizer')
    await expect(page.getByRole('heading', { name: "This page isn't available for your account" })).toBeVisible()
    expect(organizerCalls).toEqual([])
  })
})

test.describe('TEST-C-03 — back to the event after signing in; unsafe returnTo ignored (AC-C-03, FR-26)', () => {
  test('SIGN IN TO REGISTER on EV-1, sign in as Nok: back on EV-1 with REGISTER', async ({ page }) => {
    await page.goto(`/events/${EV[1]}`)
    await page.getByRole('link', { name: 'SIGN IN TO REGISTER' }).click()
    await expect(page).toHaveURL(`/login?returnTo=%2Fevents%2F${EV[1]}`)

    await submitSignIn(page, EMAIL.nok)
    await expect(page).toHaveURL(`/events/${EV[1]}`)
    await expect(page.getByRole('button', { name: 'REGISTER', exact: true })).toBeEnabled()
  })

  for (const unsafe of ['https://evil.example', '//evil.example']) {
    test(`returnTo=${unsafe} lands on /events`, async ({ page }) => {
      await page.goto(`/login?returnTo=${encodeURIComponent(unsafe)}`)
      await submitSignIn(page, EMAIL.nok)
      await expect(page).toHaveURL('/events')
      await expect(page.getByRole('heading', { name: 'Find an Event' })).toBeVisible()
      await signOut(page)
    })
  }
})
