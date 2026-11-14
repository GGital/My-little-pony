// Lab 5 C-04 (R-03): the domain workflow on the public URL, captured with Playwright.
//
//   $s = Read-Host "Password" -AsSecureString
//   $env:C04_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
//   node scripts/c04-live-capture.mjs
//
// Signs in as a participant (C04_EMAIL, default mint@player.example), registers for one open event, opens My Events,
// then shows one rule rejection (a FULL event cannot be registered for) and one access restriction (a participant
// opening the organizer dashboard). The password comes only from C04_PASSWORD and is never printed or captured: the
// password field shows dots. Headless Chromium has no address bar, so the script adds a strip above each page with
// the page's real URL (location.href) and the capture time. Output: test-results/c04/*.png (not committed).
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = (process.env.C04_URL ?? 'https://tcg-event-hub-932557875237.asia-southeast1.run.app').replace(/\/$/, '')
const EMAIL = process.env.C04_EMAIL ?? 'mint@player.example'
const PASSWORD = process.env.C04_PASSWORD
const OPEN_EVENT = process.env.C04_OPEN_EVENT ?? '5' // Dragon Draft Night, 0 / 16 on 14 Nov
const FULL_EVENT = process.env.C04_FULL_EVENT ?? '3' // Store Championship Qualifier, FULL 2 / 2
const OUT = 'test-results/c04'
if (!PASSWORD) throw new Error('Set C04_PASSWORD first (see the comment at the top of this file).')

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })

async function shot(name, note, fullPage = false) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(({ note }) => {
    document.getElementById('c04-address')?.remove()
    const bar = document.createElement('div')
    bar.id = 'c04-address'
    bar.style.cssText =
      'position:relative;z-index:99999;display:flex;gap:16px;align-items:center;padding:8px 14px;' +
      'background:#f1f3f4;color:#202124;font:14px/1.4 Consolas,monospace;border-bottom:1px solid #c4c7c5'
    const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })
    bar.innerHTML = `<b>URL</b><span style="flex:1">${location.href}</span><span>${note} · ${when} Bangkok</span>`
    document.body.prepend(bar)
  }, { note })
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
  console.log(`saved ${OUT}/${name}.png  (${page.url()})`)
}

try {
  // 1. Sign in (FR-01): the form, then the signed-in header.
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await shot('c04-01-sign-in-form', 'signed out')
  await page.getByRole('button', { name: 'SIGN IN' }).click()
  await page.getByTestId('user-menu-btn').waitFor()
  await page.goto(`${BASE}/events`)
  await shot('c04-02-signed-in-events', `signed in as ${EMAIL}`)

  // 2. Main action: register for an open event (FR-15), then My Events (FR-17).
  await page.goto(`${BASE}/events/${OPEN_EVENT}`)
  await shot('c04-03-event-before-register', 'before REGISTER')
  const register = page.getByRole('button', { name: 'REGISTER', exact: true })
  if (await register.isVisible()) {
    await register.click()
    await page.getByRole('heading', { name: "You're in." }).waitFor()
    await page.waitForTimeout(1500) // let the ticket card finish its flip animation
  } else {
    console.log('already registered for this event; capturing the registered state')
  }
  await shot('c04-04-registered', 'after REGISTER')
  await page.goto(`${BASE}/me/registrations`)
  await page.getByText('REGISTERED').first().waitFor()
  await shot('c04-05-my-events', 'My Events', true) // full page: the new registration may be below the fold

  // 3. Rule rejection: a FULL event has no seat left, so REGISTER is replaced by a disabled FULL button (BR-05).
  await page.goto(`${BASE}/events/${FULL_EVENT}`)
  await page.getByRole('button', { name: 'FULL' }).waitFor()
  await shot('c04-06-full-event-rejected', 'rule: no seat left')

  // 4. Access restriction: a participant opening the organizer dashboard sees the 403 page (FR-04).
  await page.goto(`${BASE}/organizer`)
  await page.getByTestId('not-available-page').waitFor()
  await shot('c04-07-organizer-page-restricted', 'participant opens /organizer')
} finally {
  await browser.close()
}
