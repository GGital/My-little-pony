import { expect, test } from '@playwright/test'
import { EMAIL, EV, bangkokLocal, resetSeed, signIn, signOut } from './helpers'

// The two Sprint 1 journeys (STS §2.12), each from a fresh seed.
test.beforeEach(resetSeed)

test('JRN-01 — publish → register → My Events → registration list (FR-06, FR-15, FR-17, FR-18)', async ({ page }) => {
  const title = 'Journey Commander Night'

  // Quantum Cards publishes an event.
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer/events/new')
  await page.locator('#title').fill(title)
  await page.locator('#venueName').fill('Quantum Cards')
  await page.locator('#venueAddress').fill('1631 Kanchanaphisek Rd')
  await page.locator('#city').fill('Bangkok')
  await page.locator('#startAt').fill(bangkokLocal(6, 18))
  await page.locator('#endAt').fill(bangkokLocal(6, 22))
  await page.locator('#capacity').fill('12')
  await page.getByRole('button', { name: 'PUBLISH EVENT' }).click()
  await expect(page.getByText('Your event is live.')).toBeVisible()
  const eventPath = new URL(page.url()).pathname
  await signOut(page)

  // Nok finds it, registers, and sees it in My Events.
  await signIn(page, EMAIL.nok)
  await page.goto('/events')
  await page.locator('a.event-card', { hasText: title }).click()
  await expect(page).toHaveURL(eventPath)
  await page.getByRole('button', { name: 'REGISTER', exact: true }).click()
  await expect(page.getByRole('heading', { name: "You're in." })).toBeVisible()
  // The ticket face and the note under the button both link there; use the ticket's.
  await page.locator('.seat-card__link').click()
  await expect(page.locator('a.event-card', { hasText: title })).toContainText('REGISTERED')
  await signOut(page)

  // Quantum Cards opens the registration list: Nok is there, REGISTERED.
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer')
  await page.getByRole('link', { name: `Registrations for ${title}` }).click()
  const row = page.getByRole('row', { name: /Nok/ })
  await expect(row.getByRole('cell').nth(1)).toHaveText('Nok')
  await expect(row.getByRole('cell').nth(3)).toHaveText('REGISTERED')
})

test('JRN-02 — Nok and Fern press REGISTER on the last seat of EV-2 together (BR-05, BR-07)', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  const pages = await Promise.all(contexts.map((c) => c.newPage()))
  await signIn(pages[0]!, EMAIL.nok)
  await signIn(pages[1]!, EMAIL.fern)
  for (const p of pages) {
    await p.goto(`/events/${EV[2]}`)
    await expect(p.getByRole('button', { name: 'REGISTER', exact: true })).toBeEnabled()
  }

  await Promise.all(pages.map((p) => p.getByRole('button', { name: 'REGISTER', exact: true }).click()))

  const outcome = async (p: (typeof pages)[number]) => {
    const won = p.getByRole('heading', { name: "You're in." })
    const lost = p.getByRole('alert').filter({ hasText: 'This event filled up a moment ago, so no registration was made.' })
    await expect(won.or(lost)).toBeVisible()
    return (await won.count()) > 0 ? 'won' : 'lost'
  }
  expect((await Promise.all(pages.map(outcome))).sort()).toEqual(['lost', 'won'])

  const visitor = await browser.newPage()
  await visitor.goto('/events')
  await expect(visitor.locator('a.event-card', { hasText: 'Last Seat Sealed' }).locator('.chip--full')).toHaveText('FULL 4 / 4')
  await Promise.all([...contexts.map((c) => c.close()), visitor.close()])
})
