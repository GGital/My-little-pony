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
| L5-1 Cloud preparation: GCP project, budget, repo safety | [#30](https://github.com/GGital/My-little-pony/issues/30) | no branch (Console) | — | — | Planned |
| L5-2 Cloud-ready app: /api/ready, one container, APP_ORIGIN list | [#31](https://github.com/GGital/My-little-pony/issues/31) | `refactor/l5-2-cloud-ready` · [#39](https://github.com/GGital/My-little-pony/pull/39) | Phattaratorn | Praewa (approved 13 Nov) | Merged 13 Nov |
| L5-3 Docker: one image, Compose, fresh clone | [#32](https://github.com/GGital/My-little-pony/issues/32) | `build/l5-3-docker` · [#40](https://github.com/GGital/My-little-pony/pull/40) | Phattaratorn | Praewa (approved 13 Nov) | Merged 13 Nov |
| L5-4 CI on PRs and adapted deploy scripts | [#33](https://github.com/GGital/My-little-pony/issues/33) | `ci/l5-4-pr-checks` · [#41](https://github.com/GGital/My-little-pony/pull/41); release [#42](https://github.com/GGital/My-little-pony/pull/42) | Phattaratorn | Praewa (approved #41 and #42, 13 Nov) | Merged 13 Nov |
| L5-5 First deployment to GCP | [#34](https://github.com/GGital/My-little-pony/issues/34) | no branch (Cloud Shell) | — | — | Planned |
| L5-6 WIF and the merge gate | [#35](https://github.com/GGital/My-little-pony/issues/35) | no branch; `test/l5-prove-gate` | — | — | Planned |
| L5-7 Auto deploy, releases A and B | [#36](https://github.com/GGital/My-little-pony/issues/36) | `ci/l5-7-auto-deploy` · PR pending; `feature/l5-7-deploy-proof` (release B) | Phattaratorn (release A); Praewa (release B) | — | In progress |
| L5-8 Persistence, rollback, roll-forward | [#37](https://github.com/GGital/My-little-pony/issues/37) | no branch (Actions, Console) | — | — | Planned |
| L5-9 deployment.md, evidence index, PDF | [#38](https://github.com/GGital/My-little-pony/issues/38) | `docs/l5-9-deployment-doc` | — | — | Planned |

## 4. Keeping this table current

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
