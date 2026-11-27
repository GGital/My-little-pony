import { spawnSync } from 'node:child_process'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { EMAIL, bangkokLocal, resetSeed, signIn, submitSignIn } from '../sprint-1/helpers'

// The two Sprint 2 journeys (contracts §9, STS §2.10), each from a fresh seed. JRN-01 and JRN-02 stay in
// e2e/sprint-1/journey.spec.ts, unchanged.
test.beforeEach(resetSeed)

async function signedIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  await signIn(page, email)
  return page
}

test('JRN-03 — draft → hidden → publish → register → capacity and deadline → cancel → register again → event cancelled (K, L, M, N, O, SR-08)', async ({ browser }) => {
  const title = 'Journey Three Sealed'
  const reason = 'Venue flooded, sorry everyone.'
  const quantum = await signedIn(browser, EMAIL.quantum)
  const nok = await signedIn(browser, EMAIL.nok)

  // K: Quantum Cards saves a draft and lands on its edit page.
  await quantum.goto('/organizer/events/new')
  await quantum.locator('#title').fill(title)
  await quantum.locator('#venueName').fill('Quantum Cards')
  await quantum.locator('#venueAddress').fill('1631 Kanchanaphisek Rd')
  await quantum.locator('#city').fill('Bangkok')
  await quantum.locator('#startAt').fill(bangkokLocal(6, 18))
  await quantum.locator('#endAt').fill(bangkokLocal(6, 22))
  await quantum.locator('#capacity').fill('12')
  await quantum.getByLabel(/^Game/).selectOption('MAGIC')
  await quantum.getByRole('button', { name: 'SAVE DRAFT' }).click()
  await expect(quantum).toHaveURL(/\/organizer\/events\/\d+\/edit$/)
  await expect(quantum.getByText('Draft saved. Only you can see it.')).toBeVisible()
  const id = Number(new URL(quantum.url()).pathname.split('/')[3])
  const editPath = `/organizer/events/${id}/edit`

  // K: Nok cannot find the draft, by search or by its URL.
  await nok.goto(`/events?q=${encodeURIComponent(title)}`)
  await expect(nok.getByText('No events match your search.')).toBeVisible()
  await nok.goto(`/events/${id}`)
  await expect(nok.getByText('The page you requested could not be found.')).toBeVisible()
  expect((await nok.request.get(`/api/events/${id}`)).status()).toBe(404)

  // K: Quantum Cards publishes it from the edit page.
  await quantum.getByRole('button', { name: 'PUBLISH EVENT' }).click()
  await expect(quantum.getByText('Your event is live.')).toBeVisible()

  // Nok registers.
  await nok.goto(`/events?q=${encodeURIComponent(title)}`)
  await nok.locator('a.event-card', { hasText: title }).click()
  await expect(nok).toHaveURL(`/events/${id}`)
  await nok.getByRole('button', { name: 'REGISTER', exact: true }).click()
  await expect(nok.getByRole('heading', { name: "You're in." })).toBeVisible()

  // L + M: Quantum Cards raises the capacity and sets a deadline the day before, in one save.
  await quantum.goto(editPath)
  await quantum.locator('#capacity').fill('20')
  await quantum.locator('#registrationDeadline').fill(bangkokLocal(5, 18))
  await quantum.getByRole('button', { name: 'SAVE CHANGES' }).click()
  await expect(quantum.getByText('Changes saved.')).toBeVisible()
  const history = quantum.getByRole('region', { name: 'History' })
  await expect(history).toContainText('Quantum Cards changed capacity from 12 to 20')
  await expect(history).toContainText('Quantum Cards changed the registration deadline')
  await expect(history).toContainText('Quantum Cards published the draft')
  await expect(history).toContainText('Quantum Cards saved the draft')

  // Nok sees the new capacity and deadline.
  await nok.goto(`/events/${id}`)
  await expect(nok.getByText(/^Registration closes \w{3} \d{1,2} \w{3} · 18:00$/)).toBeVisible()
  await expect(nok.locator('.seat-card')).toContainText('1 / 20')

  // N: Nok cancels in My Events, then registers again.
  await nok.goto('/me/registrations')
  const row = nok.locator('.registration-row', { hasText: title })
  await row.getByRole('button', { name: 'Cancel registration' }).click()
  await nok.getByRole('dialog').getByRole('button', { name: 'Cancel registration' }).click()
  await expect(nok.getByText('Your registration is cancelled.')).toBeVisible()
  await expect(row.getByText(/Cancelled/)).toBeVisible()
  await nok.goto(`/events/${id}`)
  await nok.getByRole('button', { name: 'REGISTER', exact: true }).click()
  await expect(nok.getByRole('button', { name: /REGISTERED/ })).toBeVisible()

  // O: Quantum Cards cancels the event with a reason.
  await quantum.goto(`/events/${id}`)
  await quantum.getByRole('button', { name: 'Cancel event' }).click()
  const dialog = quantum.getByRole('dialog')
  await dialog.getByLabel('Reason').fill(reason)
  await dialog.getByRole('button', { name: 'CANCEL EVENT' }).click()
  await expect(quantum.getByText(`Cancelled by the organizer: ${reason}`)).toBeVisible()

  // O: Nok sees Event cancelled with the reason, and cannot register.
  await nok.goto('/me/registrations')
  await expect(nok.locator('.event-card', { hasText: title }).getByText('Event cancelled')).toBeVisible()
  await nok.goto(`/events/${id}`)
  await expect(nok.getByText(`Cancelled by the organizer: ${reason}`)).toBeVisible()
  await expect(nok.getByRole('button', { name: 'REGISTRATION CLOSED' })).toBeDisabled()

  // SR-08: E-17 holds every step, newest first, by display name only.
  const res = await quantum.request.get(`/api/organizer/events/${id}/changes`)
  expect(res.status()).toBe(200)
  const items = ((await res.json()) as { items: { field: string; oldValue: string | null; newValue: string; changedBy: object }[] }).items
  const fields = items.map((c) => `${c.field}:${c.oldValue}→${c.newValue}`)
  expect(fields[0]).toBe('status:PUBLISHED→CANCELLED')
  expect(fields).toContain('capacity:12→20')
  expect(fields.some((f) => f.startsWith('deadline:'))).toBe(true)
  expect(fields).toContain('status:DRAFT→PUBLISHED')
  expect(fields.at(-1)).toBe('status:null→DRAFT')
  expect(items.every((c) => Object.keys(c.changedBy).join() === 'displayName')).toBe(true)
  await Promise.all([quantum.context().close(), nok.context().close()])
})

test('JRN-04 — a visitor searches "quantum", filters Constructed, pages, opens a result, signs in from SIGN IN TO REGISTER and registers (J, FR-26)', async ({ page }) => {
  // 25 more Constructed events at Quantum Cards, so the search has a page 2.
  const extra = spawnSync('npx', ['tsx', 'scripts/e2e-search-events.ts', 'Quantum Cards'], {
    cwd: 'server',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    encoding: 'utf8',
  })
  if (extra.status !== 0) throw new Error(`e2e-search-events.ts failed:\n${extra.stderr}`)

  await page.goto('/events')
  await page.getByLabel('Where').fill('quantum')
  await page.getByLabel('Format').selectOption('CONSTRUCTED')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/q=quantum/)
  await expect(page).toHaveURL(/format=CONSTRUCTED/)
  await expect(page.getByText('1–20 of 26')).toBeVisible()

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText('21–26 of 26')).toBeVisible()
  const card = page.locator('a.event-card').first()
  const title = (await card.locator('.event-card__title').textContent())!.trim()
  await card.click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const eventPath = new URL(page.url()).pathname

  await page.getByRole('link', { name: 'SIGN IN TO REGISTER' }).click()
  await expect(page).toHaveURL(`/login?returnTo=${encodeURIComponent(eventPath)}`)
  await submitSignIn(page, EMAIL.nok)
  await expect(page).toHaveURL(eventPath)
  await page.getByRole('button', { name: 'REGISTER', exact: true }).click()
  await expect(page.getByRole('heading', { name: "You're in." })).toBeVisible()
})
