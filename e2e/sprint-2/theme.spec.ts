import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { EMAIL, EV, resetSeed, signIn, signOut } from '../sprint-1/helpers'

// TEST-C-07 and TEST-C-08 (E2E): AC-C-07, AC-C-08, D-38. Deep Lagoon colours; Inter, Manrope and IBM Plex Sans Thai,
// self-hosted; no colour-contrast violation. TEST-SR5-01 (Sprint 1 responsive.spec.ts) is rerun with the whole suite.
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`
}
const GREEN = rgb('#1F6F43')
const TEAL = rgb('#167D8D')
const style = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

test.beforeAll(resetSeed)

test.describe('TEST-C-07 fonts (AC-C-07)', () => {
  test('body is Inter, figures are Manrope with tabular digits, Thai title loads IBM Plex Sans Thai, no Google Fonts', async ({ page }) => {
    const outside: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('fonts.googleapis.com') || r.url().includes('fonts.gstatic.com')) outside.push(r.url())
    })
    await page.goto('/events')
    await expect(page.getByRole('heading', { name: 'Find an Event', exact: true }).first()).toBeVisible()
    expect(await style(page, 'body', 'font-family')).toMatch(/^"?Inter"?/)
    expect(await style(page, '.date-badge', 'font-family')).toMatch(/^"?Manrope"?/)
    expect(await style(page, '.date-badge', 'font-variant-numeric')).toContain('tabular-nums')
    expect(await style(page, '.chip--seats', 'font-family')).toMatch(/^"?Manrope"?/)

    await page.goto(`/events/${EV[1]}`)
    await expect(page.getByRole('heading', { name: 'Friday Night Constructed' }).first()).toBeVisible()
    expect(await style(page, '.seat-card__left', 'font-family')).toMatch(/^"?Manrope"?/)
    expect(await style(page, '.seat-card__left', 'font-variant-numeric')).toContain('tabular-nums')

    await page.goto(`/events/${EV[6]}`)
    await expect(page.getByRole('heading', { name: /เปิดกล่องสุดสัปดาห์/ }).first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const thaiLoaded = await page.evaluate(() =>
      [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'IBM Plex Sans Thai' && f.status === 'loaded'),
    )
    expect(thaiLoaded).toBe(true)

    await signIn(page, EMAIL.mint)
    await page.goto('/me/registrations')
    await expect(page.getByRole('heading', { name: 'My Events', exact: true }).first()).toBeVisible()
    expect(await style(page, '.chip--seats', 'font-family')).toMatch(/^"?Manrope"?/)
    expect(outside).toEqual([])
  })
})

type Screen = { name: string; path: string; as?: string; ready: string }
const SCREENS: Screen[] = [
  { name: 'events', path: '/events', ready: 'Find an Event' },
  { name: 'event-open', path: `/events/${EV[2]}`, ready: 'Last Seat Sealed' },
  { name: 'event-registered', path: `/events/${EV[1]}`, as: EMAIL.mint, ready: 'Friday Night Constructed' },
  { name: 'sign-in', path: '/login', ready: 'Sign in' },
  { name: 'my-events', path: '/me/registrations', as: EMAIL.mint, ready: 'My Events' },
  { name: 'dashboard', path: '/organizer', as: EMAIL.quantum, ready: 'Dashboard' },
  { name: 'create-event', path: '/organizer/events/new', as: EMAIL.quantum, ready: 'Create an event' },
  { name: 'registrations', path: `/organizer/events/${EV[1]}/registrations`, as: EMAIL.quantum, ready: 'Friday Night Constructed' },
]

test.describe('TEST-C-08 contrast and colours (AC-C-08)', () => {
  for (const s of SCREENS) {
    test(`axe color-contrast: ${s.name}`, async ({ page }) => {
      if (s.as) await signIn(page, s.as)
      await page.goto(s.path)
      await expect(page.getByRole('heading', { name: s.ready, exact: true }).first()).toBeVisible()
      const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
      expect(result.violations.map((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([])
    })
  }

  test('seat chip, PLAYER badge and REGISTERED are green; primary button and date badge are teal', async ({ page }) => {
    await signIn(page, EMAIL.mint)
    await page.goto('/me/registrations')
    await expect(page.getByRole('heading', { name: 'My Events', exact: true }).first()).toBeVisible()
    expect(await style(page, '.chip--seats', 'color')).toBe(GREEN)
    expect(await style(page, '.role-badge', 'background-color')).toBe(GREEN)
    await page.goto(`/events/${EV[1]}`)
    const registered = page.locator('.btn-big--registered').first()
    await expect(registered).toBeVisible()
    expect(await registered.evaluate((el) => getComputedStyle(el).color)).toBe(GREEN)
    expect(await registered.evaluate((el) => getComputedStyle(el).boxShadow)).toContain(GREEN)
    await page.goto('/events')
    expect(await style(page, '.date-badge', 'background-color')).toBe(TEAL)
    await signOut(page)
    await signIn(page, EMAIL.quantum)
    await page.goto('/organizer')
    expect(await style(page, '.btn-big', 'background-color')).toBe(TEAL)
  })
})
