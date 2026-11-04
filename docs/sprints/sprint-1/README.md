# Sprint 1: engineering contracts, tests and Definition of Done

Project: **TCG Event Hub** · Sprint 1 (4–8 Nov 2026) · Version v1.0 — draft for team review (PR 2)

| Document | What it is |
|---|---|
| [`feature-contracts.md`](feature-contracts.md) | One engineering contract per Sprint 1 feature and responsibility: design, UI/API/data, 47 acceptance criteria |
| [`sts.md`](sts.md) | Software Test Specification: every planned test, AC → test map, BR rejection map, TDD record, results |
| This file | Sprint goal, Issue plan, the TDD workflow every Issue follows, the Product Definition of Done |

**Sprint goal** (from [`../plan.md`](../plan.md) §2): a player can sign in, find an event, take a seat that can never
be double-booked, and see it in My Events; an organizer can publish an event and see who registered, all enforced
by the server.

---

## 1. How the documents connect

```
 SRS requirement ─► Feature (features.md) ─► Contract + AC (feature-contracts.md) ─► Planned test (sts.md)
       │                                                                                    │
       └──────────────── traceability.md ◄──── result (sts.md §6) ◄── green run ◄── red run ┘
                                                                     (TDD record, sts.md §5)
```

Same numbers all the way through: `AC-G-02` in the contract → `TEST-G-02` in the STS → a test named
`TEST-G-02 rejects a full event` in `registrations.api.test.ts`.

## 2. Issue plan

One GitHub Issue per row, created from this table. Each Issue body lists its contract section and the test IDs it
must turn green. Branches start from `sprint-1-staging` and are named `feature/s1-<n>-<slug>`.

| Issue | Title | Contract | Tests it must make pass | Depends on | Student | Day |
|---|---|---|---|---|---|---|
| I-01 | Data foundation: schema, first migration, constraints, seed | §1 SR-01 | TEST-SR1-01 … 05 | PR 2 | 1 | Thu 5 |
| I-02 | API foundation: errors, zod validation, origin check, clock, config, health | §2 SR-02, §3 SR-03, §13 SR-04 | TEST-SR2-01 … 05, TEST-SR3-01, TEST-SR4-01 | PR 2 | 1 | Thu 5 |
| I-03 | Client shell: theme, router, guards, shared states, time formatter | §6 Feature-C | TEST-C-01, C-02, C-05, TEST-SR3-02 | PR 2 | 2 | Thu 5 |
| I-04 | Feature-A: sign in, who am I, sign out | §4 | TEST-A-01 … 06, TEST-C-04 | I-01, I-02, I-03 | 1 | Fri 6 |
| I-05 | Feature-F: event list and detail | §9 | TEST-F-01 … 05, TEST-C-06 | I-01, I-02, I-03 | 2 | Fri 6 |
| I-06 | Feature-B: role and ownership guards + permission matrix test | §5 | TEST-B-01 … 03 | I-04 | 1 | Fri 6 |
| I-07 | Feature-D: create and publish event | §7 | TEST-D-01 … 05 | I-06 | 2 | Fri 6 |
| I-08 | Feature-G: registration with seat lock | §10 | TEST-G-01 … 06 | I-05, I-06 | 1 | Sat 7 |
| I-09 | Feature-E: organizer dashboard | §8 | TEST-E-01, 02 | I-07 | 2 | Sat 7 |
| I-10 | Feature-H: My Events | §11 | TEST-H-01, 02 | I-08 | 1 | Sat 7 |
| I-11 | Feature-I: registration list | §12 | TEST-I-01 … 03 | I-08, I-09 | 2 | Sat 7 |
| I-12 | Integration, journeys, responsive check, release evidence | §13 SR-05, SR-07 | TEST-C-03, TEST-SR5-01, TEST-SR7-01, JRN-01, JRN-02 | all | both | Sun 8 |

Every test ID in the STS belongs to exactly one Issue (checked by script). "Student 1" and "Student 2" match the
build-order table in [`../plan.md`](../plan.md) §2.4. Names are set when the Issues are created.

## 3. Test-driven workflow for every Issue

Like TokTickIT (Spec DD → Test DD → TDD), and as Deliverable 1 §3.5 requires ("show the intended behaviour test
failing before implementation and passing afterward"):

```
 1. Issue created ─► 2. branch from sprint-1-staging ─► 3. commit A: tests only   ─► run: RED (fails on assertions)
                                                                                     record in sts.md §5
                     4. commit B…: implementation ─► run: GREEN ─► 5. inspect the diff yourself
                     6. PR into sprint-1-staging ─► 7. teammate review (specific check, question or finding)
                     8. merge ─► 9. staging suite green
```

| Step | Rule |
|---|---|
| Commit A | Message `test(<feature>): add failing tests TEST-X-nn … (red)`. Contains **only** test files and the minimum stubs needed to compile (for example an empty route that returns 501). Run the suite and paste the failure summary (failed / total) into `sts.md` §5 |
| Commit B | Message `feat(<feature>): <behaviour> (green)`. Makes exactly the planned tests pass. **Never** edits an assertion to make it pass. If a test was wrong, change the contract and the test in a separate, explained commit |
| PR body | Links the Issue, the contract section and the test IDs; shows the red and green commit ids and their run summaries; lists anything not done |
| Review | The teammate runs the tests locally and writes at least one specific check, question or finding. Authors never approve their own PR |
| AI use | The agent gets the Issue, the contract section and the test IDs, and implements one bounded Issue at a time (Lecture 10 step 7). Its output is reviewed like any other code |

Exceptions are allowed only for pure set-up with no behaviour (for example the client project skeleton in I-03).
They are written in the PR as "no behaviour, no red step".

## 4. Product Definition of Done

A Sprint 1 item, and the Sprint 1 release, is **done** only when every line is true **and there is evidence**. A
claim by a person or an AI agent is not evidence.

| # | Done when… | Evidence |
|---|---|---|
| DoD-1 | The behaviour in the contract is implemented, through UI, API and database where the contract says so | The contract's ACs, demonstrated in the UI or E2E |
| DoD-2 | Every planned test for the item exists, ran red first (where it has behaviour), and now passes | `sts.md` §5 red/green commit ids and run summaries |
| DoD-3 | No planned test is skipped, `.only`, commented out or assertion-free; no assertion was weakened | Diff review; test file listing |
| DoD-4 | Server, client and E2E suites pass on the merge commit, and both apps build | Command output with the commit id (`sts.md` §6) |
| DoD-5 | The PR was reviewed by the teammate, with a specific comment, and merged into `sprint-1-staging` | PR link and review text |
| DoD-6 | Permissions are enforced by the server, and the permission-matrix test covers any new endpoint | TEST-B-03 rows |
| DoD-7 | No secret, real password or token in Git, logs or the PDF | Secret scan (TEST-SR4-01); log check |
| DoD-8 | Documents are current: contract (with a version row if it changed), STS results, traceability, README setup | Diff of `docs/` in the PR |
| DoD-9 | Anything not finished, failing or skipped is written down | "Known limitations" in the PR and `sts.md` §6 |
| DoD-10 | **Release only:** release PR `sprint-1-staging` → `main` reviewed and merged after the staging suite, journeys and three-width check pass; tag `v0.1.0`; README lets a fresh clone run | Tag, release PR, fresh-clone run log |

## 5. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v1.0 | 4 Nov 2026 | First Sprint 1 package: contracts v1.0, STS v1.0, Issue plan I-01 … I-12, TDD workflow, DoD-1 … DoD-10 | Team (AI-assisted) |
