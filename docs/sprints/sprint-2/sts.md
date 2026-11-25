# Sprint 2 Software Test Specification (STS)

Project: **TCG Event Hub** · Sprint 2 · Document version: v0.4 — **draft for team review** (changes in §8)
Contracts: [`feature-contracts.md`](feature-contracts.md) v0.5 · Issues and Definition of Done: [`README.md`](README.md) ·
Sprint 1 STS: [`../sprint-1/sts.md`](../sprint-1/sts.md) v1.13

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
| TEST-N-06 | full event (2 / 2), 10 participant agents; Mint with 1 active | P1's E-16 + 10 × E-09; Mint 2 × E-16 | exactly one new `201`; active = 2; Mint gets one `200` and one `409` |
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
| TEST-SR8-01 | I | AC-SR8-01, FR-28 | O1 signed in; clock T | E-06 (capacity 24); clock T + 1 h, E-13 capacity 30; clock T + 2 h, E-13 deadline; E-17 | 3 items newest first: `deadline` (old = start ISO, new = deadline ISO), `capacity` 24 → 30, `status` null → `PUBLISHED`; `changedBy.displayName` "Quantum Cards"; `changedAt` = clock times; the body has no `email`, `changedById` or user id | `server/tests/sprint-2/changes.api.test.ts` | Pending |
| TEST-SR8-02 | I | AC-SR8-02, X-11 | 2 change rows | `UPDATE "EventChange" SET "newValue" = 'x'`; `DELETE FROM "EventChange"` | both throw, naming `event_change_append_only`; the rows are unchanged (read back) | `server/tests/sprint-2/constraints.api.test.ts` | Pending |
| TEST-SR8-03 | I | AC-SR8-03, BR-08, BR-12 | — | SQL: deadline = start + 1 min; `status = 'CANCELLED'` with null `cancelReason`; a registration `CANCELLED` with null `cancelledAt`; also `PUBLISHED` with `cancelledAt` set | each is rejected with SQLSTATE 23514 and the constraint name (`event_deadline_before_start`, `event_cancel_fields`, `registration_cancel_fields`) | `server/tests/sprint-2/constraints.api.test.ts` | Pending |
| TEST-SR8-04 | I | AC-SR8-04, NFR-02 | event X owned by O1 | E-17 for X as O2, P, visitor; E-17 for 999999 as O1; `/abc` | `404` (body equal to the 999999 body), `403`, `401`, `404`, `400` | `server/tests/sprint-2/changes.api.test.ts` | Pending |

### 2.2 Feature-K — drafts

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-K-01 | I, C | AC-K-01, FR-08 | O1; clock T | E-06 valid body + `saveAsDraft: true`; E-07; E-05 as O1. (C) the create form: press SAVE DRAFT with E-06 stubbed | `201`, row `DRAFT`, `publishedAt null`, `organizerId` O1; 1 change row `null → DRAFT`; E-07 includes it with `status DRAFT`; E-05 `MANAGE`. (C) the body has `saveAsDraft: true`; navigates to `/organizer/events/:id/edit`; toast text | `server/tests/sprint-2/drafts.api.test.ts`, `client/tests/sprint-2/CreateEvent.draft.test.tsx` | Pending |
| TEST-K-02 | I | AC-K-02, BR-04 | draft D (O1); published E; visitor, Nok, O2 sessions | E-04 plain, `include=past,cancelled`, `q=<D title>`; E-05 D for each viewer; E-09 D by Nok | D in no list; E-05 ×3 `404 EVENT_NOT_FOUND`, each body equal to the 999999 body; E-09 `404`, Registration count 0 | `server/tests/sprint-2/drafts.api.test.ts` | Pending |
| TEST-K-03 | I, E2E | AC-K-03, FR-08, FR-28 | draft D; clock T | E-14 by O1; E-04 as visitor. (E2E) Quantum Cards: dashboard → Publish on EV-7 | `200`, `PUBLISHED`, `publishedAt = T`, change row `DRAFT → PUBLISHED`; D is listed. (E2E) toast "Your event is live." and EV-7 appears on `/events` | `server/tests/sprint-2/drafts.api.test.ts`, `e2e/sprint-2/drafts.spec.ts` | Pending |
| TEST-K-04 | U, I | AC-K-04, BR-02, D-21 | draft starting T + 1 h; clock moved to T + 2 h; published P; cancelled C | (U) `decidePublish` with each state; (I) E-14 on each | (U) `EVENT_TIME_INVALID`, `ALREADY_PUBLISHED`, `ALREADY_CANCELLED`. (I) `422` field `startAt`, still `DRAFT`; `409 ALREADY_PUBLISHED`; `409 ALREADY_CANCELLED`; change-row count unchanged | `server/tests/sprint-2/unit/event-lifecycle.unit.test.ts`, `server/tests/sprint-2/drafts.api.test.ts` | Pending |
| TEST-K-05 | I | AC-K-05, BR-13, BR-17 | draft D (O1) | E-14 by O2, P, visitor, `Origin: https://evil.example`; E-06 by P with `saveAsDraft`; E-06 by O1 with `saveAsDraft: "yes"`, with `status: "DRAFT"` | `404`, `403`, `401`, `403`; `403`; `400` (`saveAsDraft`), `400` (`status`); event and change-row counts unchanged | `server/tests/sprint-2/drafts.api.test.ts` | Pending |

### 2.3 Feature-L — editing and capacity

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-L-01 | I, C, E2E | AC-L-01, FR-09, #64 | upcoming event (O1) with 3 registrations | E-13 `{title, venueName, description}`; E-05. (C) the edit page sends only the changed fields; SAVE CHANGES disabled until a change. (E2E, JRN-03) | `200` with the new values; E-05 agrees; the 3 registrations are unchanged (ids, status); 1 change row `details` "title, venueName, description". (C) the PATCH body = changed keys only; toast | `server/tests/sprint-2/edit.api.test.ts`, `client/tests/sprint-2/EditEvent.test.tsx` | Pending |
| TEST-L-02 | U, I | AC-L-02, BR-09, BR-01 | capacity 24, 3 active | (U) `decideCapacity(active 3, new 2 / 3)`; (I) E-13 `capacity` 3, 2, 256, 257, 0, 1.5, 30 | (U) `CAPACITY_BELOW_REGISTERED` / OK. (I) `200`; `409` "3 players are registered, so capacity can't go below 3."; `200`; `400` ×3; `200` with `seatsRemaining 27` = 30 − independent count; 3 `capacity` change rows; the registration rows are unchanged | `server/tests/sprint-2/unit/event-lifecycle.unit.test.ts`, `server/tests/sprint-2/edit.api.test.ts` | Pending |
| TEST-L-03 | I | AC-L-03, BR-09, NFR-05 | §1.4 | §1.4, 20 rounds | §1.4 invariant every round | `server/tests/sprint-2/lifecycle.concurrency.api.test.ts` | Pending |
| TEST-L-04 | U, I | AC-L-04, BR-02, NFR-11 | event at T + 2 d, 4 h long; clock T | E-13 `startAt` T − 1 min; `endAt` only = start + 25 h; `endAt` only = start + 24 h; `startAt` + `endAt` moved 1 day later; then E-04 | `422 startAt`; `422 endAt`; `200`; `200`, and the E-04 order changes | `server/tests/sprint-2/edit.api.test.ts` | Pending |
| TEST-L-05 | U, I, C | AC-L-05, BR-15, D-19 | event started 1 h ago; also one with `startAt` = now | E-13 `{description, feeLabel}`; `{capacity}`; `{startAt, title}`; the same on the "starts now" event. (C) the edit page with `hasStarted: true` | `200`; `409 EVENT_STARTED` details `[capacity]`; `409` details `[startAt, title]`; the "now" event behaves as started; DB values unchanged. (C) the frozen inputs are read-only and the note is shown | `server/tests/sprint-2/edit.api.test.ts`, `client/tests/sprint-2/EditEvent.test.tsx` | Pending |
| TEST-L-06 | I | AC-L-06, BR-14, NFR-02 | event X (O1); cancelled C (O1) | E-13 X by O2, P, visitor, foreign Origin; `{}`; `{organizerId: 2}`; E-13 C by O1 | `404`, `403`, `401`, `403`, `400` "Change at least one field.", `400`; `409 ALREADY_CANCELLED`; X and C rows unchanged | `server/tests/sprint-2/edit.api.test.ts` | Pending |

### 2.4 Feature-M — registration deadline

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-M-01 | I, C | AC-M-01, BR-08 | O1; clock T | E-06 without a deadline; E-06 with start − 2 h; E-13 a deadline on the first; E-05. (C) the detail page with `registrationDeadline` | `registrationDeadline` = `startAt`; = start − 2 h; `200` + a `deadline` change row; (C) "Registration closes Thu 5 Nov · 15:00" (Bangkok) | `server/tests/sprint-2/deadline.api.test.ts`, `client/tests/sprint-2/EventDetail.deadline.test.tsx` | Pending |
| TEST-M-02 | U, I | AC-M-02, BR-08, D-23 | event at T + 1 d; clock T | E-13 deadline = start + 1 min; = T; = T − 1 min; = start; `null`; then (deadline T + 20 h stored) `startAt` = T + 2 h | `422` ×3 on `registrationDeadline` with the contract messages; `200`; `200` and the response deadline = `startAt`; `422` on `registrationDeadline` | `server/tests/sprint-2/unit/event-lifecycle.unit.test.ts`, `server/tests/sprint-2/deadline.api.test.ts` | Pending |
| TEST-M-03 | U, I, E2E | AC-M-03, BR-08, BR-04, D-17 | open events with deadline D < start, seats left; Nok | (U) `decideRegistration` at D − 1 min, D, D + 1 min; (I) E-09 at the same times; E-05 at D; E-04 at D. (E2E) EV-9 as Nok | (U) OK, `REGISTRATION_CLOSED` ×2. (I) `201`, `409` ×2, 0 extra rows; E-05 `CLOSED`; the event is still in E-04. (E2E) disabled **REGISTRATION CLOSED** | `server/tests/sprint-2/unit/registration-rules.unit.test.ts`, `server/tests/sprint-2/deadline.api.test.ts`, `e2e/sprint-2/deadline.spec.ts` | Pending |
| TEST-M-04 | I | AC-M-04, BR-08, BR-11 | Mint registered; deadline D | E-10, E-11, E-05 at D − 1 min and at D; E-16 at D | `canCancel` true → false in all three; E-16 `409 REGISTRATION_CLOSED`, still `REGISTERED` | `server/tests/sprint-2/deadline.api.test.ts` | Pending |

### 2.5 Feature-N — cancel and re-register

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-N-01 | I, C, E2E | AC-N-01, FR-19, FR-28 | Mint registered, event 3 / 24; clock T | E-16; E-10; E-08 as owner; E-05 as Mint. (C) My Events: Cancel → dialog → confirm; busy state. (E2E, JRN-03) | `200 CANCELLED`, `cancelledAt T`, counts 2 / 24 / 22 by independent count; the row still exists; E-08 row Cancelled + time; E-05 `REGISTER`. (C) dialog text, "Cancelling…" with `aria-busy`, chip, toast | `server/tests/sprint-2/cancel-registration.api.test.ts`, `client/tests/sprint-2/MyEvents.cancel.test.tsx` | Pending |
| TEST-N-02 | I | AC-N-02, FR-20, BR-06 | after N-01 | E-09 by Mint twice | first `201` with a new id; rows for (event, Mint) = 2 (1 `CANCELLED`, 1 `REGISTERED`); E-05 `REGISTERED` + the new id; second `409 ALREADY_REGISTERED` | `server/tests/sprint-2/cancel-registration.api.test.ts` | Pending |
| TEST-N-03 | I | AC-N-03, BR-05 | full event 2 / 2 (Ploy, Boss) | Ploy E-16; Nok E-09; Ploy E-09 | `200`; `201`; `409 EVENT_FULL`; active = 2 | `server/tests/sprint-2/cancel-registration.api.test.ts` | Pending |
| TEST-N-04 | U, I | AC-N-04, BR-11 | Mint's rows: `CANCELLED`, `EVENT_CANCELLED`, `CHECKED_IN` (SQL), and `REGISTERED` past the deadline | (U) `decideCancellation` per state; (I) E-16 on each | `409 ALREADY_CANCELLED` ×2, `409 ALREADY_CHECKED_IN`, `409 REGISTRATION_CLOSED`; all rows unchanged | `server/tests/sprint-2/unit/registration-rules.unit.test.ts`, `server/tests/sprint-2/cancel-registration.api.test.ts` | Pending |
| TEST-N-05 | I | AC-N-05, BR-11, BR-16, BR-17, NFR-02 | Mint's active registration R | E-16 R by Ploy, O1 (owner), visitor, foreign Origin; by Mint with `{participantId}`; E-16 999999 by Mint; `/abc` | `404` (equal to the 999999 body), `403`, `401`, `403`, `400`; `404 REGISTRATION_NOT_FOUND`; `400`; R unchanged | `server/tests/sprint-2/cancel-registration.api.test.ts` | Pending |
| TEST-N-06 | I | AC-N-06, NFR-05, BR-06 | §1.4 | §1.4, 20 rounds | §1.4 invariant every round | `server/tests/sprint-2/lifecycle.concurrency.api.test.ts` | Pending |

### 2.6 Feature-O — event cancellation

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-O-01 | I | AC-O-01, FR-10, BR-12, FR-28 | event (O1): 3 `REGISTERED`, 1 `CANCELLED` (cancelled at T − 1 h); clock T | E-15 `{reason: "Store closed for renovation."}` | `200`; event `CANCELLED`, `cancelledAt T`, `cancelledById` O1, reason stored trimmed; the 3 rows `EVENT_CANCELLED`, `cancelledAt T`; the old `CANCELLED` row keeps T − 1 h; 1 change row `PUBLISHED → CANCELLED` | `server/tests/sprint-2/cancel-event.api.test.ts` | Pending |
| TEST-O-02 | I, C, E2E | AC-O-02, BR-04, BR-12, FR-14 | after O-01 | E-09 Nok; E-13, E-14, E-15 by O1; E-04 plain and `include=cancelled`; E-05 visitor; E-10 affected player. (C) detail banner; My Events chip. (E2E) EV-8 as Boss | `409 REGISTRATION_CLOSED`; `409 ALREADY_CANCELLED` ×3; absent / present with `CANCELLED`; E-05 has `cancelReason`, `CLOSED`, no `cancelledById` key; E-10 `EVENT_CANCELLED`. (C, E2E) "Cancelled by the organizer: …", **Event cancelled** | `server/tests/sprint-2/cancel-event.api.test.ts`, `client/tests/sprint-2/EventDetail.cancelled.test.tsx`, `e2e/sprint-2/cancel-event.spec.ts` | Pending |
| TEST-O-03 | U, I, C | AC-O-03, BR-12 | upcoming events | `reason` missing, `"abcd"`, 201 chars, 5 spaces; then 5 and 200 chars. (C) the dialog counter and disabled button below 5 | `400` ×4 "Give a reason of 5 to 200 characters.", unchanged; `200` ×2 | `server/tests/sprint-2/unit/event-input.unit.test.ts`, `server/tests/sprint-2/cancel-event.api.test.ts`, `client/tests/sprint-2/CancelEventDialog.test.tsx` | Pending |
| TEST-O-04 | U, I | AC-O-04, BR-12, D-16 | started 1 min ago; starts now; draft | E-15 on each | `409 EVENT_STARTED` ×2; `409 NOT_PUBLISHED`; all unchanged | `server/tests/sprint-2/cancel-event.api.test.ts` | Pending |
| TEST-O-05 | I | AC-O-05, BR-14, NFR-02 | event X (O1) | E-15 by O2, P, visitor, foreign Origin | `404`, `403`, `401`, `403`; X unchanged | `server/tests/sprint-2/cancel-event.api.test.ts` | Pending |
| TEST-O-06 | I | AC-O-06, BR-12, NFR-05 | §1.4 | §1.4, 20 rounds | §1.4 invariant every round | `server/tests/sprint-2/lifecycle.concurrency.api.test.ts` | Pending |

### 2.7 Feature-J — search and filters

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-J-01 | I | AC-J-01, FR-13 | the seed (9 events) loaded in the test DB | E-04 `q` = "quantum", "BANGKOK", "draft night", "เปิดกล่อง", "50%_off", 101 chars | the ids per the AC (EV-7 draft never present); `[]` for the `%_` text; `400` on `q` | `server/tests/sprint-2/search.api.test.ts` | Pending |
| TEST-J-02 | U, I | AC-J-02, FR-13, NFR-11, D-22 | built events: each type and format; 23:30 and 00:30 Bangkok around `to`; one full | each filter alone; all combined; `type=PARTY`, `from=2026-02-30`, `from > to`. (U) `bangkokDayRange('2026-11-25')` | exact id sets; 23:30 included, 00:30 excluded; `400` ×3 naming `type`, `from`, `to`. (U) `[2026-11-24T17:00:00.000Z, 2026-11-25T17:00:00.000Z)` | `server/tests/sprint-2/unit/search-query.unit.test.ts`, `server/tests/sprint-2/search.api.test.ts` | Pending |
| TEST-J-03 | I | AC-J-03, FR-13 | 45 matching events, some with equal `startAt` | pages 1 … 4; `page=0`, `page=abc` | 20 / 20 / 5 / 0 items; `meta` `{page, pageSize 20, totalItems 45}`; the union of the ids = all 45, no duplicates; sorted; `400` ×2 | `server/tests/sprint-2/search.api.test.ts` | Pending |
| TEST-J-04 | I | AC-J-04, FR-14, BR-04 | upcoming, started, cancelled, draft | `include` none / `past` / `cancelled` / `past,cancelled` / `drafts` | the AC sets; `400` for `drafts`; the draft id never appears | `server/tests/sprint-2/search.api.test.ts` | Pending |
| TEST-J-05 | C, E2E | AC-J-05, FR-13 | seed; (C) E-04 stubbed | (C) submit a search: URL and request query; chips; Clear all; empty state; live-region count. (E2E, JRN-04) | (C) `navigate('/events?q=quantum&format=CONSTRUCTED&page=1')`; the request has the same query; "21–40 of 45"; "No events match your search." + Clear filters. (E2E) Back restores the earlier list | `client/tests/sprint-2/EventSearch.test.tsx`, `e2e/sprint-2/search.spec.ts` | Pending |
| TEST-J-06 | I | AC-J-06, BR-16, NFR-15 | registrations on several events | E-04 `organizerId=1`, `participantId=3`; stringify every TEST-J-01 … 04 body | `400` ×2; no participant id, display name, email or `registrations` key | `server/tests/sprint-2/search.api.test.ts` | Pending |

### 2.8 Feature-U — game per event and store games (CH-11, D-24)

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-U-01 | U, I, C | AC-U-01, FR-29 | O1 signed in; upcoming event X (O1) | E-06 `game: "POKEMON"`; no `game`; `game: "CHESS"`; E-13 X `game: "MAGIC"`. (C) the create form submitted with no game chosen | `201 POKEMON`; `201 OTHER`; `400` on `game`, 0 rows; `200` + 1 `details` change row whose `newValue` includes `game`. (C) "Choose a game." under the group; no request sent | `server/tests/sprint-2/games.api.test.ts`, `client/tests/sprint-2/CreateEvent.game.test.tsx` | Pending |
| TEST-U-02 | I, C, E2E | AC-U-02, FR-29, FR-13 | events with POKEMON, MAGIC, OTHER games | E-04 `game=POKEMON`; `game=POKEMON&q=quantum`; `game=chess`. (C) choose Pokémon TCG and press Search. (E2E, JRN-04) filter by Pokémon TCG on the seed | the exact Pokémon ids; the AND set; `400` on `game`. (C) URL `game=POKEMON`, the chip "Game: Pokémon TCG". (E2E) EV-6 is shown and EV-1 is not | `server/tests/sprint-2/search.api.test.ts`, `client/tests/sprint-2/EventSearch.test.tsx`, `e2e/sprint-2/search.spec.ts` | Pending |
| TEST-U-03 | I, C | AC-U-03, FR-30, BR-17, NFR-02 | O1 owns event X | E-23 PATCH `{games:["POKEMON","MAGIC"]}`; then E-05 X as a visitor; PATCH `{games:[]}`; `["POKEMON","POKEMON"]`; `["X"]`; `{games:[], userId: 2}`; PATCH by P, by a visitor, with a foreign Origin. (C) the store page toggles chips and saves | `200`, E-05 `store.games` = both; `200 []`; `400` ×3; `403`, `401`, `403`; O2's profile is unchanged. (C) `aria-pressed` flips; the PATCH body holds the chosen games | `server/tests/sprint-2/games.api.test.ts`, `client/tests/sprint-2/StoreProfile.test.tsx` | Pending |
| TEST-U-04 | I, C | AC-U-04, FR-30, D-37, D-14 | O1 owns A (no event contact) and B (event contact set) | E-23 with the four contact fields; E-05 A and B as a visitor; E-23 `{contactLine:""}`; stringify the E-05 bodies. (C) the detail page for A and B | `200`; email trimmed and lower-cased; same `store.contact` on A and B; `line null` after clearing; no body contains O1's sign-in email. (C) `tel:` and `mailto:` hrefs; website text = host name; B shows "Contact for this event" first | `server/tests/sprint-2/games.api.test.ts`, `client/tests/sprint-2/EventDetail.contact.test.tsx` | Pending |
| TEST-U-05 | U, I, C | AC-U-05, NFR-15 | O1 | (U) `storeContactSchema` on each bad value; (I) E-23 with all bad values together, and `{}`. (C) the website link and a contact with `<b>bold</b>` | (U) each rejected with the table message. (I) one `400` naming every failing field, 0 rows changed; `{}` → `400`. (C) `target="_blank"`, `rel="noopener noreferrer nofollow"`; markup shown as text | `server/tests/sprint-2/unit/store-contact.unit.test.ts`, `server/tests/sprint-2/games.api.test.ts`, `client/tests/sprint-2/EventDetail.contact.test.tsx` | Pending |

### 2.9 Feature-C — Deep Lagoon theme and type (D-38)

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-C-07 | U, E2E | AC-C-07, D-38 | the built client; the seed | (U) parse `theme.css` and compare every `:root` token with `tests/fixtures/deep-lagoon.json` (the design-direction §2 table); check `package.json` has no `@fontsource/chakra-petch`. (E2E) open `/events`, EV-1 and EV-6 (Thai title), My Events; read computed styles, `document.fonts` and the network log | (U) all tokens equal; no Chakra Petch dependency. (E2E) body `font-family` starts with Inter; the seat count and date badge are Manrope with `tabular-nums`; IBM Plex Sans Thai loaded for EV-6; 0 requests to `fonts.googleapis.com` | `client/tests/sprint-2/unit/theme-tokens.unit.test.ts`, `e2e/sprint-2/theme.spec.ts` | Pass |
| TEST-C-08 | U, E2E | AC-C-08, NFR-10, NFR-08 | the token table; the seed; participant and organizer sessions | (U) a WCAG contrast function over every text and control pair; (E2E) `@axe-core/playwright` with only `color-contrast` on the 9 screens; rerun TEST-SR5-01 | (U) text ≥ 4.5, controls ≥ 3. (E2E) 0 violations; 21 / 21 width checks; PLAYER badge, seat chip and REGISTERED compute to `#1F6F43`, primary button to `#167D8D` | `client/tests/sprint-2/unit/theme-contrast.unit.test.ts`, `e2e/sprint-2/theme.spec.ts` | Pass |

### 2.10 Regression additions to Sprint 1 tests and journeys

| Test ID | Level | AC / Req | Change in Sprint 2 | File | Result |
|---|---|---|---|---|---|
| TEST-B-03 (rows added) | I | AC-B-03, NFR-02 | rows for E-13 … E-17 from SDS §7.1, including byte-identical 404s for another owner's event and another participant's registration | `server/tests/sprint-1/authorization.api.test.ts` | Pending |
| TEST-SR1-02 (revised) | I | AC-SR1-02 | 9 events; EV-7 `DRAFT`, EV-8 `CANCELLED` with Boss `EVENT_CANCELLED`, EV-9 with a past deadline and Mint `REGISTERED`; a second run adds 0 rows | `server/tests/sprint-1/seed.api.test.ts` | Pending |
| TEST-SR2-03 (rows added) | I | AC-SR2-03 | E-13 … E-17 in the route table; GET on the POST/PATCH-only paths → 404, no writes | `server/tests/sprint-1/validation.api.test.ts` | Pending |
| TEST-SR2-04 (codes added) | U | NFR-07 | `ALREADY_PUBLISHED`, `NOT_PUBLISHED` map to 409 | `server/tests/sprint-1/unit/errors.unit.test.ts` | Pending |
| TEST-E-01 (rows added) | I | AC-E-01 | E-07 includes the owner's draft and cancelled event with their status | `server/tests/sprint-1/organizer.api.test.ts` | Pending |
| TEST-SR5-02 | E2E | NFR-08 | the 3 new screens (edit, search with filters open, cancelled detail) at 390 / 768 / 1440 px, no horizontal scroll | `e2e/sprint-2/responsive.spec.ts` | Pending |
| JRN-03 | E2E | K, L, M, N, O, SR-08 | contracts §9 | `e2e/sprint-2/journey.spec.ts` | Pending |
| JRN-04 | E2E | J, FR-26 | contracts §9 | `e2e/sprint-2/journey.spec.ts` | Pending |
| JRN-01, JRN-02 | E2E | Sprint 1 | unchanged; must stay green (Deliverable 2 Part A continuity) | `e2e/sprint-1/journey.spec.ts` | Pending |

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
| S2-01 SR-08 data foundation | TEST-SR8-01 … 04, TEST-SR1-02 (revised), TEST-SR2-04 (codes) | | | | |
| S2-02 Feature-K drafts | TEST-K-01 … 05, TEST-B-03 (E-14 rows) | | | | |
| S2-03 Feature-J search | TEST-J-01 … 06 | | | | |
| S2-04 Feature-L edit | TEST-L-01 … 06, TEST-B-03 (E-13 rows) | | | | |
| S2-05 Feature-O cancel event | TEST-O-01 … 06, TEST-B-03 (E-15 rows) | | | | |
| S2-06 Feature-M deadline | TEST-M-01 … 04 | | | | |
| S2-07 Feature-N cancel / re-register | TEST-N-01 … 06, TEST-B-03 (E-16 rows) | | | | |
| S2-09 Feature-U game and store profile | TEST-U-01 … 05, TEST-B-03 (E-23 rows) | | | | |
| S2-10 Deep Lagoon theme and type | TEST-C-07, TEST-C-08 | `ec3e8a0` | unit 23 / 51 failed; E2E 2 / 10 failed (axe rows pass on the old palette) | `e671f38` | client 142 / 142; E2E 59 / 59 (incl. 21 / 21 TEST-SR5-01) |
| S2-08 Integration and release `v0.2.0` | JRN-03, JRN-04, TEST-SR5-02, TEST-E-01 (rows), TEST-SR2-03 (rows) | | | | |

For the Deliverable 2 PDF excerpts, keep red and green output for **TEST-L-03** or **TEST-N-03** (domain rule) and
**TEST-N-05** (access restriction).

---

## 6. Results (filled at release)

| Item | Value |
|---|---|
| Release commit / tag | `v0.2.0` — Pending |
| Server / client / E2E counts (passed / failed / skipped) | Pending |
| Concurrency, 20 rounds: TEST-L-03, N-06, O-06 | Pending |
| Sprint 1 regression (all 55 rows + JRN-01, JRN-02) | Pending |
| Coverage (`npm run sts:check` against `sprint-2`) | Pending |
| Failed / skipped tests and known limitations | Pending |

## 7. Test commands

These are the same as Sprint 1 STS §7. `scripts/sts-coverage.mjs` currently reads `docs/sprints/sprint-1` only.
S2-08 lets it take the sprint folder as an argument (`npm run sts:check -- sprint-2`), so both sprints can be
checked.

## 8. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 21 Nov 2026 | First draft: strategy additions, concurrency plan, 37 AC tests, 6 regression rows, JRN-03 and JRN-04, AC map, BR rejection map, empty TDD and results tables | Team (AI-assisted) |
| v0.2 | 21 Nov 2026 | Contracts v0.2 (D-24): §2.8 Feature-U, TEST-U-01 … 03; regression table becomes §2.9; AC map and TDD row S2-09; 40 AC tests | Team (AI-assisted) |
| v0.3 | 21 Nov 2026 | Contracts v0.4 (D-37): TEST-U-04 (store contact on events, no sign-in email leak) and TEST-U-05 (contact validation and safe links); 42 AC tests | Team (AI-assisted) |
| v0.4 | 21 Nov 2026 | Contracts v0.5 (D-38): §2.9 TEST-C-07 (tokens, fonts, Thai fallback, self-hosting) and TEST-C-08 (contrast and axe); TDD row S2-10; 44 AC tests | Team (AI-assisted) |
