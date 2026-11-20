import { expect, test } from '@playwright/test'
import { EMAIL, bangkokLocal, resetSeed, signIn } from './helpers'

// Lab 6 UAT finding #59 (KitLoop Finding 4): an accepted 120-character contact without spaces widens the left column
// of the event page, so the Seats card and the owner's "Your event" panel (with View registrations) are pushed out of
// the panel and clipped (AC-F-02, NFR-08, AC-SR5-01). Checked as the owner at 390, 768 and 1440 px.

const LONG_CONTACT = 'qa-' + 'a'.repeat(105) + '@example.com' // 120 characters, the UAT value
const WIDTHS = [390, 768, 1440] as const

test.describe('TEST-L6-59 (E2E) — a 120-character contact stays inside the event page (AC-F-02, NFR-08)', () => {
  let eventId: string

  test.beforeAll(async ({ browser }) => {
    resetSeed()
    const context = await browser.newContext()
    const page = await context.newPage()
    await signIn(page, EMAIL.quantum)

    await page.goto('/organizer/events/new')
    await page.locator('#title').fill('UAT-UI-CONTACT-20261120')
    await page.getByText('CASUAL', { exact: true }).click()
    await page.locator('#venueName').fill('UAT Test Store')
    await page.locator('#venueAddress').fill('1 Test Road')
    await page.locator('#city').fill('Bangkok')
    await page.locator('#startAt').fill(bangkokLocal(10, 19))
    await page.locator('#endAt').fill(bangkokLocal(10, 22))
    await page.locator('#capacity').fill('8')
    await page.locator('#contact').fill(LONG_CONTACT)
    await page.getByRole('button', { name: 'PUBLISH EVENT' }).click()

    await expect(page).toHaveURL(/\/events\/(\d+)$/)
    eventId = page.url().match(/\/events\/(\d+)$/)![1]
    await context.close()
  })

  for (const width of WIDTHS) {
    test(`/events/:id at ${width}px as the owner: contact wraps, Seats and Your event stay inside the panel`, async ({ page }) => {
      await signIn(page, EMAIL.quantum)
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/events/${eventId}`)
      await expect(page.getByText(LONG_CONTACT)).toBeVisible()
      await expect(page.getByRole('link', { name: /View registrations/i })).toBeAttached()

      const m = await page.evaluate((contact) => {
        const right = (el: Element | null) => (el ? el.getBoundingClientRect().right : Number.NaN)
        const panel = document.querySelector('.app-panel')
        const text = [...document.querySelectorAll('.info-row div')].find((d) => d.textContent === contact) ?? null
        return {
          pageScroll: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          panelRight: right(panel),
          seatsRight: right(document.querySelector('.seat-card')),
          contactBoxRight: right(document.querySelector('.contact-box')),
          viewRegistrationsRight: right(document.querySelector('a[href$="/registrations"]')),
          textOverflow: text ? text.scrollWidth - text.clientWidth : Number.NaN,
        }
      }, LONG_CONTACT)

      expect(m.pageScroll, `no horizontal scroll at ${width}px`).toBeLessThanOrEqual(m.innerWidth)
      expect(m.textOverflow, `the contact text wraps inside its row at ${width}px`).toBeLessThanOrEqual(0)
      expect(m.contactBoxRight, `Contact box inside .app-panel at ${width}px`).toBeLessThanOrEqual(m.panelRight + 1)
      expect(m.seatsRight, `Seats card inside .app-panel at ${width}px`).toBeLessThanOrEqual(m.panelRight + 1)
      expect(m.viewRegistrationsRight, `View registrations inside .app-panel at ${width}px`).toBeLessThanOrEqual(m.panelRight + 1)
    })
  }
})
