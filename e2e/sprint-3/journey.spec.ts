import { expect, test } from '@playwright/test'
import { EMAIL, EV, resetSeed, signIn, signOut } from '../sprint-1/helpers'

// TEST-P-01 (E2E) · AC-P-01, AC-P-03, FR-21, FR-22 (Sprint 3 contracts §1). EV-4 ("Live Now Casual", Dragon's Den,
// started an hour before the seed, Mint registered) is in its check-in window right after seeding (§0.3). The owner
// checks Mint in, undoes it, checks her in again; a reload and E-08 show the check-in was stored. JRN-05 (with the
// report and History) joins this file in S3-09.
test.beforeAll(resetSeed)

test('TEST-P-01 (E2E) — Dragon\'s Den checks Mint in at the door on EV-4, undoes it, and checks her in again', async ({ page }) => {
  await signIn(page, EMAIL.dragon)
  await page.goto(`/organizer/events/${EV[4]}/registrations`)
  await expect(page.getByText('Door check-in')).toBeVisible()
  await expect(page.getByText('Checked in 0 / 1')).toBeVisible()

  const mint = page.getByRole('row', { name: /Mint/ })
  await mint.getByRole('button', { name: 'Check in Mint' }).click()
  await expect(mint.getByText(/^Checked in \d\d:\d\d$/)).toBeVisible()
  await expect(page.getByText('Checked in 1 / 1')).toBeVisible()
  await expect(page.getByRole('status', { name: 'Check-in updates' })).toHaveText('Mint checked in.')

  await mint.getByRole('button', { name: 'Undo check-in for Mint' }).click()
  await expect(mint.getByRole('button', { name: 'Check in Mint' })).toBeVisible()
  await expect(page.getByText('Checked in 0 / 1')).toBeVisible()

  await mint.getByRole('button', { name: 'Check in Mint' }).click()
  await expect(page.getByText('Checked in 1 / 1')).toBeVisible()

  // Stored, not just drawn: a reload and the API agree.
  await page.reload()
  await expect(page.getByRole('row', { name: /Mint/ }).getByText(/^Checked in \d\d:\d\d$/)).toBeVisible()
  const list = await page.request.get(`/api/organizer/events/${EV[4]}/registrations`)
  expect(list.status()).toBe(200)
  const body = await list.json()
  expect(body.counts).toEqual({ active: 1, checkedIn: 1 })
  expect(body.items[0]).toMatchObject({ status: 'CHECKED_IN', checkedInBy: { displayName: "Dragon's Den" } })
  await signOut(page)
})
