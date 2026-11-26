# Contribution table

Project: **TCG Event Hub** · CPE 334 group project (Theme 3) · Kept current by every Issue PR (see the last section)

| Student | GitHub | Student ID |
|---|---|---|
| Phattaratorn Mahatkeerati | `GGital` | 67070503433 |
| Praewa Thuwatharanimitkul | `MeldyRose` | 67070503432 |

Equal commit counts are not required (group spec §2). The table shows who built and who reviewed each item, from
the Issues, branches and PRs. AI assistance is listed in [`ai-use.md`](ai-use.md).

## 1. Sprint 1

| Item | Issue | Branch · PR | Built by | Reviewed by | Status |
|---|---|---|---|---|---|
| Baseline: SRS, features, traceability, UI direction | — | `sprint-1/spec` · [#1](https://github.com/GGital/My-little-pony/pull/1) | Phattaratorn | Praewa (approved 4 Nov) | Merged 4 Nov |
| SDS, three-sprint plan, Sprint 1 contracts, STS, DoD | — | `sprint-1/sds` · [#2](https://github.com/GGital/My-little-pony/pull/2) | Phattaratorn | Praewa (approved 4 Nov) | Merged 4 Nov |
| I-01 Data foundation (SR-01) | [#3](https://github.com/GGital/My-little-pony/issues/3) | `feature/s1-01-data-foundation` · [#15](https://github.com/GGital/My-little-pony/pull/15) | Phattaratorn | Praewa (approved 4 Nov) | Merged 5 Nov |
| I-02 API foundation (SR-02, SR-03, SR-04) | [#4](https://github.com/GGital/My-little-pony/issues/4) | `feature/s1-02-api-foundation` · [#17](https://github.com/GGital/My-little-pony/pull/17) | Phattaratorn | Praewa (approved 5 Nov) | Merged 5 Nov |
| I-03 Client shell (Feature-C) | [#5](https://github.com/GGital/My-little-pony/issues/5) | `feature/s1-03-client-shell` · [#16](https://github.com/GGital/My-little-pony/pull/16) | Praewa | Phattaratorn (2 × changes requested, then approved 5 Nov) | Merged 5 Nov |
| I-04 Feature-A: sign in, who am I, sign out | [#6](https://github.com/GGital/My-little-pony/issues/6) | `feature/s1-04-auth` · [#18](https://github.com/GGital/My-little-pony/pull/18) | Phattaratorn | Praewa (approved 5 Nov) | Merged 5 Nov |
| I-05 Feature-F: event list and detail | [#7](https://github.com/GGital/My-little-pony/issues/7) | `feature/s1-05-event-discovery` · [#19](https://github.com/GGital/My-little-pony/pull/19) | Praewa | Phattaratorn (1 × changes requested, then approved 6 Nov) | Merged 6 Nov |
| I-06 Feature-B: role and ownership guards | [#8](https://github.com/GGital/My-little-pony/issues/8) | `feature/s1-06-access-control` · [#20](https://github.com/GGital/My-little-pony/pull/20) | Phattaratorn | Praewa (approved 6 Nov) | Merged 6 Nov |
| I-07 Feature-D: create and publish event | [#9](https://github.com/GGital/My-little-pony/issues/9) | `feature/s1-07-create-event` · [#21](https://github.com/GGital/My-little-pony/pull/21) | Praewa | Phattaratorn (1 × changes requested, then approved 6 Nov) | Merged 6 Nov |
| I-08 Feature-G: registration with seat lock | [#10](https://github.com/GGital/My-little-pony/issues/10) | `feature/s1-08-registration` · [#22](https://github.com/GGital/My-little-pony/pull/22) | Phattaratorn | Praewa (approved 6 Nov) | Merged 6 Nov |
| I-09 Feature-E: organizer dashboard | [#11](https://github.com/GGital/My-little-pony/issues/11) | `feature/s1-09-organizer-dashboard` · [#24](https://github.com/GGital/My-little-pony/pull/24) | Praewa (dashboard); Phattaratorn (review fixes, app-wide UI polish) | Phattaratorn (approved 7 Nov) | Merged 7 Nov |
| I-10 Feature-H: My Events | [#12](https://github.com/GGital/My-little-pony/issues/12) | `feature/s1-10-my-events` · [#23](https://github.com/GGital/My-little-pony/pull/23) | Phattaratorn | Praewa (approved 6 Nov) | Merged 6 Nov |
| I-11 Feature-I: registration list | [#13](https://github.com/GGital/My-little-pony/issues/13) | `feature/s1-11-registration-list` · [#25](https://github.com/GGital/My-little-pony/pull/25) | Praewa (registration list); Phattaratorn (review fixes) | Phattaratorn (approved 7 Nov) | Merged 7 Nov |
| I-12 Integration, journeys, release | [#14](https://github.com/GGital/My-little-pony/issues/14) | `feature/s1-12-integration-release` · [#26](https://github.com/GGital/My-little-pony/pull/26) | Phattaratorn (E2E suite, release evidence; pair Issue, agreed split) | Praewa (approved 7 Nov) | Merged 7 Nov |

## 2. Summary per student (Sprint 1)

| Student | Built | Reviewed | Learning outcomes touched (spec §2) |
|---|---|---|---|
| Phattaratorn | Baseline documents (PR #1, #2), I-01, I-02, I-04, I-06, I-08, I-10, I-12 (merged) | PR #16 (three rounds), PR #19 (two rounds), PR #21 (two rounds), PR #24 (with the UI polish), PR #25, each tested on the real database | Requirements and design, server implementation, TDD, AI supervision, review |
| Praewa | I-03, I-05, I-07, I-09, I-11 (merged) | PR #1, #2, #15, #17, #18, #20, #22, #23, #26 | Requirements and design review, client and server implementation, TDD, review |

Both students must be able to explain a sampled requirement, test, design decision and release step. The plan gives
each student server and client Issues in Sprint 1 (I-05 … I-11 alternate), and I-12 is pair work.

## 3. Lab 5: cloud deployment and CI/CD on GCP

Issues are labelled `lab5` (handout R-10). Builders and reviewers are filled in from the PR record as each Issue moves; R-11 asks both students to take part in every kind of work, so no Issue has a fixed owner.

| Item | Issue | Branch · PR | Built by | Reviewed by | Status |
|---|---|---|---|---|---|
| L5-1 Cloud preparation: GCP project, budget, repo safety | [#30](https://github.com/GGital/My-little-pony/issues/30) | no branch (Console) | Praewa (credits, budget, billing check; evidence on #30) | Phattaratorn (checked the evidence, closed 12 Nov) | Done 12 Nov |
| L5-2 Cloud-ready app: /api/ready, one container, APP_ORIGIN list | [#31](https://github.com/GGital/My-little-pony/issues/31) | `refactor/l5-2-cloud-ready` · [#39](https://github.com/GGital/My-little-pony/pull/39) | Phattaratorn | Praewa (approved 13 Nov) | Merged 13 Nov |
| L5-3 Docker: one image, Compose, fresh clone | [#32](https://github.com/GGital/My-little-pony/issues/32) | `build/l5-3-docker` · [#40](https://github.com/GGital/My-little-pony/pull/40) | Phattaratorn | Praewa (approved 13 Nov) | Merged 13 Nov |
| L5-4 CI on PRs and adapted deploy scripts | [#33](https://github.com/GGital/My-little-pony/issues/33) | `ci/l5-4-pr-checks` · [#41](https://github.com/GGital/My-little-pony/pull/41); release [#42](https://github.com/GGital/My-little-pony/pull/42) | Phattaratorn | Praewa (approved #41 and #42, 13 Nov) | Merged 13 Nov |
| L5-5 First deployment to GCP | [#34](https://github.com/GGital/My-little-pony/issues/34) | no branch (Cloud Shell, `deploy/deploy.sh`) | Praewa (Cloud Run, Cloud SQL, Secret Manager, Artifact Registry; evidence on #34) | Phattaratorn (checked the evidence) | Done 13 Nov |
| L5-6 WIF and the merge gate | [#35](https://github.com/GGital/My-little-pony/issues/35) | no branch; `test/l5-prove-gate` · [#43](https://github.com/GGital/My-little-pony/pull/43) (closed unmerged) | Praewa (WIF pool and provider, deployer SA, environment `demo`, ruleset `protect-main`, the failing gate PR; evidence on #35) | Phattaratorn (checked the evidence) | Done 13 Nov |
| L5-7 Auto deploy, releases A and B | [#36](https://github.com/GGital/My-little-pony/issues/36) | `ci/l5-7-auto-deploy` · [#44](https://github.com/GGital/My-little-pony/pull/44), release A [#45](https://github.com/GGital/My-little-pony/pull/45) ([Deploy demo](https://github.com/GGital/My-little-pony/actions/runs/43476752828), `906158e`); `feature/l5-7-deploy-proof` · [#46](https://github.com/GGital/My-little-pony/pull/46), release B [#47](https://github.com/GGital/My-little-pony/pull/47) ([Deploy demo](https://github.com/GGital/My-little-pony/actions/runs/43604904531), `267f1e5`) | Phattaratorn (release A and release B) | Praewa (approved #44, #45, #46 and #47, 14 Nov) | Done 14 Nov: releases A and B deployed by the pipeline |
| L5-8 Persistence, rollback, roll-forward | [#37](https://github.com/GGital/My-little-pony/issues/37) | `feature/l5-8-persistence` (TEST-L5-09 and the evidence) · [#48](https://github.com/GGital/My-little-pony/pull/48) | Phattaratorn (created event 7, ran the restart, rollback [run #7](https://github.com/GGital/My-little-pony/actions/runs/43610598970) and roll-forward [run #8](https://github.com/GGital/My-little-pony/actions/runs/43611074299)) | Praewa (approved #48, 14 Nov) | Done 14 Nov |
| L5-9 deployment.md, evidence index, PDF | [#38](https://github.com/GGital/My-little-pony/issues/38) | `docs/l5-9-deployment-doc` · [#49](https://github.com/GGital/My-little-pony/pull/49), [#50](https://github.com/GGital/My-little-pony/pull/50); `docs/l5-9-contributions` (this table); release [#51](https://github.com/GGital/My-little-pony/pull/51) ([Deploy demo](https://github.com/GGital/My-little-pony/actions/runs/43615810627), `38e4cb9`); [#52](https://github.com/GGital/My-little-pony/pull/52), release [#53](https://github.com/GGital/My-little-pony/pull/53) (`1f3dcfc`); `docs/l5-9-merge-gate` (merge-gate row: up to date is on) | Phattaratorn (C-04 capture, 2x evidence, labels, the PDF) | Praewa (approved #49 to #53, 14 Nov) | Docs done 15 Nov; PDF rebuilt in the Lab 4 layout (due on LEB2 15 Nov 23:59) |

## 4. Lab 6: independent UAT and defect management

UAT findings from Team 1 KitLoop are Issues #56–#64; the triage is Part 4 of the UAT pack. Builders and reviewers are filled in from the PR record.

| Item | Issue | Branch · PR | Built by | Reviewed by | Status |
|---|---|---|---|---|---|
| L6 triage of received findings | [#56](https://github.com/GGital/My-little-pony/issues/56)–[#64](https://github.com/GGital/My-little-pony/issues/64) | no branch (UAT pack Part 4, Issue comments) | Phattaratorn (severity decisions; drafted with Claude Code) | Praewa (to confirm) | Severities decided 20 Nov |
| L6-62 Session ended: message and redirect to sign-in | [#62](https://github.com/GGital/My-little-pony/issues/62) | `fix/l6-62-session-ended` · [#66](https://github.com/GGital/My-little-pony/pull/66) | Phattaratorn | Praewa (approved #66, 20 Nov) | Merged 20 Nov (`fd112ee`); red `7f44943`, green `ce3bd7d` |
| L6-63 U+0000 refused with a field-level 400 | [#63](https://github.com/GGital/My-little-pony/issues/63) | `fix/l6-63-nul-character` · [#68](https://github.com/GGital/My-little-pony/pull/68) | Phattaratorn | Praewa (approved #68, 20 Nov) | Merged 20 Nov (`a68ed9a`); red `2de61d4`, green `b81fb83` |
| L6 CI runner pinned to ubuntu-24.04 (Playwright could not install Chromium on 26.04) | — | `ci/l6-e2e-runner` · [#67](https://github.com/GGital/My-little-pony/pull/67) | Phattaratorn | Praewa (approved #67, 20 Nov) | Merged 20 Nov (`7fe21b7`) |
| L6-56 Title overflow: wrap 100-character title and prevent seat info clipping | [#56](https://github.com/GGital/My-little-pony/issues/56) | `fix/issue-56-title-overflow` · [#65](https://github.com/GGital/My-little-pony/pull/65) | Praewa | Phattaratorn (approved #65, 20 Nov) | Merged 20 Nov (`c5e88ea`); red `1310749`, green `7ffc09e` |
| L6-58 A tab follows a session change made in another tab (Major) | [#58](https://github.com/GGital/My-little-pony/issues/58) | `fix/l6-58-tab-account-sync` · [#69](https://github.com/GGital/My-little-pony/pull/69) | Phattaratorn | Praewa (approved #69, 20 Nov) | Merged 20 Nov (`ba15990`); red `35fac94`, green `40fd67f` |
| L6-60 Malformed returnTo refused after sign-in | [#60](https://github.com/GGital/My-little-pony/issues/60) | `fix/l6-60-safe-return-to` · [#70](https://github.com/GGital/My-little-pony/pull/70) | Phattaratorn | Praewa (approved #70, 20 Nov) | Merged 20 Nov (`528fa0c`); red `1a61929`, green `f15d9d6` |
| L6-57 Impossible calendar dates refused | [#57](https://github.com/GGital/My-little-pony/issues/57) | `fix/l6-57-calendar-date` · [#71](https://github.com/GGital/My-little-pony/pull/71) | Phattaratorn | Praewa (approved #71, 20 Nov) | Merged 20 Nov (`d4d251e`); red `b35fe87`, green `b28cc55` |
| L6-61 Signed-in user on /login goes on | [#61](https://github.com/GGital/My-little-pony/issues/61) | `fix/l6-61-login-when-signed-in` · [#72](https://github.com/GGital/My-little-pony/pull/72) | Phattaratorn | Praewa (approved #72, 20 Nov) | Merged 20 Nov (`6f7c5ba`); red `a317329`, green `4dd625b` |
| L6-59 Long contact stays inside the event page | [#59](https://github.com/GGital/My-little-pony/issues/59) | `fix/l6-59-contact-overflow` · [#73](https://github.com/GGital/My-little-pony/pull/73) | Phattaratorn | Praewa (approved #73, 20 Nov) | Merged 20 Nov (`62615bb`); red `46af54f`, green `5302003` |

## 5. Sprints 2 and 3

| Item | Issue | Branch · PR | Built by | Reviewed by | Status |
|---|---|---|---|---|---|
| S2-00 / S3-00 Sprint 2 and 3 contracts, STS, Issue plans; SRS v0.7 (CH-11, CH-12), features, plan, SDS, traceability, UI direction | (to be created) | `docs/s2-s3-contracts` · [#76](https://github.com/GGital/My-little-pony/pull/76) | Phattaratorn (directed; drafted with Claude Code, see `ai-use.md`) | (filled in from the PR's review record) | In review |
| S2-10 Deep Lagoon theme and type (Issue #86, D-38) | (to be created) | `feature/s2-10-theme` | MeldyRose (drafted with Claude Code, see `ai-use.md`) | (filled in from the PR's review record) | In review |
| S2-00 / S3-00 Sprint 2 and 3 contracts, STS, Issue plans; SRS v0.7 (CH-11, CH-12), features, plan, SDS, traceability, UI direction | Issues [#78](https://github.com/GGital/My-little-pony/issues/78)–[#87](https://github.com/GGital/My-little-pony/issues/87) created 23 Nov | `docs/s2-s3-contracts` · [#76](https://github.com/GGital/My-little-pony/pull/76) | Phattaratorn (directed; drafted with Claude Code, see `ai-use.md`) | Praewa (approved #76, 21 Nov) | Merged 21 Nov (`40d3699`) |
| CH-13 merged into the Sprint 2 line; Sprint 2 contracts v0.6 and STS v0.5 use the 60-minute lead time | [#77](https://github.com/GGital/My-little-pony/issues/77) | `chore/s2-sync-ch13` · (PR to be opened) | Phattaratorn (directed; drafted with Claude Code, see `ai-use.md`) | Praewa (requested when the PR opens) | In progress |
| S2-01 SR-08 data foundation: migrations `0003`, `0004`, change history, E-17, seed EV-7 … EV-9 | [#78](https://github.com/GGital/My-little-pony/issues/78) | `feature/s2-01-data-foundation` · (PR to be opened) | Phattaratorn (directed; drafted with Claude Code, see `ai-use.md`) | Praewa (requested when the PR opens) | In review: red `7c3ad62`, green `dc987f9` + fixtures `dfa124f` |
| S2-02 Feature-K: save a draft and publish it (E-06 `saveAsDraft`, E-14, owner-only drafts) | [#79](https://github.com/GGital/My-little-pony/issues/79) | `feature/s2-02-drafts` · (PR to be opened) | Phattaratorn (directed; drafted with Claude Code, see `ai-use.md`) | Praewa (requested when the PR opens) | In review: red `47b3838`, green `40f5687` |
| S2-03 Feature-J: search, filters and paging (E-04 query and meta, live search bar, filter chips) | [#80](https://github.com/GGital/My-little-pony/issues/80) | `feature/s2-03-search` · [#94](https://github.com/GGital/My-little-pony/pull/94) | MeldyRose (drafted with Claude Code, see `ai-use.md`) | GGital (review on the real database: literal `%` and `_`, TEST-J-05 steps, theme tokens) | In review: red `82b7aa9`, green `2c5e075`, review fixes `18564ab`, `a0a86f3`, `23d5526` |
| S2-04 Feature-L: edit an event and change its capacity (E-13, edit page, History panel); UAT #64 | [#81](https://github.com/GGital/My-little-pony/issues/81) | `feature/s2-04-edit-event` · (PR to be opened) | Phattaratorn (directed; drafted with Claude Code, see `ai-use.md`) | Praewa (requested when the PR opens) | In review: red `0906f89`, green `9f71b81` |
| Merge rules for parallel PRs: `AGENTS.md`, `CLAUDE.md`, `merge=union`, evidence only when asked, D-39 → D-40 | — | `chore/merge-rules` · (PR to be opened) | Phattaratorn (directed; drafted with Claude Code, see `ai-use.md`) | Praewa (requested when the PR opens) | In review |

## 6. Lab 7: Sprint 1 maintenance (CH-13)

One approved change to BR-02 (a new event must start at least 60 minutes after it is created). Contract first, then
tests, then code; the evidence index is [`labs/lab07/README.md`](labs/lab07/README.md).

| Item | Issue | Branch · PR | Built by | Reviewed by | Status |
|---|---|---|---|---|---|
| L7 change request and contract revision (SRS, contracts, STS, SDS, traceability) | [#77](https://github.com/GGital/My-little-pony/issues/77) | `feature/l7-ch13-lead-time` · [#88](https://github.com/GGital/My-little-pony/pull/88) | Phattaratorn (TA approval obtained 23 Nov) | Praewa (approved #88, 24 Nov) | Merged 24 Nov (`a44fcac`); contract commit `751e9cd` |
| L7 tests, implementation and evidence | [#77](https://github.com/GGital/My-little-pony/issues/77) | `feature/l7-ch13-code` · [#89](https://github.com/GGital/My-little-pony/pull/89) | Phattaratorn | Praewa (approved #89, 24 Nov) | Merged 24 Nov (`816230a`); red `f41f52f`, green `72ae022`, evidence `68d4377` |
| L7 release to `main` and deploy | [#77](https://github.com/GGital/My-little-pony/issues/77) | `sprint-1-staging` · [#90](https://github.com/GGital/My-little-pony/pull/90) | Phattaratorn (release PR, tag, live checks with Claude Code; signed in by hand) | Praewa (approved #90, 24 Nov) | Merged 24 Nov (`dff72b6`), tag `v0.1.2`; Cloud Run `tcg-event-hub-00018-s6f`; L7-D01, L7-D02 PASS |
| L7 release and deploy records (README v1.1) | [#77](https://github.com/GGital/My-little-pony/issues/77) | `docs/l7-release-records` · [#91](https://github.com/GGital/My-little-pony/pull/91) | Phattaratorn | Praewa (approved #91, 24 Nov) | Merged 24 Nov (`be04c17`) |

## 7. Keeping this table current

From 26 Nov 2026 the rules in [`AGENTS.md`](../AGENTS.md) §2 apply: each PR adds only its own Issue's row with the status `In review (PR #N)`, and labels its version rows with its Issue ID. The sprint's integration Issue numbers the versions and marks the rows `Merged (sha)` in one records commit.

Every Issue PR updates its own row (branch, PR, built by, reviewed by, status) and the summary in §2, in the same PR
as the work. Pair work names both students. Reviewers are filled in from the PR's review record, not in advance.

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 6 Nov 2026 | First table: PR #1, #2, I-01 … I-04, planned I-05 … I-12 | Team (AI-assisted) |
| v0.2 | 6 Nov 2026 | Updated I-05 row and Praewa summary | Praewa (MeldyRose) |
| v0.3 | 6 Nov 2026 | I-04 and I-05 merged with their reviewers; I-06 in progress; summaries updated | Team (AI-assisted) |
| v0.4 | 6 Nov 2026 | I-06 merged with its reviewer; I-08 merged (PR #22) | Team (AI-assisted) |
| v0.5 | 6 Nov 2026 | I-07 PR #21 in progress; Praewa and Phattaratorn summaries updated | Praewa (MeldyRose) |
| v0.6 | 6 Nov 2026 | I-07 merged with its reviewer; PR #21 review rounds; I-10 in progress | Team (AI-assisted) |
| v0.7 | 6 Nov 2026 | I-09 Feature-E organizer dashboard implemented; Praewa summary updated | Praewa (MeldyRose) |
| v0.8 | 7 Nov 2026 | I-09 in review as PR #24; Phattaratorn's review fixes and UI polish recorded | Team (AI-assisted) |
| v0.9 | 7 Nov 2026 | I-09 merged; I-11 Feature-I event registration list implemented; Praewa summary updated | Praewa (MeldyRose) |
| v0.10 | 7 Nov 2026 | I-11 in review as PR #25; Phattaratorn's review fixes recorded | Team (AI-assisted) |
| v0.11 | 7 Nov 2026 | I-11 merged; I-12 in progress (Phattaratorn builds, Praewa reviews) | Team (AI-assisted) |
| v0.12 | 7 Nov 2026 | Student IDs filled in; I-11 approval date; I-12 merged (PR #26, approved by Praewa); summaries; v0.11 date corrected (7 Nov) | Team (AI-assisted) |
| v0.13 | 13 Nov 2026 | §3 Lab 5 table: Issues #30 … #38; L5-2 in progress | Team (AI-assisted) |
| v0.14 | 13 Nov 2026 | L5-2 merged (PR #39, approved by Praewa); L5-3 in progress | Team (AI-assisted) |
| v0.15 | 13 Nov 2026 | L5-3 merged (PR #40, approved by Praewa); L5-4 in progress | Team (AI-assisted) |
| v0.16 | 13 Nov 2026 | L5-4 merged (PR #41 and release #42, approved by Praewa); L5-7 in progress | Team (AI-assisted) |
| v0.17 | 14 Nov 2026 | L5-7: PR #44 and release A #45 deployed by the pipeline (`906158e`); release B built by Phattaratorn (team change: not Praewa as planned) | Team (AI-assisted) |
| v0.18 | 14 Nov 2026 | L5-7 done (release B #46 / #47, `267f1e5`); L5-8 checks: event 7 survived restart, rollback to A and roll-forward to B | Team (AI-assisted) |
| v0.19 | 14 Nov 2026 | L5-8 done (#48); L5-9 in progress: deployment.md v1.0, evidence index, C-04 captures; `lab5` label on PRs #39 to #44 | Team (AI-assisted) |
| v0.20 | 14 Nov 2026 | L5-9: #49 merged (approved by Praewa); follow-up PR with the ruleset correction (`main` only) and the 2x evidence capture of the ruleset and the Episode 7 screenshots | Team (AI-assisted) |
| v0.21 | 14 Nov 2026 | L5-1, L5-5, L5-6 rows: built by Praewa, checked by Phattaratorn (team record, 14 Nov); L5-9: #49, #50, release #51 (`38e4cb9`) | Team (AI-assisted) |
| v0.22 | 15 Nov 2026 | L5-9: #52, release #53 (`1f3dcfc`); merge-gate row in deployment.md v1.1 (up to date before merging is on) | Team (AI-assisted) |
| v0.23 | 20 Nov 2026 | §4 Lab 6 table: triage of #56–#64; L6-62 in progress | Team (AI-assisted) |
| v0.24 | 20 Nov 2026 | §4 Lab 6: #62 merged (#66), #63 merged (#68), CI runner pin (#67), L6-58 in progress | Team (AI-assisted) |
| v0.25 | 21 Nov 2026 | §4 Lab 6: #58 merged (#69), #60 merged (#70), #57 merged (#71), #56 merged (#65, approved by Phattaratorn); L6-61 in review (#72) | Team (AI-assisted) |
| v0.26 | 21 Nov 2026 | §4 Lab 6: #61 merged (#72), #59 merged (#73); all eight accepted defects on `sprint-1-staging`, release to `main` and KitLoop retest pending | Team (AI-assisted) |
| v0.27 | 21 Nov 2026 | §5 Sprints 2 and 3 added (contracts PR row); the maintenance section becomes §6 | Team (AI-assisted) |
| v0.28 | 21 Nov 2026 | §5: PR #76 linked; CH-12 added to its scope | Team (AI-assisted) |
| v0.26.1 | 24 Nov 2026 | §5 Lab 7 CH-13 rows (#88 merged; tests, code and evidence); "Keeping this table current" becomes §6 | Team (AI-assisted) |
| v0.26.2 | 25 Nov 2026 | §5 Lab 7: #89 merged, release #90 (`v0.1.2`, revision `tcg-event-hub-00018-s6f`), records PR row | Team (AI-assisted) |
| v0.29 | 25 Nov 2026 | Lab 7 CH-13 merged into the Sprint 2 line: its rows become §6 and "Keeping this table current" §7; §5 contracts row: #76 merged, Issues #78–#87; §6 #91 merged (`be04c17`) | Team (AI-assisted) |
| v0.30 | 25 Nov 2026 | §5: CH-13 sync row | Team (AI-assisted) |
| v0.31 | 25 Nov 2026 | §5: S2-01 row | Team (AI-assisted) |
| v0.33 | 25 Nov 2026 | §5: S2-02 row (v0.32 is the Sprint 3 Issues row on `docs/s3-contracts-d2`) | Team (AI-assisted) |
| v0.34 | 26 Nov 2026 | §5: S2-03 row (rebased onto #95 and #107) | Team (AI-assisted) |
| v0.35 | 26 Nov 2026 | §5: #107 merged; S2-04 row | Team (AI-assisted) |
| rules | 26 Nov 2026 | §5 merge-rules row; §7 points at `AGENTS.md` §2 | Team (AI-assisted) |
