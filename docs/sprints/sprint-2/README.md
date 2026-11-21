# Sprint 2: engineering contracts, tests and Definition of Done

Project: **TCG Event Hub** · Sprint 2 (9–29 Nov 2026) · Version v0.3 — **draft for team review** (changes in §6)

| Document | What it is |
|---|---|
| [`feature-contracts.md`](feature-contracts.md) | One contract each for SR-08, Feature-K, L, M, N, O, J and U: design, UI/API/data, 42 acceptance criteria (Feature-U added by CH-11, store contact by D-37) |
| [`sts.md`](sts.md) | Software Test Specification: planned tests, AC → test map, BR rejection map, TDD record, results |
| This file | Sprint goal, Issue plan, UX enhancements in scope, Definition of Done |

**Sprint goal** ([`../plan.md`](../plan.md) §3): an organizer controls the whole life of their event (draft, edit,
capacity, deadline, cancel), a player can change their mind, and every change records who made it and when. A
player can also search and filter events.

---

## 1. How the documents connect

This is the same chain as Sprint 1 README §1: SRS requirement → feature → contract AC → planned test → red run →
green run → result → traceability. The numbers match throughout: `AC-N-03` → `TEST-N-03` → a test named
`TEST-N-03 …` in `cancel-registration.api.test.ts`.

## 2. Issue plan

There is one GitHub Issue per row. Branches start from `sprint-2-staging` and are named `feature/s2-<n>-<slug>`.
The contracts PR (`docs/s2-contracts`) is merged into `sprint-2-staging` **before** any feature branch starts.

| Issue | Title | Contract | Tests it must make pass | Depends on | Student | Target |
|---|---|---|---|---|---|---|
| S2-00 | Sprint 2 contracts and STS (this folder) | all | — (documents) | — | both | Sun 22 Nov |
| S2-01 | SR-08 data foundation: migrations, constraints, change history, seed EV-7 … EV-9 | §1 | TEST-SR8-01 … 04, SR1-02 (revised), SR2-04 (codes) | S2-00 | 1 | Mon 23 Nov |
| S2-02 | Feature-K: save a draft and publish it | §2 | TEST-K-01 … 05 | S2-01 | 1 | Mon 23 Nov |
| S2-03 | Feature-J: search, filters and paging | §7 | TEST-J-01 … 06 | S2-00 | 2 | Tue 24 Nov |
| S2-04 | Feature-L: edit event and change capacity | §3 | TEST-L-01 … 06 | S2-01 | 1 | Tue 24 Nov |
| S2-05 | Feature-O: cancel an event with a reason | §6 | TEST-O-01 … 06 | S2-01 | 2 | Tue 24 Nov |
| S2-06 | Feature-M: registration deadline | §4 | TEST-M-01 … 04 | S2-04 | 1 | Wed 25 Nov |
| S2-07 | Feature-N: cancel a registration and register again | §5 | TEST-N-01 … 06 | S2-01, S2-06 | 2 | Wed 25 Nov |
| S2-09 | Feature-U: game per event, store profile (games, contact), game filter (CH-11, D-37) | §11.1 | TEST-U-01 … 05 | S2-01, S2-03, S2-04 | 2 | Wed 25 Nov |
| S2-08 | Integration, journeys, regression, release `v0.2.0` | §8, §9 | JRN-03, JRN-04, TEST-SR5-02 and the regression rows | all | both | Thu 26 Nov |

S2-01's migration adds the `game` enum column and `User.games` too, so S2-09 needs no schema change of its own.
Each Issue that adds an endpoint also adds its rows to TEST-B-03 (DoD-6).

**Scope change CH-11 (D-24, 21 Nov 2026):** Feature-U (game) is in Sprint 2 as S2-09. Feature-V (store logo and
event banner upload to GCS) is in Sprint 3. Its contract is in
[`../sprint-3/feature-contracts.md`](../sprint-3/feature-contracts.md) §6.

S2-03 depends only on the contracts, so it can start on day 1 in parallel with S2-01.

**Lab 6 link:** UAT finding #64 ("allow event owners to edit published event details") is delivered by S2-04
(Feature-L). The Deliverable 2 Part A change register records it as "accepted, delivered in Sprint 2".

## 3. Test-driven workflow

This is the same as Sprint 1 README §3:
1. Commit A contains tests only, run **red** and recorded in `sts.md` §5.
2. Commit B adds the implementation, run **green**.
3. A teammate reviews the PR on the real database, with at least one specific finding or question.
4. The PR is merged into `sprint-2-staging`.

Every new row lock also gets the mutation check in `sts.md` §1.4.

## 4. UX enhancements in Sprint 2 scope

These enhancements are part of the feature contracts, so each one has an AC and a test. They are not optional
extras.

| # | Enhancement | Feature / AC |
|---|---|---|
| UX-01 | Search bar becomes live: text, type, format, dates, "seats available", past/cancelled toggle | J · AC-J-05 |
| UX-02 | Filters live in the URL, so Back/Forward and shared links restore a search | J · AC-J-05 |
| UX-03 | Active-filter chips with × and **Clear all**; a named empty state with **Clear filters** | J · AC-J-05 |
| UX-04 | "21–40 of 45" paging with Previous / Next; result count announced to screen readers | J · AC-J-05 |
| UX-05 | **SAVE DRAFT** next to **PUBLISH EVENT**; a "Draft — only you can see this" banner | K · AC-K-01 |
| UX-06 | Edit page reuses the create form; only changed fields are sent; SAVE disabled until a change | L · AC-L-01 |
| UX-07 | Capacity hint "At least {n}: that's how many are registered" | L · AC-L-02 |
| UX-08 | After start, frozen fields are read-only with an explanation, not a surprise error | L · AC-L-05 |
| UX-09 | "Leave without saving?" guard on the edit page | L · TEST-L-01 (C) |
| UX-10 | "Registration closes Thu 5 Nov · 15:00" under the seats card | M · AC-M-01 |
| UX-11 | Confirmation dialog for cancelling a seat ("Keep my seat" / "Cancel registration") | N · AC-N-01 |
| UX-12 | Cancel-event dialog with a required, counted reason and the number of players affected | O · AC-O-03 |
| UX-13 | Red "Cancelled by the organizer: {reason}" banner; **Event cancelled** chip in My Events | O · AC-O-02 |
| UX-14 | Change-history panel on the edit page ("Quantum Cards changed capacity from 24 to 30") | SR-08 · AC-SR8-01 |
| UX-15 | Dashboard status chips (Draft / Published / Cancelled) with Edit and Publish actions | K, E · TEST-E-01 |
| UX-16 | **Game** dropdown in the search bar; a teal game chip on cards and the detail page | U · AC-U-02 |
| UX-17 | Store profile page with "Games played here" toggle chips; a host section on the event page | U · AC-U-03 |
| UX-19 | Store contact card on the profile; tap-to-call, tap-to-email and a short website link on every event, with "Contact for this event" when the event has its own | U · AC-U-04 |
| UX-18 | Store logo overlapping the event banner, the upload box with four states, and a logo-safe area in the preview | **Sprint 3**, Feature-V |

**Proposed, not yet in a contract.** These need team approval and an AC before they are built. Otherwise they
move to Sprint 3 polish.

| # | Idea | Cost | Note |
|---|---|---|---|
| UX-P1 | Dashboard tabs: Upcoming · Drafts · Past · Cancelled, with counts | small (client only; E-07 already returns everything) | helps when an organizer has many events |
| UX-P2 | "Closes in 2 h" relative text when the deadline is less than 24 h away | small | display only; the server still decides `CLOSED` |
| UX-P3 | Seats chip turns amber when the deadline is near, as well as when seats are low | small | can be confused with "few seats": test with UAT |
| UX-P4 | Toast after re-registering: "Welcome back — your seat is held." | tiny | voice per design-direction §6 |
| UX-P5 | Skeleton rows while paging, keeping the scroll position | small | |

## 5. Definition of Done

Sprint 1 README §4 (DoD-1 … DoD-10) applies to every Sprint 2 Issue. The Sprint 2 changes are:

| # | Change for Sprint 2 |
|---|---|
| DoD-2 | Concurrency tests (L-03, N-06, O-06) pass 20 rounds, and the `FOR UPDATE` mutation check is recorded |
| DoD-4 | The **Sprint 1 suite is green** on the merge commit too, as well as the Sprint 2 tests |
| DoD-8 | The contract and STS version rows; `features.md`, `srs.md` (D-16 … D-23, AC-SR1-02 revision), `system-sds.md` (error codes, E-04 query, the `EventChange` enum) and `traceability.md` updated; the Issue's row in `contributions.md` and `ai-use.md` |
| DoD-10 | **Release only:** release PR `sprint-2-staging` → `main` reviewed and merged; tag **`v0.2.0`**; deployed by the Lab 5 pipeline; the deployed `/api/version` equals the tag commit; post-deploy smoke test of a critical journey and persistence |

## 6. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 21 Nov 2026 | First Sprint 2 package: contracts v0.1, STS v0.1, Issue plan S2-00 … S2-08, UX-01 … UX-15 in scope, UX-P1 … P5 proposed, DoD changes | Team (AI-assisted) |
| v0.2 | 21 Nov 2026 | CH-11 split (D-24): Issue S2-09 Feature-U; UX-16, UX-17 in Sprint 2, UX-18 in Sprint 3 (Feature-V); 40 ACs | Team (AI-assisted) |
| v0.3 | 21 Nov 2026 | D-37: store contact in S2-09 (TEST-U-04, U-05), UX-19; 42 ACs | Team (AI-assisted) |
