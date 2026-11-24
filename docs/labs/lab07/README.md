# Lab 7: Sprint 1 maintenance, change CH-13 (evidence index)

Project: **TCG Event Hub** · Issue [#77](https://github.com/GGital/My-little-pony/issues/77) · Document version: v1.1 (25 Nov 2026)

This page indexes the Part A and Part B evidence kept in the repository. The submission PDF embeds the same items
(Lab 7 §4.1) and uses these evidence IDs. Parts C and D (metrics, readiness, retrospective) are written for the PDF
after the release.

**The change.** BR-02, start rule for a new event (E-06 `POST /api/events`):

| | Rule | Message on `startAt` (`422 EVENT_TIME_INVALID`) |
|---|---|---|
| Old (Sprint 1) | `startAt > now()` | "The start must be in the future." |
| New (CH-13) | `startAt >= now() + 60 min` (now + 60 min accepted, now + 59 min rejected) | "The start must be at least 60 minutes from now." |

Unchanged: the end rules (after the start, at most 24 h), the status and error code, who may create (organizers only),
existing events, the schema (no migration).

## 1. Version table

| Step | Version | Notes |
|---|---|---|
| Accepted Sprint 1 baseline (old behaviour) | `v0.1.0` = `cb42ae9` (main, 7 Nov 2026) | Deliverable 1 release |
| Accepted release before the change (Lab 6) | `main` `5425300` (PR #75), Cloud Run revision `tcg-event-hub-00017-j4p` | Untagged. Intervening development since `v0.1.0`: Lab 5 pipeline (`v0.1.1` = `2dbf079`) and the eight Lab 6 defect fixes (#56–#63); none touches BR-02 |
| Actual pre-change implementation | `sprint-1-staging` `1a73ff0` | `server/`, `client/` and `e2e/` identical to `5425300` (`git diff 5425300 a44fcac -- server client e2e` is empty) |
| TA approval | 23 Nov 2026 13:18, Supachok Deetaweesukh (P'Tik) | L7-A01; recorded in #77 and SRS D-39 |
| Contract revision (before code) | `751e9cd`, PR #88, merged as `a44fcac` (24 Nov 2026) | SRS v0.5.1, contracts v1.13, STS v1.14, SDS v0.9.1, traceability v0.4.1; reviewed by Praewa |
| Tests (red) | `f41f52f` | Branch `feature/l7-ch13-code` from `a44fcac` |
| Implementation (green) | `72ae022` | |
| Evidence and results | `68d4377` | STS v1.15, traceability v0.4.2 |
| PR into `sprint-1-staging`, CI | PR #89 merged as `816230a` (24 Nov 2026 16:53) | Reviewed by Praewa; CI run 45430174916 green (L7-PR) |
| Main release | `v0.1.2` = `dff72b6` (PR #90, merged 24 Nov 2026 17:22) | Reviewed by Praewa; contains only the six CH-13 commits (L7-REL) |
| Deployed revision, post-deploy checks | Cloud Run `tcg-event-hub-00018-s6f`, serving `dff72b6` | Lab 5 pipeline run 45447898603, smoke 5 PASS; L7-D01, L7-D02 PASS |

No Sprint 2 code is on this line: Sprint 2 work is on `sprint-2-staging` and the CH-13 contract revision for Sprint 2
(edit and publish) is a separate change there.

## 2. Evidence

All times are UTC. Each screenshot has a JSON record beside it with the same fields, written by the test itself
(`e2e/sprint-1/lab7-ch13.spec.ts`): the `actual` result is read from the page, not typed in. Versions: Node 24.19.0,
Vitest 4.0.18, Playwright 1.56.1 (Chromium), PostgreSQL 17.9 (local test database, fresh seed).

### 2.1 Approval

| ID | What | File |
|---|---|---|
| L7-A01 | TA approval message for #77 (23 Nov 2026 13:18) | [`evidence/L7-A01-ta-approval.png`](evidence/L7-A01-ta-approval.png) |

### 2.2 Red and green runs (automated)

| ID | Commit | Command | Expected | Actual (passed / failed / skipped) | File |
|---|---|---|---|---|---|
| L7-R01 | `f41f52f` (old code) | `cd server; npx vitest run tests/sprint-1/unit/event-rules.unit.test.ts tests/sprint-1/events.create.api.test.ts` | Every case below now + 60 min fails on its assertion | **26 / 9 / 0** (unit 5 failed of 11, API 4 failed of 24); all AssertionError on the missing rule or message | [`L7-red-server.txt`](evidence/L7-red-server.txt) |
| L7-R02 | `f41f52f` (old code) | `$env:L7_SIDE='before'; npx playwright test lab7-ch13` | TEST-L7-01 fails; L7-02 … 04 pass | **3 / 1 / 0**: TEST-L7-01 expected `/organizer/events/new`, received `/events/7` (published) | [`L7-red-e2e.txt`](evidence/L7-red-e2e.txt) |
| L7-G01 | `72ae022` | `cd server; npx vitest run` | All pass, including the 9 red cases | **308 / 0 / 0** | [`L7-green-server.txt`](evidence/L7-green-server.txt) |
| L7-G02 | `72ae022` | `cd client; npx vitest run` and `npm run build` | All pass; build OK | **91 / 0 / 0**; build OK | [`L7-green-client.txt`](evidence/L7-green-client.txt) |
| L7-G03 | `72ae022` | `$env:L7_SIDE='after'; npx playwright test` and `npm run sts:check` | All pass | **53 / 0 / 0**; `sts:check` OK | [`L7-green-e2e.txt`](evidence/L7-green-e2e.txt) |

**Why these regression suites (Lab 7 §3.2).** The changed function `validateEventTimes()` has one caller, E-06.
The server suite covers that endpoint's other rules (TEST-D-01, D-02, D-04), its access rules (TEST-D-05,
TEST-B-01 … 03), the time-dependent reads and registration that depend on event start times (TEST-F-*, TEST-G-*,
BR-04: registration closes at the start), persistence and the seed (TEST-SR1-*), the error catalogue (TEST-SR2-*) and
the clock (TEST-SR3-*). The client suite covers the changed create form. The E2E suite runs every Sprint 1 journey in
the browser. All of them were run whole, not a subset.

**Old expected results that changed (versioned in STS v1.14, contracts v1.13).** In TEST-D-03 (U and I), the cases
`start = now` and `start = now − 1 min` keep their rejection; only the expected message changes to the new one,
because the requirement changed. No test was deleted, skipped or weakened.

### 2.3 Before | after screenshots (automated, Playwright)

Before = `L7_SIDE=before` on `f41f52f` (24 Nov 2026 15:37–15:38). After = `L7_SIDE=after` on `72ae022`
(15:41). Viewport 1280 × 900; Quantum Cards signed in (Mint for L7-P02); real clock.

| ID | Behaviour | Action | Expected (new rule) | Before (actual) | After (actual) |
|---|---|---|---|---|---|
| L7-B01-form | changed | Fill the create form with a start 30 min from now | Start field shows "(at least 1 hour from now)" | no hint · [png](evidence/L7-B01-form-before.png) · [json](evidence/L7-B01-form-before.json) | hint shown · [png](evidence/L7-B01-form-after.png) · [json](evidence/L7-B01-form-after.json) |
| L7-B01-result | changed | Press PUBLISH EVENT | Stays on the form; Start field: "The start must be at least 60 minutes from now."; nothing published | `/events/7`, "Your event is live." · [png](evidence/L7-B01-result-before.png) · [json](evidence/L7-B01-result-before.json) | `/organizer/events/new`, the message on Start · [png](evidence/L7-B01-result-after.png) · [json](evidence/L7-B01-result-after.json) |
| L7-B02-result | changed rule, allowed side | Publish with a start 62 min from now | "Your event is live." | live · [png](evidence/L7-B02-result-before.png) · [json](evidence/L7-B02-result-before.json) | live · [png](evidence/L7-B02-result-after.png) · [json](evidence/L7-B02-result-after.json) |
| L7-P01-result | preserved | Publish an event 5 days ahead lasting 25 h | End field: "An event can last at most 24 hours." | same · [png](evidence/L7-P01-result-before.png) · [json](evidence/L7-P01-result-before.json) | same · [png](evidence/L7-P01-result-after.png) · [json](evidence/L7-P01-result-after.json) |
| L7-P02-result | preserved | Mint (participant) opens `/organizer/events/new` | "This page isn't available for your account"; no form | same · [png](evidence/L7-P02-result-before.png) · [json](evidence/L7-P02-result-before.json) | same · [png](evidence/L7-P02-result-after.png) · [json](evidence/L7-P02-result-after.json) |

The exact 60-minute boundary (now + 60 min accepted, now + 60 min − 1 ms and + 59 min rejected) is tested with a fixed
clock in L7-R01 / L7-G01. The browser test uses 62 minutes because the `datetime-local` input has minute precision and
the real clock moves during the test.

### 2.4 Review, integration, release and deploy

| ID | What | Result | Source |
|---|---|---|---|
| L7-PR | PR #89 (tests, code, evidence) into `sprint-1-staging` | Approved by Praewa (MeldyRose) 24 Nov 2026 16:47; CI `test-and-docker` run 45430174916 on `68d4377` green; merged as `816230a` at 16:53 | [PR #89](https://github.com/GGital/My-little-pony/pull/89) |
| L7-REL | Release PR #90 `sprint-1-staging` → `main` | CI run 45442901114 on `816230a` green; approved by Praewa 17:20; merged as `dff72b6` at 17:22; annotated tag `v0.1.2` on `dff72b6`. Deploy demo run 45447898603 (17:22–17:28): test job 308 / 91 / 53 passed, 0 failed, 0 skipped; image `tcg-event-hub:dff72b6…`; migration execution completed (no new migration); revision `tcg-event-hub-00018-s6f` at 100 % (replaces `00017-j4p`); smoke `/api/health`, `/api/ready`, `/`, `/api/events`, `/api/version` = `dff72b6` PASS; login smoke SKIP (optional credentials not configured) | [PR #90](https://github.com/GGital/My-little-pony/pull/90), [`L7-REL-deploy.txt`](evidence/L7-REL-deploy.txt) |

The merge commits are the normal project workflow: `816230a` merges #89 into staging, `dff72b6` merges staging into
`main`. `git log 5425300..dff72b6` lists only the CH-13 commits and their merges; no Sprint 2 work is in this release.

### 2.5 Post-deploy checks on the live site

Live site `https://tcg-event-hub-932557875237.asia-southeast1.run.app`, revision `tcg-event-hub-00018-s6f`,
`/api/version` = `dff72b6` at the time of the checks (recorded in each JSON as `deployedCommit`). **Manual sign-in,
automated steps**: the tester signed in by hand in a headed Chromium window (Quantum Cards, then Mint); a Playwright
script then filled the form and saved the screenshot and the JSON record, with `actual` read from the page. 24 Nov 2026
17:30 UTC (25 Nov 00:30 Bangkok). Synthetic data only; the 62-minute event is left on the live site.

| ID | Behaviour | Action | Expected | Actual | Result | Files |
|---|---|---|---|---|---|---|
| L7-D01-a | changed | Quantum Cards publishes an event starting 30 min from now | Stays on the form; Start field: "The start must be at least 60 minutes from now."; nothing published | `/organizer/events/new`, Start field shows that message | PASS | [png](evidence/L7-D01-a-live.png) · [json](evidence/L7-D01-a-live.json) |
| L7-D01-b | changed rule, allowed side | Quantum Cards publishes an event starting 62 min from now | "Your event is live." | `/events/44` "Lab 7 live check 0029 (62 min)", banner "Your event is live.", footer `Build dff72b6` | PASS | [png](evidence/L7-D01-b-live.png) · [json](evidence/L7-D01-b-live.json) |
| L7-D02-a | preserved | Quantum Cards publishes an event 5 days ahead lasting 25 h | End field: "An event can last at most 24 hours." | `/organizer/events/new`, End field shows that message | PASS | [png](evidence/L7-D02-a-live.png) · [json](evidence/L7-D02-a-live.json) |
| L7-D02-b | preserved (access) | Mint (participant) opens `/organizer/events/new` | "This page isn't available for your account"; no form | That page, no form (`formPresent: false`), footer `Build dff72b6` | PASS | [png](evidence/L7-D02-b-live.png) · [json](evidence/L7-D02-b-live.json) |

The banner "Your event is live." in L7-D01-b is visible in the screenshot but is not an ARIA alert, so the JSON
`messages` list is empty; the URL and heading show the published event.

## 3. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v1.0 | 24 Nov 2026 | Index of the CH-13 approval, red / green runs and before / after screenshots | Team (AI-assisted) |
| v1.1 | 25 Nov 2026 | Review and CI of #89, release #90 / `v0.1.2`, deploy run and revision, post-deploy checks L7-D01 and L7-D02 | Team (AI-assisted) |
