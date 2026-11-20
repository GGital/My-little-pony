import { expect, test } from '@playwright/test'
import { EMAIL, bangkokLocal, resetSeed, signIn } from './helpers'

// Lab 6 UAT finding #56 (KitLoop Finding 1): valid 100-character unbroken title causes overflow
// and clips seat info on /events and /events/:id at 390, 768 and 1440 px widths (AC-F-01, AC-F-02, NFR-08).

const LONG_TITLE = 'UAT-EXTRA-LENGTH-' + 'A'.repeat(83) // 100 characters total
const WIDTHS = [390, 768, 1440] as const

test.describe('TEST-L6-56 (E2E) — 100-character title layout and seat info visibility (AC-F-01, AC-F-02, NFR-08)', () => {
  let eventId: string

  test.beforeAll(async ({ browser }) => {
    resetSeed()
    // Create an event with the 100-character title as Quantum Cards
    const context = await browser.newContext()
    const page = await context.newPage()
    await signIn(page, EMAIL.quantum)

    await page.goto('/organizer/events/new')
    await page.locator('#title').fill(LONG_TITLE)
    await page.getByText('CASUAL', { exact: true }).click()
    await page.locator('#venueName').fill('Quantum Cards')
    await page.locator('#venueAddress').fill('1631 Kanchanaphisek Rd, Bang Khae, Bangkok 10160')
    await page.locator('#city').fill('Bangkok')
    await page.locator('#startAt').fill(bangkokLocal(10, 10))
    await page.locator('#endAt').fill(bangkokLocal(10, 14))
    await page.locator('#capacity').fill('256')
    await page.getByRole('button', { name: 'PUBLISH EVENT' }).click()

    await expect(page).toHaveURL(/\/events\/(\d+)$/)
    const match = page.url().match(/\/events\/(\d+)$/)
    eventId = match![1]
    await context.close()
  })

  for (const width of WIDTHS) {
    test(`/events at ${width}px: no horizontal scroll and card and seat info stay within panel`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      await page.goto('/events')

      // 1. Page does not scroll sideways (AC-SR5-01, NFR-08)
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(scrollWidth, `no horizontal scroll on /events at ${width}px`).toBeLessThanOrEqual(innerWidth)

      // 2. The event card and aside column fit within .app-panel right edge
      const card = page.locator('a.event-card', { hasText: LONG_TITLE })
      await expect(card).toBeVisible()
      const aside = card.locator('.event-card__aside')
      await expect(aside).toBeVisible()

      const { cardRight, asideRight, panelRight } = await page.evaluate(
        ({ cardEl, asideEl }) => {
          const panel = cardEl.closest('.app-panel')!
          return {
            cardRight: cardEl.getBoundingClientRect().right,
            asideRight: asideEl.getBoundingClientRect().right,
            panelRight: panel.getBoundingClientRect().right,
          }
        },
        { cardEl: (await card.elementHandle())!, asideEl: (await aside.elementHandle())! },
      )
      expect(cardRight, `.event-card fits within .app-panel right edge at ${width}px`).toBeLessThanOrEqual(panelRight + 1)
      expect(asideRight, `.event-card__aside fits within .app-panel right edge at ${width}px`).toBeLessThanOrEqual(panelRight + 1)
    })

    test(`/events/:id at ${width}px: no horizontal scroll and title wraps within container`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      await page.goto(`/events/${eventId}`)

      // 1. Page does not scroll sideways (AC-SR5-01, NFR-08)
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(scrollWidth, `no horizontal scroll on /events/:id at ${width}px`).toBeLessThanOrEqual(innerWidth)

      // 2. h1 title wraps within its container: scrollWidth <= clientWidth
      const h1 = page.locator('.dhead h1')
      await expect(h1).toBeVisible()
      const { h1ScrollWidth, h1ClientWidth } = await h1.evaluate(el => ({
        h1ScrollWidth: el.scrollWidth,
        h1ClientWidth: el.clientWidth,
      }))
      expect(h1ScrollWidth, `.dhead h1 scrollWidth fits clientWidth at ${width}px`).toBeLessThanOrEqual(h1ClientWidth)
    })
  }
})
