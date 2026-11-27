# Sprint 3: engineering contracts, tests and Definition of Done

Project: **TCG Event Hub** · Sprint 3 (23 Nov – 13 Dec 2026) · Version v0.2 — **draft for team review** (changes in §6)

| Document | What it is |
|---|---|
| [`feature-contracts.md`](feature-contracts.md) | One contract each for Feature-P, Q, R, S, T, V, W, X and SR-05, SR-06, SR-07: design, UI/API/data, 53 acceptance criteria |
| [`sts.md`](sts.md) | Software Test Specification: planned tests, AC → test map, BR rejection map, TDD record, results |
| This file | Sprint goal, Issue plan, remaining-work table, Definition of Done |

**Sprint goal** ([`../plan.md`](../plan.md) §4): organizers check players in at the door and see real attendance;
players see their history; stores show their logo and banners; tournament events run Swiss rounds with results,
standings and a winner (CH-12); the product is hardened for accessibility,
performance and sign-in abuse, and released as `v1.0.0` by 13 Dec.

---

## 1. How the documents connect

This is the same chain as Sprint 1 README §1 and Sprint 2 README §1. `AC-P-04` → `TEST-P-04` → a test named
`TEST-P-04 …` in `checkin.api.test.ts`.

## 2. Issue plan

There is one GitHub Issue per row (label `sprint-3`, milestone "Sprint 3 · Final delivery"; created 25 Nov 2026).
Branches start from `sprint-3-staging`, named `feature/s3-<n>-<slug>` and created with `--no-track`.
`sprint-3-staging` was cut on 25 Nov from `sprint-2-staging` `4d75208` (S2-01 and the CH-13 sync merged), and took
the rest of `sprint-2-staging` on 27 Nov, after `v0.2.0` was released (PR #117). The contracts (S3-00) were reviewed
and merged with the Sprint 2 contracts in PR #76 (21 Nov). Deliverable 2 asks for the Sprint 3 specification documents
to be complete, as they were for Sprints 1 and 2 before their code, and not for Sprint 3 code. So no Sprint 3 feature
branch starts before **30 Nov** (team decision 27 Nov; [`../plan.md`](../plan.md), revised schedule of 27 Nov).

| Issue | GitHub | Title | Contract | Tests it must make pass | Depends on | Student | Target |
|---|---|---|---|---|---|---|---|
| S3-00 | PR #76, #118 | Sprint 3 contracts and STS (this folder); Deliverable 2 check | all | — (documents) | — | both | Sun 22 Nov · 29 Nov |
| S3-01 | [#96](https://github.com/GGital/My-little-pony/issues/96) | Feature-P: check-in and undo (+ seed EV-10) | §1 | TEST-P-01 … 06 | `v0.2.0` | 1 (Phattaratorn) | 30 Nov – Tue 1 Dec |
| S3-05 | [#97](https://github.com/GGital/My-little-pony/issues/97) | Feature-T: sign-in throttling | §5 | TEST-T-01 … 05 | `v0.2.0` | 2 (Praewa) | 30 Nov – Tue 1 Dec |
| S3-02 | [#98](https://github.com/GGital/My-little-pony/issues/98) | Feature-Q: attendance report | §2 | TEST-Q-01 … 05 | S3-01 | 1 (Phattaratorn) | Wed 2 Dec |
| S3-06 | [#99](https://github.com/GGital/My-little-pony/issues/99) | Feature-V: store logo and event banner (bucket, API, UI) | §6 | TEST-V-01 … 07 | S2-09 | 2 (Praewa) | 30 Nov (API) · 8 Dec (UI) |
| S3-03 | [#100](https://github.com/GGital/My-little-pony/issues/100) | Feature-R: organizer summary | §3 | TEST-R-01 … 05 | S3-02 | 1 (Phattaratorn) | Thu 3 Dec |
| S3-04 | [#101](https://github.com/GGital/My-little-pony/issues/101) | Feature-S: participant history | §4 | TEST-S-01 … 05 | S3-01 | 2 (Praewa) | Fri 4 Dec |
| S3-10 | [#102](https://github.com/GGital/My-little-pony/issues/102) | Feature-W: Swiss pairing engine, start, rounds, drops | §7 | TEST-W-01 … 07 | S3-01 | 1 (Phattaratorn) | 5 Dec (engine) · 10 Dec |
| S3-11 | [#103](https://github.com/GGital/My-little-pony/issues/103) | Feature-X: results, standings, finish, player view | §8 | TEST-X-01 … 07 | S3-10, S3-04 | 2 (Praewa) | Thu 10 Dec |
| S3-07 | [#104](https://github.com/GGital/My-little-pony/issues/104) | SR-05: accessibility scan, keyboard walk-through, fixes | §9 | TEST-SR5-02 … 04 | all screens | 1 (Phattaratorn) | Thu 10 Dec |
| S3-08 | [#105](https://github.com/GGital/My-little-pony/issues/105) | SR-06: performance seed and load run | §10 | TEST-SR6-01, 02 | S3-03 | 2 (Praewa) | Thu 10 Dec |
| S3-09 | [#106](https://github.com/GGital/My-little-pony/issues/106) | Integration, UAT re-tests, release `v1.0.0`, video | §11 … §13 | JRN-05 … 08, TEST-SR7-02, regression | all | both | Sun 13 Dec |

The exam period runs 1–11 Dec. Issues in that window are small and independent, and none of them changes the
seat or registration rules. The tournament Issues (S3-10, S3-11) are the exception in size: the plan's tournament
risk note sets 8 Dec as the date to decide on a smaller fallback if S3-10 is late.

## 3. Remaining work at the Deliverable 2 checkpoint (29 Nov)

Deliverable 2 §3.3 asks for each remaining item's current status (achieved AC and tested commit), the missing AC,
verification or fix, and the owner with a date before the final submission. It is filled from real runs on the
submitted candidate and never says more than the evidence shows.

**Status words** (one per row, the furthest one reached):

| Status | Meaning |
|---|---|
| **Planned** | contract, AC and STS rows exist; no code |
| **In progress** | the Issue's branch exists; the tests-only commit ran red |
| **Implemented** | the implementation commit ran green on the branch; PR open |
| **Tested** | merged into `sprint-3-staging`; the Sprint 1–3 suites pass on the merge commit |
| **Accepted** | released on `main` in a tag and deployed; post-deploy check recorded |

| Feature / defect | Issue | Current status (27 Nov) | Achieved AC · tested commit | Remaining action | Depends on | Owner, target |
|---|---|---|---|---|---|---|
| Feature-P check-in and undo (AC-P-01 … 06) | [#96](https://github.com/GGital/My-little-pony/issues/96) | Planned | — | Tests first, then implement; TEST-P-06 race 20 rounds; seed EV-10; red/green in `sts.md` §5 | `v0.2.0` (released 27 Nov) | Phattaratorn, 30 Nov – 1 Dec |
| Feature-T sign-in throttling (AC-T-01 … 05) | [#97](https://github.com/GGital/My-little-pony/issues/97) | Planned | — | Tests first, then implement; JRN-06 | `v0.2.0` (released 27 Nov) | Praewa, 30 Nov – 1 Dec |
| Feature-Q attendance report (AC-Q-01 … 05) | [#98](https://github.com/GGital/My-little-pony/issues/98) | Planned | — | All ACs; the axe check on the report | S3-01 | Phattaratorn, 2 Dec |
| Feature-V logo and banner (AC-V-01 … 07) | [#99](https://github.com/GGital/My-little-pony/issues/99) | Planned | — | Bucket and IAM, `MediaStore`, endpoints (30 Nov), UI states, deploy check V-06 | S2-09 | Praewa, 8 Dec |
| Feature-R organizer summary (AC-R-01 … 05) | [#100](https://github.com/GGital/My-little-pony/issues/100) | Planned | — | All ACs | S3-02 | Phattaratorn, 3 Dec |
| Feature-S participant history (AC-S-01 … 05) | [#101](https://github.com/GGital/My-little-pony/issues/101) | Planned | — | All ACs | S3-01 | Praewa, 4 Dec |
| Feature-W Swiss pairings (AC-W-01 … 07) | [#102](https://github.com/GGital/My-little-pony/issues/102) | Planned | — | Pairing engine and property test first (NFR-18), then endpoints and the pairings screen; seed EV-11; decide on the fallback on 8 Dec if late | S3-01 | Phattaratorn, 5 Dec (engine), 10 Dec |
| Feature-X results and standings (AC-X-01 … 07) | [#103](https://github.com/GGital/My-little-pony/issues/103) | Planned | — | Results, standings with the worked fixture, finish, player view, History placing | S3-10, S3-04 | Praewa, 10 Dec |
| SR-05 accessibility (AC-SR5-02 … 04) | [#104](https://github.com/GGital/My-little-pony/issues/104) | Planned | — | Scan, fixes, keyboard record (M evidence) | all screens | Phattaratorn, 10 Dec |
| SR-06 performance (AC-SR6-01, 02) | [#105](https://github.com/GGital/My-little-pony/issues/105) | Planned | — | Perf seed, load run, indexes if needed (M evidence) | S3-03 | Praewa, 10 Dec |
| SR-07, journeys, release (AC-SR7-02, JRN-05 … 08) | [#106](https://github.com/GGital/My-little-pony/issues/106) | Planned | — | Regression, UAT re-tests of the Lab 6 cases, `v1.0.0`, demo video of at most 10 minutes | all | Both, 12–13 Dec |

No defect is open on 27 Nov 2026 (the Lab 6 findings are closed; #64 is delivered by S2-04). One known limitation
comes from the Sprint 2 release (Sprint 2 `sts.md` §6): where focus goes after a confirmed Cancel registration is not
yet specified or tested. It belongs to S3-07 ([#104](https://github.com/GGital/My-little-pony/issues/104)), through
AC-SR5-04. Sprint 2 rows are tracked in the Sprint 2 README and `sts.md` §5; they are not repeated here.

## 4. Test-driven workflow

This is the same as Sprint 1 README §3: a tests-only commit runs **red**, then the implementation runs **green**,
both recorded in `sts.md` §5. A teammate reviews the PR on the real database with at least one specific finding.
The PR merges into `sprint-3-staging`. M rows add their evidence file in the same PR.

## 5. Definition of Done

Sprint 1 README §4 (DoD-1 … DoD-10), with the Sprint 2 changes (Sprint 2 README §5), applies to every Sprint 3
Issue. Sprint 3 adds:

| # | Change for Sprint 3 |
|---|---|
| DoD-2 | TEST-P-06 passes 20 rounds, and the `FOR UPDATE` mutation check is recorded |
| DoD-4 | Sprint 1, 2 **and** 3 suites green on the merge commit |
| DoD-6 | New endpoints E-18 … E-22, E-24 … E-32 are rows of TEST-B-03 |
| DoD-7 | No bucket key or service-account JSON in Git: the service account is attached to Cloud Run (SDS §9.3) |
| DoD-11 | **New:** every M row has its evidence file, named with the commit, in `docs/sprints/sprint-3/evidence/` |
| DoD-10 | **Final release:** release PR `sprint-3-staging` → `main` reviewed and merged; tag **`v1.0.0`**; deployed; `/api/version` equals the tag commit; smoke test of check-in and of persistence after a restart; demo video; final traceability with every requirement → test → result |

## 6. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 21 Nov 2026 | First Sprint 3 package: contracts v0.1, STS v0.1, Issue plan S3-00 … S3-09, remaining-work table for Deliverable 2, DoD additions | Team (AI-assisted) |
| v0.2 | 21 Nov 2026 | CH-12: S3-10 Feature-W and S3-11 Feature-X with targets; remaining-work rows; S3-03 moved to 1 Dec; DoD-6 endpoints; contract section numbers follow contracts v0.2 | Team (AI-assisted) |
| #118 | 25 Nov 2026 | Deliverable 2 check: §2 links the GitHub Issues #96 … #106 and names the students, says where `sprint-3-staging` was cut and that S3-00 merged in PR #76; §3 uses the Deliverable 2 columns (status words, achieved AC and tested commit, missing work, dependencies, owner by name and date). No defect is open on 25 Nov | Team (AI-assisted) |
| #118 | 27 Nov 2026 | §2: `sprint-3-staging` took Sprint 2 after `v0.2.0` (PR #117); Deliverable 2 asks for complete Sprint 3 specifications, not code, so no feature starts before 30 Nov (team decision 27 Nov). New targets: S3-01 and S3-05 30 Nov – 1 Dec, S3-02 2 Dec, S3-03 3 Dec; the other dates are unchanged. §3: status as of 27 Nov, the same targets, and the focus limitation carried from Sprint 2 to S3-07 | Team (AI-assisted) |
