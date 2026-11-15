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
  { id: 'c01', name: 'c01-ci-server-tests', url: `${REPO}/actions/runs/43588358773/job/132427587839#step:10:157`, note: 'C-01 server tests', show: 'text=Test Files' },
  { id: 'c01e', name: 'c01-ci-e2e', url: `${REPO}/actions/runs/43588358773/job/132427587839#step:12:277`, note: 'C-01 end-to-end tests', show: 'text=40 passed' },
  { id: 'g01', name: 'g01-cloud-run-service', url: `https://console.cloud.google.com/run/detail/asia-southeast1/tcg-event-hub/metrics?${GCP}`, note: 'Cloud Run service', wait: 9000 },
  { id: 'g02', name: 'g02-cloud-sql-overview', url: `https://console.cloud.google.com/sql/instances/tcg-event-hub-pg/overview?${GCP}`, note: 'Cloud SQL instance', wait: 9000 },
  { id: 'g03', name: 'g03-cloud-sql-databases', url: `https://console.cloud.google.com/sql/instances/tcg-event-hub-pg/databases?${GCP}`, note: 'Cloud SQL databases', wait: 9000 },
  { id: 'k00', name: 'k00-project-board', url: 'https://github.com/users/GGital/projects/2?filterQuery=label%3Alab5', note: 'Ep 0 project board, label lab5', wait: 6000, vw: 2000, vh: 1500 },
  { id: 'k02', name: 'k02-pr39-six-points', url: `${REPO}/pull/39`, note: 'Ep 2 PR #39', full: true },
  { id: 'k03', name: 'k03-pr40-docker', url: `${REPO}/pull/40`, note: 'Ep 3 PR #40', full: true },
  { id: 'k04a', name: 'k04a-pr41-ci', url: `${REPO}/pull/41`, note: 'Ep 4 PR #41', full: true },
  { id: 'k04b', name: 'k04b-pr42-release', url: `${REPO}/pull/42`, note: 'Ep 4 release PR #42', full: true },
  { id: 'k06a', name: 'k06a-environment-demo', url: `${REPO}/settings/environments/27214213899/edit`, note: 'Ep 6.4 environment demo', full: true },
  { id: 'k06b', name: 'k06b-ruleset-settings', url: `${REPO}/settings/rules/27212814`, note: 'Ep 6.5 ruleset settings', full: true,
    prep: async (page) => {
      const more = page.getByRole('button', { name: /Show additional settings/ })
      while (await more.count()) { await more.first().click(); await page.waitForTimeout(300) }
    } },
  { id: 'k06c', name: 'k06c-wif-provider', url: `https://console.cloud.google.com/iam-admin/workload-identity-pools/pool/github-actions/provider/github-main?${GCP}`, note: 'Ep 6.3 WIF provider', wait: 9000 },
  { id: 'k06d', name: 'k06d-deployer-keys', url: `https://console.cloud.google.com/iam-admin/serviceaccounts/details/tcg-event-hub-deployer@cpe334-en007.iam.gserviceaccount.com/keys?${GCP}`, note: 'Ep 6.2 deployer has no keys', wait: 9000 },
  { id: 'md1', name: 'md1-deployment-md', url: `${REPO}/blob/main/docs/labs/lab05/deployment.md`, note: 'deployment.md (rendered)', full: true },
  { id: 'md2', name: 'md2-contributions-md', url: `${REPO}/blob/main/docs/contributions.md#3-lab-5-cloud-deployment-and-cicd-on-gcp`, note: 'contributions.md (rendered)', full: true },
  { id: 'md3', name: 'md3-fresh-clone-txt', url: `${REPO}/blob/main/docs/labs/lab05/evidence/L5-03-fresh-clone.txt`, note: 'C-03 fresh clone log', full: true },
  // FINAL_RUN: the Deploy demo run of the submitted release (default: run #10)
  { id: 'fr1', name: 'fr1-final-run-summary', url: `${REPO}/actions/runs/${process.env.FINAL_RUN ?? '43618865852'}`, note: 'final release run', show: 'text=Commit image tag' },
  { id: 'fr2', name: 'fr2-final-footer', url: `${APP}/events`, note: 'footer: final release', show: '.app-footer' },
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
  // Edge exits (code 21) when a signed-in profile starts headless, so captures run in a window that closes itself.
  const context = await chromium.launchPersistentContext(PROFILE, { ...options, headless: !!process.env.HEADLESS })
  const page = context.pages()[0] ?? (await context.newPage())
  try {
    for (const shot of SHOTS.filter((s) => only.length === 0 || only.includes(s.id))) {
      // vw/vh: a bigger window for pages with their own scroll areas (the board's columns), so nothing is cut off
      await page.setViewportSize({ width: shot.vw ?? 1440, height: shot.vh ?? 900 })
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
