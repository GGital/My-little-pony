# AI-use declaration

Project: **TCG Event Hub** · CPE 334 group project (Theme 3) · Kept current by every Issue PR (see the last section)

The course allows specification and coding agents if the team supplies the contract, works on bounded Issues,
inspects the output, runs the tests and reviews the change (group spec §8.4). This page lists the tools and the
tasks they assisted. Both students are responsible for, and must be able to explain, everything listed here.

## 1. Tools

| Tool | Used by | How |
|---|---|---|
| Claude Code (Anthropic), cloud session, Claude Opus | Phattaratorn (GGital) | Drafted the baseline documents and I-01 / I-02 on a cloud machine with PostgreSQL 16; its commits have the author **Claude** |
| Claude Code (Anthropic), desktop app on the team's own machine, Claude Opus (and a Claude Sonnet sub-agent that graded the PDF draft) | Phattaratorn (GGital) | PR reviews tested against the local PostgreSQL 17 database; I-04 and later implementation; release evidence and the PDF; its commits carry `Co-Authored-By: Claude` |
| Google Antigravity (Google DeepMind), desktop app, Gemini 2.5 Pro | Praewa (MeldyRose) | Client shell (I-03), Event discovery list and detail (I-05), review fixes and merge resolution |

## 2. Tasks assisted

| Item | Issue / PR | What the AI did | What the students did |
|---|---|---|---|
| SRS, feature inventory, traceability, UI design direction and mock-up, diagrams | PR [#1](https://github.com/GGital/My-little-pony/pull/1) | Drafted the documents from the stakeholder brief and the course spec | Phattaratorn chose the context and directed the drafts; Praewa reviewed and approved PR #1 |
| System-Level SDS, three-sprint plan, Sprint 1 contracts, STS, DoD | PR [#2](https://github.com/GGital/My-little-pony/pull/2) | Drafted the documents | Phattaratorn directed; Praewa reviewed and approved PR #2 |
| I-01 data foundation | #3 · PR [#15](https://github.com/GGital/My-little-pony/pull/15) | Wrote the red tests, then the schema, constraints and seed; recorded the runs | Phattaratorn supervised and opened the PR; Praewa reviewed and approved; the suite was re-run on the local PostgreSQL 17 database during the PR #16 review |
| I-02 API foundation | #4 · PR [#17](https://github.com/GGital/My-little-pony/pull/17) | Wrote the red tests, then errors, validation, origin check, clock, config, health | Phattaratorn supervised and opened the PR; Praewa reviewed and approved |
| I-03 client shell | #5 · PR [#16](https://github.com/GGital/My-little-pony/pull/16) | Generated UI shell, tokens, route guards, time formatting, and test stubs; addressed review fixes | Praewa implemented and answered three review rounds |
| PR #16 review, rounds 2 and 3 | PR #16 | Checked out the branch, ran both suites, the server on the real database, the live app and guard mutations; drafted the review text | Phattaratorn read the findings and posted the reviews. Round 1 (5 Nov, changes requested) was written by Phattaratorn without AI |
| I-04 sign in, who am I, sign out | #6 · PR [#18](https://github.com/GGital/My-little-pony/pull/18) | Wrote the red tests, the implementation, the sign-out fix (red → green), the docs and the PR draft; ran everything on the real database and in the browser | Phattaratorn set the scope and decisions, committed and opened the PR; Praewa reviewed and approved (5 Nov) |
| I-05 event list and detail | #7 · PR [#19](https://github.com/GGital/My-little-pony/pull/19) | Wrote red tests (TEST-F-01 … 05, TEST-C-06), domain and HTTP routes for E-04 / E-05, EventList and EventDetail client pages, ActionButton component, review fixes (M1–M5, S1–S5) and merge resolution | Praewa supervised, directed TDD steps, resolved merge conflicts, and committed |
| PR #19 review, rounds 1 and 2 | PR #19 | Replayed red and green, ran both suites on the real database (alone and merged with PR #18), probed E-04 / E-05 live and in the browser, mutation-checked the fixes; drafted both review texts | Phattaratorn read the findings and posted the reviews |
| I-06 role and ownership guards | #8 · PR [#20](https://github.com/GGital/My-little-pony/pull/20) | Wrote the red matrix test and probes, then `requireRole` and the owner-in-where helpers; ran everything on the real database; drafted the docs and PR text | Phattaratorn set the scope (probe form for E-06 … E-11), committed and opened the PR; Praewa reviewed and approved |
| I-07 create and publish event | #9 · PR [#21](https://github.com/GGital/My-little-pony/pull/21) | Wrote red tests (TEST-D-01 … 05), validation schema, domain rules, POST /api/events HTTP route and wiring, CreateEvent client page, client tests, and evidence; review fixes (M1–M3, S1–S4) and merge conflict resolution with I-08 | Praewa directed TDD steps, supervised implementation, resolved conflicts, and updated PR |
| I-08 registration with the last-seat lock | #10 · PR [#22](https://github.com/GGital/My-little-pony/pull/22) | Wrote the red tests (rules unit, API, 20-round race, client flow, the owed E-09 rows), the locked transaction, E-09, the Seats card flip, one explained test correction and the docs and PR text; ran everything on the real database, mutation-checked the lock, and checked the flow in the browser | Phattaratorn set the scope, committed and opened the PR; Praewa reviewed and approved |
| PR #21 review, rounds 1 and 2 (I-07) | PR [#21](https://github.com/GGital/My-little-pony/pull/21) | Replayed red and green on the real database, mutation-checked the BR-02 boundaries, the strict schema and the owner rule, probed E-06 live and through the form in the browser, trial-merged with I-08 and I-10, re-ran the escaped mutations in round 2; drafted both review texts | Phattaratorn read the findings and decides what to post |
| I-09 organizer event dashboard | #11 · PR [#24](https://github.com/GGital/My-little-pony/pull/24) | Wrote red tests (TEST-E-01, 02; Dashboard.test.tsx), domain query and HTTP route for E-07, Dashboard client page, wired route, updated authorization matrix, and recorded run evidence | Praewa directed TDD steps, supervised implementation, verified test runs, and opened the PR |
| PR #24 review and UI polish (I-09) | PR [#24](https://github.com/GGital/My-little-pony/pull/24) | Ran both suites on the real database after the I-10 merge and mutation-checked the owner filter and the sort; ran the Impeccable `audit` and `polish` of every Sprint 1 screen against the approved mock-up (theme, shared card, icon and state components, four explained test corrections); checked the pages in the browser at desktop and phone width with a mocked sign-in; wrote design-direction v0.3, contracts v1.10, STS v1.10 and the review text | Phattaratorn set the scope (polish inside PR #24, fixes committed on the branch), reviewed the result and decides what to push and post |
| I-10 My Events | #12 · PR [#23](https://github.com/GGital/My-little-pony/pull/23) | Wrote the red tests (E-10 / E-11 API, the owed TEST-A-04 and TEST-B rows, the page at component level), the owner-scoped queries, the routes, the My Events page, the docs and the PR text; ran everything on the real database, mutation-checked the owner rule, and checked the page in the browser as Mint, Nok and Quantum Cards | Phattaratorn set the scope, committed and merged PR #23; reviewed by Praewa |
| I-11 event registration list | #13 · PR [#25](https://github.com/GGital/My-little-pony/pull/25) | Wrote red tests (TEST-I-01 … 03; Registrations.test.tsx), domain query and HTTP route for E-08, Registrations client page, wired route, updated authorization matrix to use real E-08, and recorded run evidence | Praewa directed TDD steps, supervised implementation, verified test runs, and opened the branch |
| PR #25 review (I-11) | PR [#25](https://github.com/GGital/My-little-pony/pull/25) | Ran both suites on the real database and five mutations of E-08; strengthened TEST-I-01 (out-of-order data and a cancelled row) after the sort and status-filter mutations passed; made the page show the not-found page on 404 / 400 and use the theme table; removed the last probe; checked the page in the browser at desktop and phone width with mocked API answers; wrote the doc rows and the review text | Phattaratorn set the scope (fixes committed on the branch), reviewed the result and decides what to push and post |
| I-12 integration and release | #14 | Set up Playwright on the test database (fresh seed per file, E2E-only participant Fern); wrote the 40 E2E tests (journeys, three-width check, the E2E halves owed by I-04 … I-11) and the I-12 server cases; wrote the STS coverage script and the secret scan; ran every suite and the mutations; ran the restart check in the browser; filled STS §5 / §6, the traceability results, contracts v1.12 and the README | Phattaratorn agreed the split (builds, Praewa reviews), allowed the Playwright and Chromium download, and decides what to push, merge and tag; Praewa reviewed and approved PR [#26](https://github.com/GGital/My-little-pony/pull/26) (7 Nov) |
| Release errata and Deliverable 1 PDF | release PR | Checked the PDF draft against the deliverable brief (a Claude Sonnet sub-agent graded it); found the stale doc text fixed here (this page's two pending notes, the SDS client versions, the SRS version in the coverage checks, the student IDs); rendered the release documents, took the demonstration and GitHub screenshots with Playwright, and laid out the PDF pages in Canva from the team's Lab template | Phattaratorn chose the template and the fixes, answered the facts the AI could not know (round 1 of the PR #16 review), and decides what to push, merge and tag; Praewa reviews the errata and release PRs |
| Lab 5 plan and Issues | [#30](https://github.com/GGital/My-little-pony/issues/30) … [#38](https://github.com/GGital/My-little-pony/issues/38) | Read the Lab 5 handout, the Student Guide and the Starter Kit; wrote the plan and the nine Issue bodies, and created them with `gh` | Phattaratorn asked for the Issues, read them and set the board; GCP and GitHub settings stay with the students |
| L5-2 cloud-ready app | [#31](https://github.com/GGital/My-little-pony/issues/31) | Wrote the red tests TEST-L5-01 … 04, then static serving, `/api/ready`, the APP_ORIGIN list and SIGTERM shutdown; moved `prisma`/`tsx` to runtime deps; ran the suites on the real database and the app in the browser; drafted the docs and the PR text | Phattaratorn supervised, read the diff and opened PR [#39](https://github.com/GGital/My-little-pony/pull/39); Praewa reviewed and approved |
| L5-3 Docker | [#32](https://github.com/GGital/My-little-pony/issues/32) | Adapted the kit's Dockerfile, `.dockerignore`, entrypoint and Compose file to one container; added `.gitattributes`; built and ran the image locally, checked persistence, SIGTERM and the image for secrets; ran the fresh-clone check; drafted the docs and the PR text | Phattaratorn supervised, read the diff and opened PR [#40](https://github.com/GGital/My-little-pony/pull/40); Praewa reviewed and approved |
| L5-4 CI and deploy scripts | [#33](https://github.com/GGital/My-little-pony/issues/33) | Adapted the kit's `ci-docker.yml` (our scripts, test database, Playwright, staging branches), `dependabot.yml` and `deploy/` (names, one seed secret, APP_ORIGIN, cookie smoke sign-in) with their offline tests; mutation-checked the new stub assertions; dry-ran `deploy.sh`; replayed the CI steps locally; drafted the docs and the PR text | Phattaratorn supervised, read the diff and opened PR [#41](https://github.com/GGital/My-little-pony/pull/41) and release [#42](https://github.com/GGital/My-little-pony/pull/42); Praewa reviewed and approved both |
| L5-7 Deploy demo, release A | [#36](https://github.com/GGital/My-little-pony/issues/36) | Asked the team three decisions (skip smoke sign-in, show the running commit, keep Phattaratorn's comment trim); wrote the red tests TEST-L5-05 … 07 and the smoke commit check, then `GIT_SHA`, `GET /api/version`, the build footer and the Docker build argument; adapted the kit's `deploy.yml`; ran the suites, E2E and an image built with a SHA; drafted the docs and the PR text | Phattaratorn made the decisions, supervised, read the diff and opens the PR; the reviewer is filled in from the PR record |

## 3. How we supervise the agent

- The agent gets one Issue, its contract section and its test IDs, and works on that Issue only.
- Tests are committed and run red before the implementation. Run outputs are saved under
  `docs/sprints/sprint-1/evidence/`. An agent saying "all tests pass" is never evidence.
- A student runs the suites again locally against the real database, reads the diff, and the teammate reviews the
  PR with a specific check, question or finding. Authors do not approve their own PRs.
- No real secrets, passwords or tokens are given to the agent or written to Git; demo accounts use a local
  `SEED_PASSWORD`.
- Lab 5: the agent may read the cloud state but never runs a command that creates or changes GCP resources, billing,
  IAM or the database, and never sees a generated password; students run `deploy/deploy.sh` and every Console step.
  Lab 5 run outputs are saved under `docs/labs/lab05/evidence/`.
- Full prompt transcripts are not kept (spec §8.4); commit authorship and trailers show which commits the agent wrote.

## 4. Keeping this page current

Every Issue PR adds or updates its own row in §2 (and §1 if a new tool is used), in the same PR as the work, the
same way it fills its row in `sts.md` §5 and in [`contributions.md`](contributions.md).

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 6 Nov 2026 | First declaration: tools, tasks for PR #1, #2 and I-01 … I-04, supervision rules | Team (AI-assisted) |
| v0.2 | 6 Nov 2026 | Added Praewa tools, completed I-03 entry, and added I-05 row | Praewa (MeldyRose) |
| v0.3 | 6 Nov 2026 | PR #19 review rows, I-06 row | Team (AI-assisted) |
| v0.4 | 6 Nov 2026 | I-06 merged; I-08 merged (PR #22) | Team (AI-assisted) |
| v0.5 | 6 Nov 2026 | I-07 PR #21 updated with review fixes and merge resolution | Praewa (MeldyRose) |
| v0.6 | 6 Nov 2026 | PR #21 review rounds 1 and 2; I-10 row | Team (AI-assisted) |
| v0.7 | 6 Nov 2026 | I-09 organizer event dashboard assisted tasks declared | Praewa (MeldyRose) |
| v0.8 | 7 Nov 2026 | PR #24 review and UI polish declared | Team (AI-assisted) |
| v0.9 | 7 Nov 2026 | I-11 event registration list assisted tasks declared | Praewa (MeldyRose) |
| v0.10 | 7 Nov 2026 | PR #25 review declared | Team (AI-assisted) |
| v0.11 | 7 Nov 2026 | I-12 integration and release assisted tasks declared | Team (AI-assisted) |
| v0.12 | 7 Nov 2026 | Errata before the release: PR #16 round 1 and the I-04 review filled in from the PR record; PR #26 reviewer; release errata and PDF row; Sonnet sub-agent named; v0.11 date corrected (7 Nov) | Team (AI-assisted) |
| v0.13 | 13 Nov 2026 | Lab 5: plan and Issues #30 … #38, L5-2 row; supervision rule for cloud work | Team (AI-assisted) |
| v0.14 | 13 Nov 2026 | L5-2 row: PR #39 and its reviewer; L5-3 row | Team (AI-assisted) |
| v0.15 | 13 Nov 2026 | L5-3 row: PR #40 and its reviewer; L5-4 row | Team (AI-assisted) |
| v0.16 | 13 Nov 2026 | L5-4 row: PRs #41, #42 and their reviewer; L5-7 row | Team (AI-assisted) |
