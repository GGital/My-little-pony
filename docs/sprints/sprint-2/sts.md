# Sprint 2 Software Test Specification (STS)

Project: **TCG Event Hub** · Sprint 2 · Document version: v0.12 — Sprint 2 released as `v0.2.0` and deployed (changes in §8)
Contracts: [`feature-contracts.md`](feature-contracts.md) v0.10 · Issues and Definition of Done: [`README.md`](README.md) ·
Sprint 1 STS: [`../sprint-1/sts.md`](../sprint-1/sts.md) v1.18

This document turns every Sprint 2 acceptance criterion into planned tests, **before** the code exists. It uses the
same method as Sprint 1: Spec DD → Test DD → TDD.

---

## 1. Test strategy

### 1.1 Rules

Sprint 1 STS §1.1 applies unchanged: tests first (red, then green), the server is the authority, counts are
checked independently, persistence is never mocked, and nothing is weakened to pass. Sprint 2 adds three rules:

1. **The Sprint 1 suite is the regression suite.** Every Sprint 1 test stays green on every Sprint 2 merge. If a
   Sprint 1 test has to change (for example, the seed count), the change goes in its own commit with the reason,
   and is recorded in both STS version tables.
2. **State changes are checked in the database.** For every change (publish, edit, cancel), the test reads back the
   row **and** the `EventChange` row or the record fields (FR-28). A `200` response alone is not enough.
3. **Every new row lock gets a race test.** E-13, E-15 and E-16 lock the same event row as E-09, so each one has a
   concurrency test run for 20 rounds (TEST-L-03, N-06, O-06), like TEST-G-06.

### 1.2 Levels and tooling

These are the same as Sprint 1 STS §1.2. Files go under `server/tests/sprint-2/`, `client/tests/sprint-2/` and
`e2e/sprint-2/`. Level codes: U unit · I API + database integration · C UI component · E2E Playwright · M manual
with evidence.

### 1.3 Test data

- **Integration** tests use the Sprint 1 factories plus `makeDraft()`, `cancelEvent(event, reason)`,
  `cancelRegistration(reg)` and `setDeadline(event, at)`. The tables are truncated before each file.
- **E2E** tests use the seed with EV-7 (draft), EV-8 (cancelled) and EV-9 (deadline passed) from contracts §0.4.
- **Time:** `clock.setNow()` is used in every file that touches deadlines, "started" or publishing. Every boundary is
  tested exactly at it, 1 minute before and 1 minute after.
- **Search:** TEST-J-03 builds 45 events in one `createMany`. TEST-J-02 places events at 23:30 and 00:30 Bangkok
  time to test the date boundary.

### 1.4 Concurrency simulation

| Test | Set-up | Sent at the same time (`Promise.all`) | Invariant checked every round (20 rounds) |
|---|---|---|---|
| TEST-L-03 | capacity 10, 8 active, 5 participant agents | E-13 `capacity 8` + 5 × E-09 | active ≤ capacity; the outcome is one of the two allowed outcomes |
| TEST-N-06 | full event (2 / 2), 10 participant agents; Mint with 1 active | P1's E-16 + 10 × E-09; Mint 2 × E-16 | at most one new `201` (exactly one if the E-16 takes the lock first); active = 1 + the `201`s, never above 2; at least one round with a winner in 20; Mint gets one `200` and one `409` |
| TEST-O-06 | open event, 20 seats, 10 participant agents | E-15 + 10 × E-09 | event `CANCELLED`; 0 active rows; each E-09 is `201` or `409 REGISTRATION_CLOSED` |

**Mutation check at review:** remove `FOR UPDATE` from the new transaction. At least one round must fail. Record
this in §5.

### 1.5 Definition of a passing Sprint 2 suite

The suite passes when:
- every §2 row is green on the release commit;
- every Sprint 2 AC appears in §3;
- §4 has a rejection test for every Sprint 2 BR;
- the Sprint 1 suite is still fully green;
- JRN-01 … JRN-04 pass;
- §6 records the commit, the commands, the counts and any exceptions.

---

## 2. Planned tests

Legend for **Result**: `Pending` = planned and not yet run. It changes to `Pass` or `Fail` **only from real
output**, with the commit id in §6.

### 2.1 SR-08 — record keeping and data foundation

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-SR8-01 | I | AC-SR8-01, FR-28 | O1 signed in; clock T | E-06 (capacity 24); clock T + 1 h, E-13 capacity 30; clock T + 2 h, E-13 deadline; E-17 | 3 items newest first: `deadline` (old = start ISO, new = deadline ISO), `capacity` 24 → 30, `status` null → `PUBLISHED`; `changedBy.displayName` "Quantum Cards"; `changedAt` = clock times; the body has no `email`, `changedById` or user id | `server/tests/sprint-2/changes.api.test.ts` | **Pass** (`2075544`, release candidate): S2-01 part `dfa124f`, S2-04 capacity step `9f71b81`, S2-06 deadline step `3886e35`; AC-SR8-01 fully covered |
| TEST-SR8-02 | I | AC-SR8-02, X-11 | 2 change rows | `UPDATE "EventChange" SET "newValue" = 'x'`; `DELETE FROM "EventChange"` | both throw, naming `event_change_append_only`; the rows are unchanged (read back) | `server/tests/sprint-2/constraints.api.test.ts` | **Pass** (`dfa124f`) |
| TEST-SR8-03 | I | AC-SR8-03, BR-08, BR-12 | — | SQL: deadline = start + 1 min; `status = 'CANCELLED'` with null `cancelReason`; a registration `CANCELLED` with null `cancelledAt`; also `PUBLISHED` with `cancelledAt` set | each is rejected with SQLSTATE 23514 and the constraint name (`event_deadline_before_start`, `event_cancel_fields`, `registration_cancel_fields`) | `server/tests/sprint-2/constraints.api.test.ts` | **Pass** (`dfa124f`) |
| TEST-SR8-04 | I | AC-SR8-04, NFR-02 | event X owned by O1 | E-17 for X as O2, P, visitor; E-17 for 999999 as O1; `/abc` | `404` (body equal to the 999999 body), `403`, `401`, `404`, `400` | `server/tests/sprint-2/changes.api.test.ts` | **Pass** (`dfa124f`) |

### 2.2 Feature-K — drafts

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-K-01 | I, C | AC-K-01, FR-08 | O1; clock T | E-06 valid body + `saveAsDraft: true`; E-07; E-05 as O1. (C) the create form: press SAVE DRAFT with E-06 stubbed | `201`, row `DRAFT`, `publishedAt null`, `organizerId` O1; 1 change row `null → DRAFT`; E-07 includes it with `status DRAFT`; E-05 `MANAGE`. (C) the body has `saveAsDraft: true`; navigates to `/events/:id` (v0.7); toast text; both buttons busy-safe | `server/tests/sprint-2/drafts.api.test.ts`, `client/tests/sprint-2/CreateEvent.draft.test.tsx` | **Pass** (`40f5687`) |
| TEST-K-02 | I | AC-K-02, BR-04 | draft D (O1); published E; visitor, Nok, O2 sessions | E-04 plain, `include=past,cancelled`, `q=<D title>`; E-05 D for each viewer; E-09 D by Nok | D in no list; E-05 ×3 `404 EVENT_NOT_FOUND`, each body equal to the 999999 body; E-09 `404`, Registration count 0 | `server/tests/sprint-2/drafts.api.test.ts` | **Pass** (`40f5687`) |
| TEST-K-03 | I, E2E | AC-K-03, FR-08, FR-28 | draft D; clock T | E-14 by O1; E-04 as visitor. (E2E) Quantum Cards: dashboard → Publish on EV-7 | `200`, `PUBLISHED`, `publishedAt = T`, change row `DRAFT → PUBLISHED`; D is listed. (E2E) toast "Your event is live." and EV-7 appears on `/events`. (C, v0.7) the owner's draft banner and PUBLISH EVENT; the dashboard Publish button | `server/tests/sprint-2/drafts.api.test.ts`, `client/tests/sprint-2/Drafts.test.tsx`, `e2e/sprint-2/drafts.spec.ts` | **Pass** (`40f5687`) |
| TEST-K-04 | U, I | AC-K-04, BR-02, D-21 | draft starting T + 1 h; clock moved to T + 2 h; drafts starting T2 + 30 min and T2 + 60 min (clock T2, CH-13); published P; cancelled C | (U) `decidePublish` with each state; (I) E-14 on each | (U) `EVENT_TIME_INVALID`, `ALREADY_PUBLISHED`, `ALREADY_CANCELLED`. (I) `422` field `startAt`, still `DRAFT` (past and 30-min drafts); `200` for the 60-min draft; `409 ALREADY_PUBLISHED`; `409 ALREADY_CANCELLED`; change-row count unchanged | `server/tests/sprint-2/unit/event-lifecycle.unit.test.ts`, `server/tests/sprint-2/drafts.api.test.ts` | **Pass** (`40f5687`) |
| TEST-K-05 | I | AC-K-05, BR-13, BR-17 | draft D (O1) | E-14 by O2, P, visitor, `Origin: https://evil.example`; E-06 by P with `saveAsDraft`; E-06 by O1 with `saveAsDraft: "yes"`, with `status: "DRAFT"` | `404`, `403`, `401`, `403`; `403`; `400` (`saveAsDraft`), `400` (`status`); event and change-row counts unchanged | `server/tests/sprint-2/drafts.api.test.ts` | **Pass** (`40f5687`) |

### 2.3 Feature-L — editing and capacity

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-L-01 | I, C, E2E | AC-L-01, FR-09, #64 | upcoming event (O1) with 3 registrations | E-13 `{title, venueName, description}`; E-05. (C) the edit page sends only the changed fields; SAVE CHANGES disabled until a change. (E2E, JRN-03) | `200` with the new values; E-05 agrees; the 3 registrations are unchanged (ids, status); 1 change row `details` "title, venueName, description". (C) the PATCH body = changed keys only; toast | `server/tests/sprint-2/edit.api.test.ts`, `client/tests/sprint-2/EditEvent.test.tsx` | **Pass** (`9f71b81`) |
| TEST-L-02 | U, I | AC-L-02, BR-09, BR-01 | capacity 24, 3 active | (U) `decideCapacity(active 3, new 2 / 3)`; (I) E-13 `capacity` 3, 2, 256, 257, 0, 1.5, 30 | (U) `CAPACITY_BELOW_REGISTERED` / OK. (I) `200`; `409` "3 players are registered, so capacity can't go below 3."; `200`; `400` ×3; `200` with `seatsRemaining 27` = 30 − independent count; 3 `capacity` change rows; the registration rows are unchanged | `server/tests/sprint-2/unit/event-lifecycle.unit.test.ts`, `server/tests/sprint-2/edit.api.test.ts` | **Pass** (`9f71b81`) |
| TEST-L-03 | I | AC-L-03, BR-09, NFR-05 | §1.4 | §1.4, 20 rounds | §1.4 invariant every round | `server/tests/sprint-2/lifecycle.concurrency.api.test.ts` | **Pass** (`9f71b81`), 20 / 20 rounds; mutation check: without `FOR UPDATE` round 1 fails (`S2-04-mutation-L03.txt`) |
| TEST-L-04 | U, I | AC-L-04, BR-02, NFR-11 | event at T + 2 d, 4 h long; clock T | E-13 `startAt` T − 1 min; `startAt` T + 59 min; `startAt` T + 60 min (CH-13); `endAt` only = start + 25 h; `endAt` only = start + 24 h; `startAt` + `endAt` moved 1 day later; then E-04 | `422 startAt` ×2; `200`; `422 endAt`; `200`; `200`, and the E-04 order changes | `server/tests/sprint-2/edit.api.test.ts` | **Pass** (`9f71b81`) |
| TEST-L-05 | U, I, C | AC-L-05, BR-15, D-19 | event started 1 h ago; also one with `startAt` = now | E-13 `{description, feeLabel}`; `{capacity}`; `{startAt, title}`; the same on the "starts now" event. (C) the edit page with `hasStarted: true` | `200`; `409 EVENT_STARTED` details `[capacity]`; `409` details `[startAt, title]`; the "now" event behaves as started; DB values unchanged. (C) the frozen inputs are read-only and the note is shown | `server/tests/sprint-2/edit.api.test.ts`, `client/tests/sprint-2/EditEvent.test.tsx` | **Pass** (`9f71b81`) |
| TEST-L-06 | I | AC-L-06, BR-14, NFR-02 | event X (O1); cancelled C (O1) | E-13 X by O2, P, visitor, foreign Origin; `{}`; `{organizerId: 2}`; E-13 C by O1 | `404`, `403`, `401`, `403`, `400` "Change at least one field.", `400`; `409 ALREADY_CANCELLED`; X and C rows unchanged | `server/tests/sprint-2/edit.api.test.ts` | **Pass** (`9f71b81`) |

### 2.4 Feature-M — registration deadline

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-M-01 | I, C | AC-M-01, BR-08 | O1; clock T | E-06 without a deadline; E-06 with start − 2 h; E-13 a deadline on the first; E-05. (C) the detail page with `registrationDeadline` | `registrationDeadline` = `startAt`; = start − 2 h; `200` + a `deadline` change row; (C) "Registration closes Thu 5 Nov · 15:00" (Bangkok) | `server/tests/sprint-2/deadline.api.test.ts`, `client/tests/sprint-2/EventDetail.deadline.test.tsx` | **Pass** (`3886e35`) |
| TEST-M-02 | U, I | AC-M-02, BR-08, D-23 | event at T + 1 d; clock T | E-13 deadline = start + 1 min; = T; = T − 1 min; = start; `null`; then (deadline T + 20 h stored) `startAt` = T + 2 h | `422` ×3 on `registrationDeadline` with the contract messages; `200`; `200` and the response deadline = `startAt`; `422` on `registrationDeadline` | `server/tests/sprint-2/unit/deadline.unit.test.ts`, `server/tests/sprint-2/deadline.api.test.ts` | **Pass** (`3886e35`) |
| TEST-M-03 | U, I, E2E | AC-M-03, BR-08, BR-04, D-17 | open events with deadline D < start, seats left; Nok | (U) `decideRegistration` at D − 1 min, D, D + 1 min; (I) E-09 at the same times; E-05 at D; E-04 at D. (E2E) EV-9 as Nok | (U) OK, `REGISTRATION_CLOSED` ×2. (I) `201`, `409` ×2, 0 extra rows; E-05 `CLOSED`; the event is still in E-04. (E2E) disabled **REGISTRATION CLOSED** | `server/tests/sprint-2/unit/deadline.unit.test.ts`, `server/tests/sprint-2/deadline.api.test.ts`, `e2e/sprint-2/deadline.spec.ts` | **Pass** (`3886e35`) |
| TEST-M-04 | I | AC-M-04, BR-08, BR-11 | Mint registered; deadline D | E-10, E-11, E-05 at D − 1 min and at D; E-16 at D | `canCancel` true → false in all three; E-16 `409 REGISTRATION_CLOSED`, still `REGISTERED` | `server/tests/sprint-2/deadline.api.test.ts` | **Pass** (`2075544`): built in S2-07 (#84, green `62db165`), in `cancel-registration.api.test.ts`, where `canCancel` and E-16 are (decision 26 Nov 2026) |

### 2.5 Feature-N — cancel and re-register

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-N-01 | I, C, E2E | AC-N-01, FR-19, FR-28 | Mint registered, event 3 / 24; clock T | E-16; E-10; E-08 as owner; E-05 as Mint. (C) My Events: Cancel → dialog → confirm; busy state. (E2E, JRN-03) | `200 CANCELLED`, `cancelledAt T`, counts 2 / 24 / 22 by independent count; the row still exists; E-08 row Cancelled + time; E-05 `REGISTER`. (C) dialog text, "Cancelling…" with `aria-busy`, chip, toast | `server/tests/sprint-2/cancel-registration.api.test.ts`, `client/tests/sprint-2/MyEvents.cancel.test.tsx` | **Pass** (S2-07 green `62db165`; `2075544`) |
| TEST-N-02 | I | AC-N-02, FR-20, BR-06 | after N-01 | E-09 by Mint twice | first `201` with a new id; rows for (event, Mint) = 2 (1 `CANCELLED`, 1 `REGISTERED`); E-05 `REGISTERED` + the new id; second `409 ALREADY_REGISTERED` | `server/tests/sprint-2/cancel-registration.api.test.ts` | **Pass** (S2-07 green `62db165`; `2075544`) |
| TEST-N-03 | I | AC-N-03, BR-05 | full event 2 / 2 (Ploy, Boss) | Ploy E-16; Nok E-09; Ploy E-09 | `200`; `201`; `409 EVENT_FULL`; active = 2 | `server/tests/sprint-2/cancel-registration.api.test.ts` | **Pass** (S2-07 green `62db165`; `2075544`) |
| TEST-N-04 | U, I | AC-N-04, BR-11 | Mint's rows: `CANCELLED`, `EVENT_CANCELLED`, `CHECKED_IN` (SQL), and `REGISTERED` past the deadline | (U) `decideCancellation` per state; (I) E-16 on each | `409 ALREADY_CANCELLED` ×2, `409 ALREADY_CHECKED_IN`, `409 REGISTRATION_CLOSED`; all rows unchanged | `server/tests/sprint-2/unit/registration-rules.unit.test.ts`, `server/tests/sprint-2/cancel-registration.api.test.ts` | **Pass** (S2-07 green `62db165`; `2075544`) |
| TEST-N-05 | I | AC-N-05, BR-11, BR-16, BR-17, NFR-02 | Mint's active registration R | E-16 R by Ploy, O1 (owner), visitor, foreign Origin; by Mint with `{participantId}`; E-16 999999 by Mint; `/abc` | `404` (equal to the 999999 body), `403`, `401`, `403`, `400`; `404 REGISTRATION_NOT_FOUND`; `400`; R unchanged | `server/tests/sprint-2/cancel-registration.api.test.ts` | **Pass** (S2-07 green `62db165`; `2075544`) |
| TEST-N-06 | I | AC-N-06, NFR-05, BR-06 | §1.4 | §1.4, 20 rounds | §1.4 invariant every round | `server/tests/sprint-2/lifecycle.concurrency.api.test.ts` | **Pass** (S2-07 green `62db165`; `2075544`): 20 / 20 rounds, and 20 rounds of the double cancel |

### 2.6 Feature-O — event cancellation

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-O-01 | I | AC-O-01, FR-10, BR-12, FR-28 | event (O1): 3 `REGISTERED`, 1 `CANCELLED` (cancelled at T − 1 h); clock T | E-15 `{reason: "Store closed for renovation."}` | `200`; event `CANCELLED`, `cancelledAt T`, `cancelledById` O1, reason stored trimmed; the 3 rows `EVENT_CANCELLED`, `cancelledAt T`; the old `CANCELLED` row keeps T − 1 h; 1 change row `PUBLISHED → CANCELLED` | `server/tests/sprint-2/cancel-event.api.test.ts` | Pass (I) |
| TEST-O-02 | I, C, E2E | AC-O-02, BR-04, BR-12, FR-14 | after O-01 | E-09 Nok; E-13, E-14, E-15 by O1; E-04 plain and `include=cancelled`; E-05 visitor; E-10 affected player. (C) detail banner; My Events chip. (E2E) EV-8 as Boss | `409 REGISTRATION_CLOSED`; `409 ALREADY_CANCELLED` ×3; absent / present with `CANCELLED`; E-05 has `cancelReason`, `CLOSED`, no `cancelledById` key; E-10 `EVENT_CANCELLED`. (C, E2E) "Cancelled by the organizer: …", **Event cancelled** | `server/tests/sprint-2/cancel-event.api.test.ts`, `client/tests/sprint-2/EventDetail.cancelled.test.tsx`, `e2e/sprint-2/cancel-event.spec.ts` | Pass (I, C, E2E), incl. E-13 and include=cancelled |
| TEST-O-03 | U, I, C | AC-O-03, BR-12 | upcoming events | `reason` missing, `"abcd"`, 201 chars, 5 spaces; then 5 and 200 chars. (C) the dialog counter and disabled button below 5 | `400` ×4 "Give a reason of 5 to 200 characters.", unchanged; `200` ×2 | `server/tests/sprint-2/unit/event-input.unit.test.ts`, `server/tests/sprint-2/cancel-event.api.test.ts`, `client/tests/sprint-2/CancelEventDialog.test.tsx` | Pass (U, I, C) |
| TEST-O-04 | U, I | AC-O-04, BR-12, D-16 | started 1 min ago; starts now; draft | E-15 on each | `409 EVENT_STARTED` ×2; `409 NOT_PUBLISHED`; all unchanged | `server/tests/sprint-2/cancel-event.api.test.ts` | Pass (U, I) |
| TEST-O-05 | I | AC-O-05, BR-14, NFR-02 | event X (O1) | E-15 by O2, P, visitor, foreign Origin | `404`, `403`, `401`, `403`; X unchanged | `server/tests/sprint-2/cancel-event.api.test.ts` | Pass (I) |
| TEST-O-06 | I | AC-O-06, BR-12, NFR-05 | §1.4 | §1.4, 20 rounds | §1.4 invariant every round | `server/tests/sprint-2/cancel-event.concurrency.api.test.ts` | Pass (I, 20 rounds; double-cancel race added; `FOR UPDATE` mutation fails it) |

### 2.7 Feature-J — search and filters

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-J-01 | I | AC-J-01, FR-13 | the seed (9 events) loaded in the test DB | E-04 `q` = "quantum", "BANGKOK", "draft night", "เปิดกล่อง", "50%_off", 101 chars | the ids per the AC (EV-7 draft never present); `[]` for the `%_` text; `400` on `q`. A built event titled `50% off_night` is found by `50%`, `50% off` and `off_night` (not by `off-night`), and `q=%` returns only that event | `server/tests/sprint-2/search.api.test.ts` | **Pass** (`2c5e075`, literal case `18564ab`) |
| TEST-J-02 | U, I | AC-J-02, FR-13, NFR-11, D-22 | built events: each type and format; 23:30 and 00:30 Bangkok around `to`; one full | each filter alone; all combined; `type=PARTY`, `from=2026-02-30`, `from > to`. (U) `bangkokDayRange('2026-11-25')` | exact id sets; 23:30 included, 00:30 excluded; `400` ×3 naming `type`, `from`, `to`. (U) `[2026-11-24T17:00:00.000Z, 2026-11-25T17:00:00.000Z)` | `server/tests/sprint-2/unit/search-query.unit.test.ts`, `server/tests/sprint-2/search.api.test.ts` | **Pass** (`2c5e075`) |
| TEST-J-03 | I | AC-J-03, FR-13 | 45 matching events, some with equal `startAt` | pages 1 … 4; `page=0`, `page=abc` | 20 / 20 / 5 / 0 items; `meta` `{page, pageSize 20, totalItems 45}`; the union of the ids = all 45, no duplicates; sorted; `400` ×2 | `server/tests/sprint-2/search.api.test.ts` | **Pass** (`2c5e075`) |
| TEST-J-04 | I | AC-J-04, FR-14, BR-04 | upcoming, started, cancelled, draft | `include` none / `past` / `cancelled` / `past,cancelled` / `drafts` | the AC sets; `400` for `drafts`; the draft id never appears | `server/tests/sprint-2/search.api.test.ts` | **Pass** (`2c5e075`) |
| TEST-J-05 | C, E2E | AC-J-05, FR-13 | seed; (C) E-04 stubbed | (C) submit a search: URL and request query; chips; Clear all; empty state; live-region count. (E2E, JRN-04: quantum + Constructed, page 2, Back, Forward, remove a chip, zzz) | (C) `navigate('/events?q=quantum&format=CONSTRUCTED&page=1')`; the request has the same query; "21–40 of 45"; "No events match your search." + Clear filters. (E2E) Back restores the earlier list and Forward the search; page 2 of 25 PagingTest events shows "21–25 of 25" and Back returns to page 1; removing the text chip searches again; the filtered page has no axe colour-contrast violation (AC-C-08) | `client/tests/sprint-2/EventSearch.test.tsx`, `e2e/sprint-2/search.spec.ts` | **Pass** (`2c5e075`, review `a0a86f3`, `23d5526`) |
| TEST-J-06 | I | AC-J-06, BR-16, NFR-15 | registrations on several events | E-04 `organizerId=1`, `participantId=3`; stringify every TEST-J-01 … 04 body | `400` ×2; no participant id, display name, email or `registrations` key | `server/tests/sprint-2/search.api.test.ts` | **Pass** (`2c5e075`) |

### 2.8 Feature-U — game per event and store games (CH-11, D-24)

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-U-01 | U, I, C | AC-U-01, FR-29 | O1 signed in; upcoming event X (O1) | E-06 `game: "POKEMON"`; no `game`; `game: "CHESS"`; E-13 X `game: "MAGIC"`. (C) the create form submitted with no game chosen | `201 POKEMON`; `201 OTHER`; `400` on `game`, 0 rows; `200` + 1 `details` change row whose `newValue` includes `game`. (C) "Choose a game." under the group; no request sent | `server/tests/sprint-2/games.api.test.ts`, `client/tests/sprint-2/CreateEvent.game.test.tsx` | Pass (`19bd097`) |
| TEST-U-02 | I, C, E2E | AC-U-02, FR-29, FR-13 | events with POKEMON, MAGIC, OTHER games | E-04 `game=POKEMON`; `game=POKEMON&q=quantum`; `game=chess`. (C) choose Pokémon TCG and press Search. (E2E, JRN-04) filter by Pokémon TCG on the seed | the exact Pokémon ids; the AND set; `400` on `game`. (C) URL `game=POKEMON`, the chip "Game: Pokémon TCG", the heading "Pokémon TCG events", no card chips (an unfiltered list shows them). (E2E) EV-6 is shown and EV-1 is not | `server/tests/sprint-2/search.api.test.ts`, `client/tests/sprint-2/EventSearch.test.tsx`, `e2e/sprint-2/search.spec.ts` | Pass (`19bd097`) |
| TEST-U-03 | I, C | AC-U-03, FR-30, BR-17, NFR-02 | O1 owns event X | E-23 PATCH `{games:["POKEMON","MAGIC"]}`; then E-05 X as a visitor; PATCH `{games:[]}`; `["POKEMON","POKEMON"]`; `["X"]`; `{games:[], userId: 2}`; PATCH by P, by a visitor, with a foreign Origin. (C) the store page toggles chips and saves | `200`, E-05 `store.games` = both; `200 []`; `400` ×3; `403`, `401`, `403`; O2's profile is unchanged. (C) `aria-pressed` flips; the PATCH body holds the chosen games | `server/tests/sprint-2/games.api.test.ts`, `client/tests/sprint-2/StoreProfile.test.tsx` | Pass (`19bd097`) |
| TEST-U-04 | I, C | AC-U-04, FR-30, D-37, D-14 | O1 owns A (no event contact) and B (event contact set) | E-23 with the four contact fields; E-05 A and B as a visitor; E-23 `{contactLine:""}`; stringify the E-05 bodies. (C) the detail page for A and B | `200`; email trimmed and lower-cased; same `store.contact` on A and B; `line null` after clearing; no body contains O1's sign-in email. (C) `tel:` and `mailto:` hrefs; website text = host name; B shows "Contact for this event" first | `server/tests/sprint-2/games.api.test.ts`, `client/tests/sprint-2/EventDetail.contact.test.tsx` | Pass (`19bd097`) |
| TEST-U-05 | U, I, C | AC-U-05, NFR-15 | O1 | (U) `storeContactSchema` on each bad value; (I) E-23 with all bad values together, and `{}`. (C) the website link and a contact with `<b>bold</b>` | (U) each rejected with the table message. (I) one `400` naming every failing field, 0 rows changed; `{}` → `400`. (C) `target="_blank"`, `rel="noopener noreferrer nofollow"`; markup shown as text | `server/tests/sprint-2/unit/store-contact.unit.test.ts`, `server/tests/sprint-2/games.api.test.ts`, `client/tests/sprint-2/EventDetail.contact.test.tsx` | Pass (`19bd097`) |
| TEST-U-06 | C | AC-U-01, FR-29, UX-16, D-41 | the store has games POKEMON, MAGIC | (C) open the create page with E-23 returning two games, none, and a failing read | "Your games" (Pokémon TCG, Magic) before "Other games" (the rest); one plain list with no games or a failed read | `client/tests/sprint-2/CreateEvent.storegames.test.tsx` | Pass (`7af6773`) |
| TEST-U-07 | C | FR-30, UX-17, D-41 | an organizer and a participant signed in | (C) open the account menu | the organizer has "Store profile" linking to `/organizer/store`; the participant does not | `client/tests/sprint-2/AppShell.storeprofile.test.tsx` | Pass (`7af6773`) |
| TEST-U-08 | E2E | UX-17, D-41 | Quantum Cards (games Pokémon TCG, Magic) | (E2E) open `/organizer/store` in the built app | a pressed and an unpressed toggle differ in computed background, border and text colour | `e2e/sprint-2/s2-09-store-profile-style.spec.ts` | Pass (`7af6773`) |

### 2.9 Feature-C — Deep Lagoon theme and type (D-38)

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-C-07 | U, E2E | AC-C-07, D-38 | the built client; the seed | (U) parse `theme.css` and compare every `:root` token with `tests/fixtures/deep-lagoon.json` (the design-direction §2 table); check `package.json` has no `@fontsource/chakra-petch`. (E2E) open `/events`, EV-1 and EV-6 (Thai title), My Events; read computed styles, `document.fonts` and the network log | (U) all tokens equal; no Chakra Petch dependency. (E2E) body `font-family` starts with Inter; the seat count and date badge are Manrope with `tabular-nums`; IBM Plex Sans Thai loaded for EV-6; 0 requests to `fonts.googleapis.com` | `client/tests/sprint-2/unit/theme-tokens.unit.test.ts`, `e2e/sprint-2/theme.spec.ts` | Pass |
| TEST-C-08 | U, E2E | AC-C-08, NFR-10, NFR-08 | the token table; the seed; participant and organizer sessions | (U) a WCAG contrast function over every text and control pair; (E2E) `@axe-core/playwright` with only `color-contrast` on the 9 screens; rerun TEST-SR5-01 | (U) text ≥ 4.5, controls ≥ 3. (E2E) 0 violations; 21 / 21 width checks; PLAYER badge, seat chip and REGISTERED compute to `#1F6F43`, primary button to `#167D8D` | `client/tests/sprint-2/unit/theme-contrast.unit.test.ts`, `e2e/sprint-2/theme.spec.ts` | Pass |

### 2.10 Regression additions to Sprint 1 tests and journeys

| Test ID | Level | AC / Req | Change in Sprint 2 | File | Result |
|---|---|---|---|---|---|
| TEST-B-03 (rows added) | I | AC-B-03, NFR-02 | rows for E-13 … E-17 from SDS §7.1, including byte-identical 404s for another owner's event and another participant's registration | `server/tests/sprint-1/authorization.api.test.ts` | **Pass** (`2075544`): E-13 (`9f71b81`), E-14 (`40f5687`), E-15 in TEST-O-05 (`c2e0238`), E-16 in `cancel-registration.api.test.ts` (`62db165`), E-17 (`dfa124f`), E-23 in `games.api.test.ts` (`19bd097`) |
| TEST-SR1-02 (revised) | I | AC-SR1-02 | 9 events; EV-7 `DRAFT`, EV-8 `CANCELLED` with Boss `EVENT_CANCELLED`, EV-9 with a past deadline and Mint `REGISTERED`; a second run adds 0 rows | `server/tests/sprint-1/seed.api.test.ts` | **Pass** (`dfa124f`) |
| TEST-SR2-03 (rows added) | I | AC-SR2-03 | E-13 … E-17 in the route table; GET on the POST/PATCH-only paths → 404, no writes | `server/tests/sprint-1/validation.api.test.ts` | **Pass** (`2075544`): E-13 … E-17 and E-23 in `server/tests/helpers/routes.ts` |
| TEST-SR2-04 (codes added) | U | NFR-07 | `ALREADY_PUBLISHED`, `NOT_PUBLISHED` map to 409 | `server/tests/sprint-1/unit/errors.unit.test.ts` | **Pass** (`dfa124f`) |
| TEST-E-01 (rows added) | I | AC-E-01 | E-07 includes the owner's draft and cancelled event with their status | `server/tests/sprint-1/organizer.api.test.ts` | **Pass** (`40f5687`; it also passed on the red run, because E-07 already listed every status) |
| TEST-SR5-05 | E2E | NFR-08 | the 3 new screens (edit, search with filters open, cancelled detail) at 390 / 768 / 1440 px, no horizontal scroll | `e2e/sprint-2/responsive.spec.ts` | **Pass** (`2075544`): 9 / 9; screenshots in `evidence/responsive/` |
| JRN-03 | E2E | K, L, M, N, O, SR-08 | contracts §9 | `e2e/sprint-2/journey.spec.ts` | **Pass** (`2075544`) |
| JRN-04 | E2E | J, FR-26 | contracts §9 | `e2e/sprint-2/journey.spec.ts` | **Pass** (`2075544`) |
| JRN-01, JRN-02 | E2E | Sprint 1 | unchanged; must stay green (Deliverable 2 Part A continuity) | `e2e/sprint-1/journey.spec.ts` | **Pass** (`2075544`): unchanged |

**Totals:** 44 planned test rows that carry an AC number (37 + TEST-U-01 … 05 + TEST-C-07, C-08), plus 6 regression rows and 2 new
journeys. TEST-B-03 and TEST-SR2-03 also gain E-23. The Sprint 1
suite (55 rows, JRN-01 and JRN-02) runs unchanged.

---

## 3. Acceptance criterion → tests

| AC | Tests | AC | Tests | AC | Tests |
|---|---|---|---|---|---|
| AC-SR8-01 | TEST-SR8-01, JRN-03 | AC-L-04 | TEST-L-04 | AC-N-05 | TEST-N-05, TEST-B-03 |
| AC-SR8-02 | TEST-SR8-02 | AC-L-05 | TEST-L-05 | AC-N-06 | TEST-N-06 |
| AC-SR8-03 | TEST-SR8-03 | AC-L-06 | TEST-L-06, TEST-B-03 | AC-O-01 | TEST-O-01, JRN-03 |
| AC-SR8-04 | TEST-SR8-04, TEST-B-03 | AC-M-01 | TEST-M-01, JRN-03 | AC-O-02 | TEST-O-02, JRN-03 |
| AC-K-01 | TEST-K-01, JRN-03 | AC-M-02 | TEST-M-02 | AC-O-03 | TEST-O-03 |
| AC-K-02 | TEST-K-02, JRN-03 | AC-M-03 | TEST-M-03 | AC-O-04 | TEST-O-04 |
| AC-K-03 | TEST-K-03, JRN-03 | AC-M-04 | TEST-M-04 | AC-O-05 | TEST-O-05, TEST-B-03 |
| AC-K-04 | TEST-K-04 | AC-N-01 | TEST-N-01, JRN-03 | AC-O-06 | TEST-O-06 |
| AC-K-05 | TEST-K-05, TEST-B-03 | AC-N-02 | TEST-N-02, JRN-03 | AC-J-01 | TEST-J-01, JRN-04 |
| AC-L-01 | TEST-L-01, JRN-03 | AC-N-03 | TEST-N-03 | AC-J-02 | TEST-J-02 |
| AC-L-02 | TEST-L-02, JRN-03 | AC-N-04 | TEST-N-04 | AC-J-03 | TEST-J-03, JRN-04 |
| AC-L-03 | TEST-L-03 | | | AC-J-04 | TEST-J-04 |
| | | | | AC-J-05 | TEST-J-05, JRN-04 |
| | | | | AC-J-06 | TEST-J-06 |
| | | | | AC-U-01 | TEST-U-01 |
| | | | | AC-U-02 | TEST-U-02, JRN-04 |
| | | | | AC-U-03 | TEST-U-03, TEST-B-03 |
| | | | | AC-U-04 | TEST-U-04 |
| | | | | AC-U-05 | TEST-U-05 |
| | | | | AC-C-07 | TEST-C-07 |
| | | | | AC-C-08 | TEST-C-08 |

44 / 44 Sprint 2 ACs have at least one automated test. No authorization AC is proven by a UI test alone.

## 4. Business rules with rejection (negative) tests

| BR | Rejection tested by | What is rejected |
|---|---|---|
| BR-08 | TEST-M-02, TEST-M-03, TEST-M-04, TEST-SR8-03 | Deadline after start or in the past; registering or cancelling at or after the deadline; deadline > start in SQL |
| BR-09 | TEST-L-02, TEST-L-03 | Capacity below the active count, including under a race |
| BR-11 | TEST-N-04, TEST-N-05 | Cancelling another participant's, a cancelled, a checked-in, or a past-deadline registration |
| BR-12 | TEST-O-03, TEST-O-04, TEST-O-02, TEST-SR8-03 | Bad reason; started event; draft; second cancel; any change after cancel; incomplete cancel fields in SQL |
| BR-15 | TEST-L-05 | Frozen fields on a started event |
| BR-04 (re-verified) | TEST-K-02, TEST-J-04, TEST-O-02 | Drafts seen by others; cancelled events registrable |
| BR-06 (re-verified) | TEST-N-02, TEST-N-06 | A second active registration after re-registering |
| BR-13 (re-verified) | TEST-K-05 | A participant saving a draft |
| BR-01 (re-verified) | TEST-L-02 | Capacity edits outside 1–256 |

5 / 5 Sprint 2 BRs have a rejection test. The 4 re-verified Sprint 1 BRs are covered as well.

---

## 5. TDD record

Fill this table from the real runs (README §3). The commit ids are the evidence for Deliverable 2 Part B.

| Issue | Tests written first | Red commit | Red run (failed / total) | Green commit | Green run (passed / total) |
|---|---|---|---|---|---|
| S2-01 SR-08 data foundation | TEST-SR8-01 (S2-01 part) … 04, TEST-SR1-02 (revised), TEST-SR2-04 (codes), TEST-B-02/B-03 and TEST-SR2-03 (E-17 rows); TEST-F-01, H-01, E-01 E2E lists (A1 `8694d76`) | `7c3ad62` | server 22 / 328 failed; E2E 3 / 9 failed (the three revised lists) | `dc987f9`, fixtures `dfa124f` | `dc987f9`: 322 passed, 1 failed, 5 skipped / 328 (2 Sprint 1 fixtures stored `CANCELLED` without `cancelledAt`); `dfa124f`: server 328 / 328, client 91 / 91, E2E 58 / 58 |
| S2-02 Feature-K drafts | TEST-K-01 … 05, TEST-B-02/B-03 and TEST-SR2-03 (E-14 rows), TEST-E-01 (rows); TEST-G-04 draft case revised (`1730bc8`) | `47b3838` (+ setup fix `c1dc85b`) | server 17 failed, 6 skipped / 356 (the K-02 and K-05 setups get 400 for `saveAsDraft`); client 6 / 99; E2E TEST-K-03 1 / 1 | `40f5687` (+ client test type fix `e4c8940`) | server 356 / 356, client 99 / 99, build OK, E2E 63 / 63 |
| S2-03 Feature-J search | TEST-J-01 … 06 | `82b7aa9` | server search files 16 failed / 18 (the 2 that passed are the stub's trivial cases), from [#94](https://github.com/GGital/My-little-pony/pull/94) | `2c5e075`; review fixes `18564ab` (literal `%` and `_`), `a0a86f3`, `23d5526` | server 375 / 375, client 152 / 152, E2E 75 / 75 at the approved head (review of #94); filled by S2-08 from the #94 record |
| S2-04 Feature-L edit | TEST-L-01 … 06, TEST-SR8-01 (capacity step), TEST-B-02/B-03 and TEST-SR2-03 (E-13 rows); MANAGE and SAVE DRAFT tests revised (`5a26d7e`) | `0906f89` | server 25 / 387; client 13 / 109; E2E TEST-L-01 1 / 1 | `9f71b81` (+ test fixes `c475497`, `326e084`, `b5cf763`) | server 387 / 387 (TEST-L-03 20 rounds; mutation check fails without the lock), client 109 / 109, build OK, E2E 69 / 69 |
| S2-05 Feature-O cancel event | TEST-O-01 … 06, TEST-B-03 (E-15 rows) | `47e1cee` | server 33 / 45 failed, 9 skipped (suites that failed in set-up); client 13 / 14 failed | `c2e0238` | server 455 / 455 (full suite, rebased on S2-04 and S2-06); client 179 / 179; E2E 84 / 84 |
| S2-06 Feature-M deadline | TEST-M-01 … 03 (TEST-M-04 moved to S2-07), TEST-SR8-01 (deadline step) | `d348686` (+ clock reset `26a6e4e`) | server 16 / 423 (one of them a clock cascade, fixed in `26a6e4e`); client 4 / 167; E2E TEST-M-03 1 / 1 | `3886e35` | server 423 / 423, client 167 / 167, build OK, E2E 86 / 86 |
| S2-07 Feature-N cancel / re-register | TEST-N-01 … 06, TEST-M-04, TEST-B-03 (E-16 row) | `95d8e69` | server 15 / 490 failed; client 5 / 5 failed (new file); E2E not run red | `62db165` | server 490 / 490; client 192 / 192; E2E 90 / 90; both builds OK; TEST-N-06 3 full runs of 20 rounds green; `FOR UPDATE` mutation check recorded below |
| S2-09 Feature-U game and store profile | TEST-U-01 … 05, TEST-B-03 (E-23 rows) | `9f3b967`; review 2: `0ed888b`, `48e3ab1` | server 53 / 549 failed (4 new tests pass on Sprint 1 behaviour: unknown `game` key and query key give 400, and Dragon's store is untouched); client 22 / 215 failed; E2E not run red | `19bd097` (implementation `9e282b5`; the client suite is green only from `19bd097`, which makes the earlier create-form tests choose a game; test fix `36057bd`); review 2 (D-41): `7af6773` | server 549 / 549, client 215 / 215, E2E 91 / 91 (incl. TEST-U-02), both builds OK; review 2: client 225 / 225, E2E 92 / 92, build OK |
| S2-10 Deep Lagoon theme and type | TEST-C-07, TEST-C-08 | `ec3e8a0` | unit 23 / 51 failed; E2E 2 / 10 failed (axe rows pass on the old palette) | `e671f38` | client 142 / 142; E2E 59 / 59 (incl. 21 / 21 TEST-SR5-01) |
| S2-08 Integration and release `v0.2.0` | JRN-03, JRN-04, TEST-SR5-05, TEST-C-08 (edit, store profile, past and cancelled cards), TEST-U-08 (feature CSS after theme.css); the Sprint 2 coverage check (`sts:check -- sprint-2`) | `7f4a1b3` | E2E 2 failed / 28 (the CSS order and the dimmed-card contrast, 12 nodes at 2.65 … 3.57 : 1); `sts:check -- sprint-2` 32 problems (rows still Pending). The journeys and TEST-SR5-05 pass on their first correct run: they check behaviour built in S2-01 … S2-10. The first run had one spec mistake (the not-found text), fixed in the spec — `evidence/S2-08-*.txt` | `abbc44b`; rename `2075544`; records (this commit) | release candidate `2075544`: see §6 |

For the Deliverable 2 PDF excerpts, keep red and green output for **TEST-L-03** or **TEST-N-03** (domain rule) and
**TEST-N-05** (access restriction).

---

## 6. Results (filled at release)

| Item | Value |
|---|---|
| Release commit / tag | **`v0.2.0` = `a32b3ba`**, the `main` merge commit of release PR [#115](https://github.com/GGital/My-little-pony/pull/115) (`sprint-2-staging` `5f11dcb` → `main`; Praewa approved 27 Nov 2026 09:55 UTC). Its code is the release candidate `2075544` (on the S2-08 branch; the later commits were records only) |
| Deploy (DoD-10) | Deploy demo run [45986583748](https://github.com/GGital/My-little-pony/actions/runs/45986583748), 27 Nov 2026 10:58–11:06 UTC: tests 549 / 225 / 109 passed, 0 failed, 0 skipped; migration job `tcg-event-hub-migrate-dp8n7` applied `0003`, `0004` and the seed; revision **`tcg-event-hub-00019-vgc`** at 100 % (replaces `00018-s6f`, Lab 7); smoke 5 PASS (`/api/version` = `a32b3ba`) — `evidence/S2-REL-deploy.txt` |
| Post-deploy checks (DoD-10) | **S2-D01 Pass** (27 Nov 11:15 UTC, `a32b3ba`): on the live site Quantum Cards saved a draft (event 54), Nok got the not-found page and `404`, Quantum Cards published it, Nok registered, capacity 8 → 12 and a deadline, Nok cancelled and registered again, Quantum Cards cancelled the event with a reason, Nok saw **Event cancelled**; E-17 lists the 5 changes, display name only — `evidence/S2-D01-*-live.*` (11 steps). **S2-D02 Pass** (11:50 UTC): a visitor browser with no session read event 54 unchanged (`CANCELLED`, the reason, capacity 12, the deadline) — `evidence/S2-D02-live.*`. The tester signed in by hand; a Playwright script did the steps |
| Server / client / E2E counts (passed / failed / skipped) | Server **549 / 0 / 0** (47 files; `typecheck` 0 errors) — `evidence/S2-08-rc-server.txt` · client **225 / 0 / 0** (38 files) and `npm run build` OK — `evidence/S2-08-rc-client.txt` · E2E **109 / 0 / 0** (53 Sprint 1 and Lab 7, 56 Sprint 2) — `evidence/S2-08-rc-e2e.txt` |
| Concurrency, 20 rounds: TEST-L-03, N-06, O-06 | All pass inside the server run: TEST-L-03 20 rounds; TEST-N-06 20 rounds, plus 20 rounds of two simultaneous cancels; TEST-O-06 20 rounds of 5 simultaneous cancels and 20 rounds of 1 cancel + 10 registrations; Sprint 1 TEST-G-06 20 rounds. The `FOR UPDATE` mutation checks are in §5 (S2-04, S2-05, S2-07) — `evidence/S2-08-rc-server.txt` |
| Sprint 1 regression (all 55 rows + JRN-01, JRN-02) | Green: 301 Sprint 1 server tests, the Sprint 1 E2E specs with JRN-01 and JRN-02, and `npm run sts:check` (Sprint 1: 47 / 47 ACs, 59 rows Pass including the Lab 7 rows, 12 / 12 BRs). The Sprint 1 tests changed in Sprint 2 are listed in Sprint 1 STS §8 (S2-01, S2-02, S2-07, S2-09); none changed in S2-08 |
| Coverage (`npm run sts:check` against `sprint-2`) | **44 / 44** ACs with a test and a recorded result; 55 §2 rows, 55 Pass, 0 Fail; 5 / 5 BRs with a rejection test — `evidence/S2-08-green-sts-check.txt`. Red before S2-08: 32 problems — `evidence/S2-08-red-sts-check.txt` |
| Failed / skipped tests and known limitations | **None failed or skipped.** Known limitations: (1) where focus goes after a confirmed Cancel registration (review of #112) is not yet specified or tested; it moves to S3-07 (#104), the accessibility Issue; (2) JRN-02 and the browser races show the rule but cannot force the timing; the locks are proven by the 20-round server tests; (3) TEST-SR5-02 was planned twice (Sprint 2 and Sprint 3): Sprint 2's is now TEST-SR5-05 (team decision 27 Nov) |

## 7. Test commands

These are the same as Sprint 1 STS §7. Since S2-08, `scripts/sts-coverage.mjs` takes the sprint folder as an
argument: `npm run sts:check` checks Sprint 1, and `npm run sts:check -- sprint-2` checks this sprint.

## 8. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 21 Nov 2026 | First draft: strategy additions, concurrency plan, 37 AC tests, 6 regression rows, JRN-03 and JRN-04, AC map, BR rejection map, empty TDD and results tables | Team (AI-assisted) |
| v0.2 | 21 Nov 2026 | Contracts v0.2 (D-24): §2.8 Feature-U, TEST-U-01 … 03; regression table becomes §2.9; AC map and TDD row S2-09; 40 AC tests | Team (AI-assisted) |
| v0.3 | 21 Nov 2026 | Contracts v0.4 (D-37): TEST-U-04 (store contact on events, no sign-in email leak) and TEST-U-05 (contact validation and safe links); 42 AC tests | Team (AI-assisted) |
| v0.4 | 21 Nov 2026 | Contracts v0.5 (D-38): §2.9 TEST-C-07 (tokens, fonts, Thai fallback, self-hosting) and TEST-C-08 (contrast and axe); TDD row S2-10; 44 AC tests | Team (AI-assisted) |
| v0.5 | 25 Nov 2026 | Contracts v0.6 (Lab 7 CH-13, Issue #77): TEST-K-04 adds drafts starting in 30 min (422) and 60 min (200); TEST-L-04 adds `startAt` = T + 59 min (422) and T + 60 min (200) | Team (AI-assisted) |
| v0.6 | 25 Nov 2026 | S2-01: TEST-SR8-01 is split (team decision 24 Nov). E-13 arrives in S2-04, so S2-01 checks the creation row (E-06 writes `status` null → `PUBLISHED`) and E-17; the capacity and deadline steps join the test in S2-04. TEST-SR1-02, TEST-F-01 and the Sprint 1 E2E lists TEST-F-01, TEST-H-01 and TEST-E-01 change because the seed now has EV-7 … EV-9 (rule 1). §2.1, §2.10 and §5: S2-01 results (red `7c3ad62`, green `dc987f9`, fixtures `dfa124f`) | Team (AI-assisted) |
| v0.7 | 25 Nov 2026 | Contracts v0.7 (S2-02): TEST-K-01 (C) lands on `/events/:id`; TEST-K-03 gains the (C) file `Drafts.test.tsx`. §2.2, §2.10 and §5: S2-02 results (red `47b3838`, green `40f5687`) | Team (AI-assisted) |
| v0.8 | 26 Nov 2026 | Contracts v0.8 (S2-03): TEST-J-01 gains a built event with `%` and `_` in its title; TEST-J-05 gains Back, Forward, page 2, chip removal and the axe scan. §2.7 and §5: S2-03 results (red `82b7aa9`, green `2c5e075`, review fixes `18564ab`, `a0a86f3`, `23d5526`) | Team (AI-assisted) |
| v0.9 | 26 Nov 2026 | Contracts v0.8 (S2-04). TEST-SR8-01 is split again: S2-04 runs the capacity step; the deadline step moves to S2-06 with Feature-M. §2.1, §2.3, §2.10 and §5: S2-04 results and the TEST-L-03 mutation check | Team (AI-assisted) |
| v0.10 | 26 Nov 2026 | S2-05 Feature-O: TDD row and test statuses; TEST-O-06 gets a double-cancel round | Team (AI-assisted) |
| S2-06 | 26 Nov 2026 | TEST-M-04 moves to S2-07 (#84) with `canCancel` and E-16 (decision 26 Nov); the TEST-M-02 and M-03 unit tests live in `unit/deadline.unit.test.ts`; TEST-SR8-01 gains its deadline step, completing AC-SR8-01. §2.1, §2.4 and §5: S2-06 results | Team (AI-assisted) |
| S2-07 | 26 Nov 2026 | Feature-N: E-16, `canCancel`, `cancelledAt`; TEST-M-04 done. E-08 now lists the player's own CANCELLED rows with `cancelledAt` (contracts §3 UI, §5 AC-N-01), not counted in `registeredCount`; the Sprint 1 assertions that listed only active rows (TEST-I-01) and the exact `viewer` shape (TEST-D-01, F-02, F-04, G-01) are updated for `canCancel`. §5: S2-07 results. Mutation check: with `FOR UPDATE` removed the double-cancel round fails (200 + 200); the cancel-vs-10-registrations round did not fail, because the registrations queue behind row updates anyway | Team (AI-assisted) |
| S2-07 | 26 Nov 2026 | Review of #112: TEST-N-06's first round asserts at most one winner, active = 1 + winners and at least one winning round in 20 (the test change is its own commit, with the reason); TEST-I-01 gains an `EVENT_CANCELLED` row; the event-page Cancel registration client test; TEST-B-03 rows for E-16 (visitor 401, owner 403, another organizer 403, another player 404, own 200) | Team (AI-assisted) |
| S2-09 | 26 Nov 2026 | Feature-U: E-23, `game` on E-06/E-13/E-04, store on E-05; TEST-U-01 … 05 done; earlier create-form tests and E2E specs choose a game (own commit) | Team (AI-assisted) |
| S2-09 | 26 Nov 2026 | Review of [#113](https://github.com/GGital/My-little-pony/pull/113): green run recorded at `19bd097`; TEST-U-01 … 05 Pass; review fixes `61d1341` (red) and `c0052f9` (an empty host section is hidden, focus on the first invalid field, hints inside labels) | Team (AI-assisted) |
| S2-09 | 26 Nov 2026 | Review 2 of [#113](https://github.com/GGital/My-little-pony/pull/113) (D-41): TEST-U-06 … 08 added (store games first, Store profile in the account menu, toggle styling); TEST-U-02 now checks the heading and no card chips (own commit `48e3ab1`); red `0ed888b`, `48e3ab1`, green `7af6773` | Team (AI-assisted) |
| v0.11 | 27 Nov 2026 | S2-08 (#87): covers the S2-06, S2-07 and S2-09 rows above. JRN-03, JRN-04 and TEST-SR5-05 (renumbered from TEST-SR5-02, which is Sprint 3's axe scan, team decision 27 Nov) Pass; TEST-C-08 scans edit event, store profile and past and cancelled cards; TEST-U-08 checks that feature CSS comes after theme.css. §2 results from the release candidate `2075544` (the S2-07 rows were still Pending); §5 S2-03 row from the #94 record and the S2-08 row; §6 results; §7 `sts:check -- sprint-2` | Team (AI-assisted) |
| v0.12 | 27 Nov 2026 | S2-08 (#87), after the release: §6 release commit `v0.2.0` = `a32b3ba` (PR #115), the deploy (run 45986583748, revision `tcg-event-hub-00019-vgc`) and the post-deploy checks S2-D01 and S2-D02, both Pass | Team (AI-assisted) |
