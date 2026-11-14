// Lab 5 evidence screenshots at 2x (readable at 100% zoom, handout §12): the merge-gate ruleset (Part 1) and the
// Episode 7 release B set (#36, Part 4). Pages that need a sign-in reuse a Playwright profile you sign in to yourself.
//
//   node scripts/lab5-evidence-capture.mjs login     # opens Edge: sign in to GitHub and Google Cloud, then close it
//   node scripts/lab5-evidence-capture.mjs capture   # headless, writes test-results/lab5/*.png
//   node scripts/lab5-evidence-capture.mjs capture r1 e05   # only these shots
//
// The profile (test-results/pw-profile, git-ignored) holds your session cookies: delete the folder when done.
// This script never reads or prints a password. A grey strip above each page shows its real URL and the capture
// time, because a headless browser has no address bar.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const PROFILE = 'test-results/pw-profile'
const OUT = 'test-results/lab5'
const REPO = 'https://github.com/GGital/My-little-pony'
const APP = 'https://tcg-event-hub-932557875237.asia-southeast1.run.app'
const GCP = 'project=cpe334-en007'
const options = {
  channel: 'msedge',
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
}

// Each shot: page, what it proves, and an optional step that brings the right part into view.
const SHOTS = [
  { id: 'r1', name: 'r1-ruleset-protect-main', url: `${REPO}/rules/27212814`, note: 'C-02 / R-06 ruleset', full: true,
    prep: async (page) => {
      // Each click renames that button to "Hide additional settings", so always click the first one left.
      const more = page.getByRole('button', { name: 'Show additional settings' })
      while (await more.count()) await more.first().click()
    } },
  { id: 'e01', name: 'e01-A-run-summary', url: `${REPO}/actions/runs/43476752828`, note: 'release A run', show: 'text=Commit image tag' },
  { id: 'e02', name: 'e02-A-smoke', url: `${REPO}/actions/runs/43476752828/job/132064271342#step:9:1`, note: 'release A smoke step', show: 'text=PASS /api/version' },
  { id: 'e03', name: 'e03-B-run-summary', url: `${REPO}/actions/runs/43604904531`, note: 'release B run', show: 'text=Commit image tag' },
  { id: 'e04', name: 'e04-B-smoke', url: `${REPO}/actions/runs/43604904531/job/132478225183#step:9:1`, note: 'release B smoke step', show: 'text=PASS /api/version' },
  { id: 'e05', name: 'e05-cloud-run-revisions', url: `https://console.cloud.google.com/run/detail/asia-southeast1/tcg-event-hub/revisions?${GCP}`, note: 'Cloud Run revisions', wait: 9000 },
  { id: 'e06', name: 'e06-migrate-job', url: `https://console.cloud.google.com/run/jobs/details/asia-southeast1/tcg-event-hub-migrate/executions?${GCP}`, note: 'migration job executions', wait: 9000 },
  { id: 'e07', name: 'e07-artifact-registry', url: `https://console.cloud.google.com/artifacts/docker/cpe334-en007/asia-southeast1/tcg-event-hub/tcg-event-hub?${GCP}`, note: 'image tags and digests', wait: 9000 },
  { id: 'e08', name: 'e08-B-live-events', url: `${APP}/events`, note: 'release B visible change' },
  { id: 'e09', name: 'e09-B-live-footer', url: `${APP}/events`, note: 'footer: running build', show: '.app-footer' },
  { id: 'e10', name: 'e10-B-api-version', url: `${APP}/api/version`, note: 'running commit' },
  { id: 'e11', name: 'e11-B-pr46-review', url: `${REPO}/pull/46#pullrequestreview-5904314660`, note: 'R-09 specific review', show: '#pullrequestreview-5904314660' },
]

async function addAddressStrip(page, note) {
  await page.evaluate((note) => {
    document.getElementById('lab5-address')?.remove()
    const bar = document.createElement('div')
    bar.id = 'lab5-address'
    // At the top of the page the strip pushes the page down; further down it floats over the top edge.
    bar.style.cssText = (scrollY === 0 ? 'position:relative;' : 'position:fixed;top:0;left:0;right:0;') +
      'z-index:2147483647;display:flex;gap:16px;align-items:center;' +
      'padding:6px 14px;background:#f1f3f4;color:#202124;font:13px/1.4 Consolas,monospace;border-bottom:1px solid #c4c7c5'
    const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })
    bar.textContent = ''
    for (const [text, grow] of [['URL', false], [location.href, true], [`${note} · ${when} Bangkok`, false]]) {
      const span = document.createElement('span')
      span.textContent = text
      if (grow) span.style.flex = '1'
      bar.append(span)
    }
    if (scrollY === 0) document.body.prepend(bar)
    else document.documentElement.append(bar)
  }, note)
}

const [mode = 'capture', ...only] = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })

if (mode === 'login') {
  const context = await chromium.launchPersistentContext(PROFILE, { ...options, headless: false, deviceScaleFactor: 1 })
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto('https://github.com/login')
  const google = await context.newPage()
  await google.goto(`https://console.cloud.google.com/run?${GCP}`)
  console.log('Sign in to GitHub and Google Cloud in the window, then close the window to save the session.')
  await new Promise((resolve) => context.on('close', resolve))
  console.log('Session saved in', PROFILE)
} else {
  const context = await chromium.launchPersistentContext(PROFILE, { ...options, headless: true })
  const page = context.pages()[0] ?? (await context.newPage())
  try {
    for (const shot of SHOTS.filter((s) => only.length === 0 || only.includes(s.id))) {
      await page.goto(shot.url, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(shot.wait ?? 3000)
      if (/accounts\.google\.com|github\.com\/login/.test(page.url())) {
        console.log(`SKIP ${shot.id}: not signed in (${page.url().split('?')[0]}); run "login" first`)
        continue
      }
      if (shot.prep) await shot.prep(page)
      if (shot.show) {
        const target = page.locator(shot.show).first()
        await target.waitFor({ timeout: 15000 }).catch(() => console.log(`note ${shot.id}: "${shot.show}" not found`))
        await target.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {})
        await page.waitForTimeout(800)
      }
      if (shot.full) await page.evaluate(() => scrollTo(0, 0)) // full-page shots keep the strip above the page
      await addAddressStrip(page, shot.note)
      await page.screenshot({ path: `${OUT}/${shot.name}.png`, fullPage: !!shot.full })
      console.log(`saved ${OUT}/${shot.name}.png`)
    }
  } finally {
    await context.close()
  }
}
