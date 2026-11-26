import { spawnSync } from 'node:child_process'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { resetSeed } from '../sprint-1/helpers'

// Feature-J (contracts §7) and AC-J-05, on the seeded app plus 25 "PagingTest" events so page 2 exists.
test.beforeAll(() => {
  resetSeed()
  const result = spawnSync('npx', ['tsx', 'scripts/e2e-search-events.ts'], {
    cwd: 'server',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(`e2e-search-events.ts failed:\n${result.stderr}`)
})

test('TEST-J-05 (E2E) — Search, filters, URL synchronization and back/forward navigation (AC-J-05, JRN-04)', async ({
  page,
}) => {
  const cards = page.locator('a.event-card')
  const titlesOnPage = async () => (await page.locator('.event-card__title').allTextContents()).map((t) => t.trim())
  const titlesFromApi = async (query: string) => {
    const res = await page.request.get(`/api/events?${query}`)
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { items: { title: string }[] }
    return body.items.map((i) => i.title)
  }

  await page.goto('/events')
  await expect(cards).toHaveCount(20)
  const defaultTitles = await titlesOnPage()

  // UX-01: the bar is active. Type quantum, choose Constructed, press Search.
  await expect(page.getByLabel('Where')).toBeVisible()
  await page.getByLabel('Where').fill('quantum')
  await page.getByLabel('Format').selectOption('CONSTRUCTED')
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  // UX-02: the URL holds both filters, and the list is what E-04 returns for them.
  await expect(page).toHaveURL(/q=quantum/)
  await expect(page).toHaveURL(/format=CONSTRUCTED/)
  const quantumTitles = await titlesFromApi('q=quantum&format=CONSTRUCTED&page=1')
  expect(quantumTitles.length).toBeGreaterThan(0)
  await expect(cards).toHaveCount(quantumTitles.length)
  expect(await titlesOnPage()).toEqual(quantumTitles)
  await expect(page.getByRole('button', { name: 'Remove filter Matching: quantum' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove filter Format: Constructed' })).toBeVisible()

  // Back returns to the unfiltered list, Forward restores the search.
  await page.goBack()
  await expect(page).not.toHaveURL(/q=quantum/)
  await expect(page.getByLabel('Where')).toHaveValue('')
  await expect(cards).toHaveCount(defaultTitles.length)
  await page.goForward()
  await expect(page).toHaveURL(/q=quantum/)
  await expect(page.getByLabel('Where')).toHaveValue('quantum')
  await expect(cards).toHaveCount(quantumTitles.length)
  expect(await titlesOnPage()).toEqual(quantumTitles)

  // A long list: 25 PagingTest events, 20 on page 1 and 5 on page 2.
  await page.getByRole('button', { name: 'Clear all' }).click()
  // Wait until the cleared URL has reached the form, or it would reset the text typed next.
  await expect(page.getByRole('button', { name: /Remove filter/ })).toHaveCount(0)
  await expect(page.getByLabel('Where')).toHaveValue('')
  await expect(cards).toHaveCount(defaultTitles.length)
  await page.getByLabel('Where').fill('PagingTest')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/q=PagingTest/)
  await expect(page.getByText('1–20 of 25')).toBeVisible()
  await expect(cards).toHaveCount(20)
  const pageOne = await titlesOnPage()
  expect(pageOne).toEqual(await titlesFromApi('q=PagingTest&page=1'))

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText('21–25 of 25')).toBeVisible()
  await expect(cards).toHaveCount(5)
  const pageTwo = await titlesOnPage()
  expect(pageTwo).toEqual(await titlesFromApi('q=PagingTest&page=2'))
  expect(pageTwo.some((t) => pageOne.includes(t))).toBe(false)

  // Back from page 2 shows page 1 again.
  await page.goBack()
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.getByText('1–20 of 25')).toBeVisible()
  await expect(cards).toHaveCount(20)
  expect(await titlesOnPage()).toEqual(pageOne)

  // Remove the text chip: the filter goes and the unfiltered list returns.
  await page.getByRole('button', { name: 'Remove filter Matching: PagingTest' }).click()
  await expect(page).not.toHaveURL(/q=/)
  await expect(page.getByRole('button', { name: /Remove filter/ })).toHaveCount(0)
  await expect(page.getByLabel('Where')).toHaveValue('')
  await expect.poll(titlesOnPage).toEqual(defaultTitles)

  // Search for non-existent events: the empty state offers Clear filters, which restores the default list.
  await page.getByLabel('Where').fill('zzz')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByText('No events match your search.')).toBeVisible()
  const clearBtn = page.getByRole('button', { name: 'Clear filters' })
  await expect(clearBtn).toBeVisible()
  await clearBtn.click()
  await expect(cards).toHaveCount(defaultTitles.length)
  await expect.poll(titlesOnPage).toEqual(defaultTitles)
})

// AC-C-08 on the new controls: chips, Clear all, pager, form fields (the C-08 scan sees /events with no filters only).
test('TEST-J-05 (E2E) — the filtered list passes the axe colour-contrast scan (AC-C-08)', async ({ page }) => {
  await page.goto('/events?q=quantum&include=past,cancelled')
  await expect(page.getByRole('button', { name: 'Clear all' })).toBeVisible()
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

// TEST-U-02 (E2E) · AC-U-02, FR-29, JRN-04 (Sprint 2 contracts §11.1): the game filter. EV-6 (Pokémon) is shown,
// EV-1 (Magic) is not; the URL, the chip and every card agree.
test('TEST-U-02 (E2E) — filter by game: EV-6 shown, EV-1 not; URL, chip and cards agree (AC-U-02, JRN-04)', async ({ page }) => {
  const cards = page.locator('a.event-card')
  await page.goto('/events')
  await page.getByLabel('Game').selectOption('POKEMON')
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  await expect(page).toHaveURL(/game=POKEMON/)
  await expect(page.getByRole('button', { name: 'Remove filter Game: Pokémon TCG' })).toBeVisible()

  const res = await page.request.get('/api/events?game=POKEMON&page=1')
  expect(res.status()).toBe(200)
  const items = ((await res.json()) as { items: { title: string; game: string }[] }).items
  expect(items.length).toBeGreaterThan(0)
  expect(items.every((i) => i.game === 'POKEMON')).toBe(true)
  await expect(cards).toHaveCount(items.length)

  const titles = (await page.locator('.event-card__title').allTextContents()).map((t) => t.trim())
  expect(titles).toContain('Release Weekend Sealed · เปิดกล่องสุดสัปดาห์') // EV-6
  expect(titles).not.toContain('Friday Night Constructed') // EV-1 is Magic
  await expect(page.locator('a.event-card .chip--game')).toHaveCount(items.length)
  for (const chip of await page.locator('a.event-card .chip--game').allTextContents()) expect(chip).toBe('Pokémon TCG')
})
