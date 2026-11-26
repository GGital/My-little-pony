import { expect, test } from '@playwright/test'
import { EMAIL, EV, resetSeed, signIn } from '../sprint-1/helpers'

// TEST-M-03 (E2E) · AC-M-03, BR-08 (Sprint 2 contracts §4): EV-9 "Early Deadline Sealed" has a deadline that passed
// an hour before the seed, so Nok sees when it closed and a disabled REGISTRATION CLOSED, though the event is upcoming.
const EV9 = 9 // e2e-seed restarts ids, and EV-9 is the ninth seed event
test.beforeAll(resetSeed)

test('TEST-M-03 (E2E) — EV-9 as Nok: "Registration closes …" and a disabled REGISTRATION CLOSED (AC-M-03)', async ({ page }) => {
  expect(EV[1]).toBe(1)
  await signIn(page, EMAIL.nok)
  await page.goto(`/events/${EV9}`)
  await expect(page.getByRole('heading', { name: 'Early Deadline Sealed' })).toBeVisible()
  await expect(page.getByText(/^Registration closes \w{3} \d{1,2} \w{3} · \d{2}:\d{2}$/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'REGISTRATION CLOSED' })).toBeDisabled()
})
