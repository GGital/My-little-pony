# Contribution table

Project: **TCG Event Hub** · CPE 334 group project (Theme 3) · Kept current by every Issue PR (see the last section)

| Student | GitHub | Student ID |
|---|---|---|
| Phattaratorn Mahatkeerati | `GGital` | *to fill* |
| Praewa Thuwatharanimitkul | `MeldyRose` | *to fill* |

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
| I-07 Feature-D: create and publish event | [#9](https://github.com/GGital/My-little-pony/issues/9) | — | Praewa (assigned) | Phattaratorn | Planned |
| I-08 Feature-G: registration with seat lock | [#10](https://github.com/GGital/My-little-pony/issues/10) | `feature/s1-08-registration` · PR (to open) | Phattaratorn | Praewa | In progress |
| I-09 Feature-E: organizer dashboard | [#11](https://github.com/GGital/My-little-pony/issues/11) | — | Praewa (assigned) | Phattaratorn | Planned |
| I-10 Feature-H: My Events | [#12](https://github.com/GGital/My-little-pony/issues/12) | — | Phattaratorn (assigned) | Praewa | Planned |
| I-11 Feature-I: registration list | [#13](https://github.com/GGital/My-little-pony/issues/13) | — | Praewa (assigned) | Phattaratorn | Planned |
| I-12 Integration, journeys, release | [#14](https://github.com/GGital/My-little-pony/issues/14) | — | Both (pair) | Both | Planned |

## 2. Summary per student (Sprint 1 so far)

| Student | Built | Reviewed | Learning outcomes touched (spec §2) |
|---|---|---|---|
| Phattaratorn | Baseline documents (PR #1, #2), I-01, I-02, I-04, I-06, I-08 (in progress) | PR #16 (three rounds), PR #19 (two rounds), each tested on the real database | Requirements and design, server implementation, TDD, AI supervision, review |
| Praewa | I-03, I-05 | PR #1, #2, #15, #17, #18, #20 | Requirements and design review, client and server implementation, TDD, review |

Both students must be able to explain a sampled requirement, test, design decision and release step. The plan gives
each student server and client Issues in Sprint 1 (I-05 … I-11 alternate), and I-12 is pair work.

## 3. Keeping this table current

Every Issue PR updates its own row (branch, PR, built by, reviewed by, status) and the summary in §2, in the same PR
as the work. Pair work names both students. Reviewers are filled in from the PR's review record, not in advance.

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 6 Nov 2026 | First table: PR #1, #2, I-01 … I-04, planned I-05 … I-12 | Team (AI-assisted) |
| v0.2 | 6 Nov 2026 | Updated I-05 row and Praewa summary | Praewa (MeldyRose) |
| v0.3 | 6 Nov 2026 | I-04 and I-05 merged with their reviewers; I-06 in progress; summaries updated | Team (AI-assisted) |
| v0.4 | 6 Nov 2026 | I-06 merged with its reviewer; I-08 in progress | Team (AI-assisted) |
