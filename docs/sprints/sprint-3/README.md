# Sprint 3: engineering contracts, tests and Definition of Done

Project: **TCG Event Hub** · Sprint 3 (23 Nov – 13 Dec 2026) · Version v0.1 — **draft for team review** (changes in §6)

| Document | What it is |
|---|---|
| [`feature-contracts.md`](feature-contracts.md) | One contract each for Feature-P, Q, R, S, T, V and SR-05, SR-06, SR-07: design, UI/API/data, 39 acceptance criteria |
| [`sts.md`](sts.md) | Software Test Specification: planned tests, AC → test map, BR rejection map, TDD record, results |
| This file | Sprint goal, Issue plan, remaining-work table, Definition of Done |

**Sprint goal** ([`../plan.md`](../plan.md) §4): organizers check players in at the door and see real attendance;
players see their history; stores show their logo and banners; the product is hardened for accessibility,
performance and sign-in abuse, and released as `v1.0.0` by 13 Dec.

---

## 1. How the documents connect

This is the same chain as Sprint 1 README §1 and Sprint 2 README §1. `AC-P-04` → `TEST-P-04` → a test named
`TEST-P-04 …` in `checkin.api.test.ts`.

## 2. Issue plan

There is one GitHub Issue per row. Branches start from `sprint-3-staging`, named `feature/s3-<n>-<slug>`. The
contracts PR (`docs/s3-contracts`) merges first. Because the Deliverable 2 candidate must contain tested Sprint 3
work, S3-01 and S3-05 start as soon as the Sprint 2 release `v0.2.0` is on `main`
([`../plan.md`](../plan.md) v0.2, revised schedule).

| Issue | Title | Contract | Tests it must make pass | Depends on | Student | Target |
|---|---|---|---|---|---|---|
| S3-00 | Sprint 3 contracts and STS (this folder) | all | — (documents) | — | both | Sun 22 Nov |
| S3-01 | Feature-P: check-in and undo (+ seed EV-10) | §1 | TEST-P-01 … 06 | `v0.2.0` | 1 | Fri 27 Nov |
| S3-05 | Feature-T: sign-in throttling | §5 | TEST-T-01 … 05 | `v0.2.0` | 2 | Fri 27 Nov |
| S3-02 | Feature-Q: attendance report | §2 | TEST-Q-01 … 05 | S3-01 | 1 | Mon 30 Nov |
| S3-06 | Feature-V: store logo and event banner (bucket, API, UI) | §6 | TEST-V-01 … 07 | S2-09 | 2 | 30 Nov (API) · 8 Dec (UI) |
| S3-03 | Feature-R: organizer summary | §3 | TEST-R-01 … 05 | S3-02 | 1 | Fri 4 Dec |
| S3-04 | Feature-S: participant history | §4 | TEST-S-01 … 05 | S3-01 | 2 | Fri 4 Dec |
| S3-07 | SR-05: accessibility scan, keyboard walk-through, fixes | §7 | TEST-SR5-02 … 04 | all screens | 1 | Thu 10 Dec |
| S3-08 | SR-06: performance seed and load run | §8 | TEST-SR6-01, 02 | S3-03 | 2 | Thu 10 Dec |
| S3-09 | Integration, UAT re-tests, release `v1.0.0`, video | §9 … §11 | JRN-05 … 07, TEST-SR7-02, regression | all | both | Sun 13 Dec |

The exam period runs 1–11 Dec. Issues in that window are small and independent, and none of them changes the
seat or registration rules.

## 3. Remaining work at the Deliverable 2 checkpoint (29 Nov)

Deliverable 2 §3.3 asks for each remaining item's status, missing work, owner and date. The **Status** column is
filled from real runs on the submitted candidate. Until then it shows "Planned".

| Feature / defect | Current status | Remaining action | Owner, target |
|---|---|---|---|
| Feature-P (AC-P-01 … 06) | Planned → in the candidate | Implement with TDD; record red/green; race test 20 rounds | Student 1, 27 Nov |
| Feature-T (AC-T-01 … 05) | Planned → in the candidate | Implement with TDD; JRN-06 | Student 2, 27 Nov |
| Feature-Q (AC-Q-01 … 05) | Planned | All ACs; the axe check on the report | Student 1, 30 Nov |
| Feature-V (AC-V-01 … 07) | Planned | Bucket and IAM, `MediaStore`, endpoints, UI states, deploy check V-06 | Student 2, 8 Dec |
| Feature-R (AC-R-01 … 05) | Planned | All ACs | Student 1, 4 Dec |
| Feature-S (AC-S-01 … 05) | Planned | All ACs | Student 2, 4 Dec |
| SR-05 (AC-SR5-02 … 04) | Planned | Scan, fixes, keyboard record | Student 1, 10 Dec |
| SR-06 (AC-SR6-01, 02) | Planned | Perf seed, load run, indexes if needed | Student 2, 10 Dec |
| UAT re-tests and final video | Planned | Re-run the Lab 6 cases on `v1.0.0`; record a demo of at most 10 minutes | Both, 12–13 Dec |

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
| DoD-6 | New endpoints E-18 … E-22, E-24, E-25 are rows of TEST-B-03 |
| DoD-7 | No bucket key or service-account JSON in Git: the service account is attached to Cloud Run (SDS §9.3) |
| DoD-11 | **New:** every M row has its evidence file, named with the commit, in `docs/sprints/sprint-3/evidence/` |
| DoD-10 | **Final release:** release PR `sprint-3-staging` → `main` reviewed and merged; tag **`v1.0.0`**; deployed; `/api/version` equals the tag commit; smoke test of check-in and of persistence after a restart; demo video; final traceability with every requirement → test → result |

## 6. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 21 Nov 2026 | First Sprint 3 package: contracts v0.1, STS v0.1, Issue plan S3-00 … S3-09, remaining-work table for Deliverable 2, DoD additions | Team (AI-assisted) |
