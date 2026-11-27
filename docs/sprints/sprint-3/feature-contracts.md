# Sprint 3 Feature Engineering Contracts

Project: **TCG Event Hub** · Sprint 3 (23 Nov – 13 Dec 2026) · Document version: v0.2 — **draft for team review** (changes in §15)
Inputs: [`../../srs.md`](../../srs.md) v0.9 · [`../../features.md`](../../features.md) v0.7 ·
[`../../traceability.md`](../../traceability.md) v0.12 · [`../../system-sds.md`](../../system-sds.md) v0.15 ·
[`../plan.md`](../plan.md) v0.3 §4 · [`../../ui/design-direction.md`](../../ui/design-direction.md) v0.6 ·
Sprint 2 contracts: [`../sprint-2/feature-contracts.md`](../sprint-2/feature-contracts.md) v0.10 (released as `v0.2.0`) ·
Tests: [`sts.md`](sts.md) · Issues and Definition of Done: [`README.md`](README.md)

This document has one engineering contract per Sprint 3 feature (P, Q, R, S, T, V, and the tournament features W
and X added by CH-12) and per responsibility
completed in Sprint 3 (SR-05, SR-06, SR-07 at release). As in Sprints 1 and 2, they are written and reviewed
**before** implementation. The goal ([`../plan.md`](../plan.md) §4) is that organizers check players in at the door
and see real attendance, players see their history, store branding is complete, and the product is hardened for
accessibility, performance and sign-in abuse.

The Sprint 1 and Sprint 2 contracts still apply in full: check order, error shape, strict bodies, Origin check,
server clock, the openness rule (Sprint 2 §0.3), record keeping (SR-08) and the one-lock rule (SDS §4.3a). The Lab 7
change CH-13 also applies: E-06 accepts a start only at least 60 minutes ahead (BR-02, D-39). No Sprint 3 endpoint
creates events, so no Sprint 3 rule changes because of it.

---

## 0. Shared definitions for all Sprint 3 contracts

### 0.1 Time words (NFR-11, D-26)

All of these use the server clock, never the browser's.

| Word | Definition |
|---|---|
| **Check-in window** | `startAt − 60 min ≤ now < endAt`. At exactly `startAt − 60 min` it is open; at exactly `endAt` it is closed |
| **Ended** | `now ≥ endAt` |
| **In progress** | `startAt ≤ now < endAt` |
| **Final status** of a registration (BR-20) | `CHECKED_IN` and ended → `ATTENDED` · `REGISTERED` and ended → `NO_SHOW` · `CANCELLED` → `CANCELLED` · `EVENT_CANCELLED` → `EVENT_CANCELLED` · anything else → no final status yet |
| **Attendance rate** | `checkedIn ÷ (checkedIn + noShow)` over ended events; `null` (shown as "—") when the divisor is 0 or the event has not ended |
| **Fill rate** | `active ÷ capacity` for one event, where active = `REGISTERED` + `CHECKED_IN` |

Rates are returned as unrounded numbers from 0 to 1. The UI rounds half up to a whole percent (2/3 → "67%").

### 0.2 New and changed resource shapes

```jsonc
// OrganizerRegistrationRow (Sprint 1 §0.1, Sprint 2 §0.1) gains check-in fields
{ "id": 31, "participant": { "displayName": "Mint" }, "status": "CHECKED_IN",
  "createdAt": "…", "cancelledAt": null,
  "+checkedInAt": "2026-11-27T10:02:00.000Z", "+checkedInBy": { "displayName": "Quantum Cards" } }

// E-08 response gains the window, so the page never compares times itself
{ "items": [ /* rows */ ], "event": { "...EventSummary": "…" },
  "+checkIn": { "open": true, "opensAt": "…", "closesAt": "…" },
  "+counts": { "active": 20, "checkedIn": 12 } }

// AttendanceReport (E-20)
{ "event": { "...EventSummary": "…" }, "phase": "UPCOMING | IN_PROGRESS | ENDED | CANCELLED",
  "capacity": 24, "active": 20, "checkedIn": 15, "noShow": 5, "cancelled": 3, "eventCancelled": 0,
  "fillRate": 0.8333, "attendanceRate": 0.75 }        // noShow and attendanceRate are null until ENDED

// OrganizerSummary (E-21)
{ "from": "2026-11-01", "to": "2026-11-30", "events": 6, "cancelledEvents": 1,
  "registrations": 98, "checkIns": 71, "averageFillRate": 0.68, "attendanceRate": 0.79,
  "rows": [ { "id": 12, "title": "…", "startAt": "…", "phase": "ENDED", "fillRate": 0.75, "attendanceRate": 0.8 } ] }

// HistoryItem (E-22)
{ "registrationId": 31, "finalStatus": "ATTENDED | NO_SHOW | CANCELLED | EVENT_CANCELLED",
  "event": { "...EventSummary": "…" }, "cancelReason": null }
```

### 0.3 Seed additions (SR-01, re-verified)

EV-1 … EV-9 are unchanged. Sprint 3 adds two events: EV-10 has ended, so the report, the summary and the history
show real numbers on a fresh seed; EV-11 is a tournament in progress for the Swiss demonstration (CH-12). "S" is the seed run time.

| Key | Event | Details |
|---|---|---|
| EV-10 | Last Week's League Night, Quantum Cards, `MAGIC` | started S − 7 days, 4 h long, capacity 8. Ploy `CHECKED_IN` (by Quantum Cards), Boss `REGISTERED` (a no-show), Mint `CANCELLED` |
| EV-11 | Swiss Demo Cup, Dragon's Den, `TOURNAMENT`, `YUGIOH` | started S − 30 min, 5 h long, capacity 8; Mint, Ploy, Boss and Nok `CHECKED_IN` (tournament `NOT_STARTED`, so the demo starts it live: 4 players, 2 rounds) |

EV-4 ("Live Now Casual", started S − 1 h, Mint registered) is in its check-in window right after seeding. It is
the live check-in demonstration. After the seed: 6 users, **11** events. AC-SR1-02 is revised again (§13).

### 0.4 New error codes (SDS §6.2 v0.10)

| Status · code | Used by | Message shown |
|---|---|---|
| 409 `NOT_IN_CHECK_IN_WINDOW` *(SDS v0.1)* | E-18, E-19 | "Check-in is open from 60 minutes before the start until the end." |
| 409 `ALREADY_CHECKED_IN` | E-18 | "{name} is already checked in." |
| 409 `REGISTRATION_NOT_ACTIVE` **new** | E-18 | "This registration was cancelled, so it can't be checked in." |
| 409 `NOT_CHECKED_IN` **new** | E-19 | "{name} isn't checked in, so there's nothing to undo." |
| 429 `TOO_MANY_ATTEMPTS` *(SDS v0.1)* | E-01 | "Too many sign-in attempts. Try again in 10 minutes." |
| 400 `IMAGE_UNREADABLE` · 422 `IMAGE_TOO_SMALL` **new** | E-24, E-25 | "We couldn't read this image." · "Use an image at least {w} × {h} pixels." |
| 409 `NOT_A_TOURNAMENT` **new** | E-26 … E-31 | "This event isn't a tournament." |
| 409 `EVENT_NOT_IN_PROGRESS` **new** | E-26 | "A tournament can start once the event has started." |
| 409 `TOURNAMENT_STARTED`, `TOURNAMENT_NOT_RUNNING` **new** | E-26 … E-30 | "The tournament has already started." · "The tournament isn't running." |
| 409 `NOT_ENOUGH_PLAYERS` **new** | E-26, E-27 | "At least 2 checked-in players are needed." |
| 409 `ROUND_NOT_COMPLETE`, `NO_ROUNDS_LEFT`, `ROUND_LOCKED`, `ALREADY_DROPPED` **new** | E-27 … E-30 | "Enter every result of round {n} first." · "All {n} rounds are paired. Finish the tournament." · "Round {n} is closed: the next round has been paired." · "{name} has already dropped." |

### 0.5 Decisions made with these contracts (recorded in SRS §10.1)

D-26 (check-in window boundaries and no-shows counted only after the end) and D-27 (throttling counted per email,
including unknown emails; a success does not reset the count) are in SRS v0.6. These were proposed with the contracts
and are recorded in SRS §10.1 as well (D-28 … D-30 in v0.6, D-31 … D-36 in v0.7):

| ID | Decision | Why |
|---|---|---|
| D-28 | E-20, E-21 and E-22 count a re-registered participant once per event: the **latest** registration (by `createdAt`) decides that participant's status for the event | A player who cancelled and came back attended once, not "cancelled + attended" |
| D-29 | Attempts made while an email is locked are answered 429 and **not** recorded, so hammering does not extend the lock | The lock is exactly 10 minutes from the 5th failure, as NFR-16 says |
| D-30 | The organizer summary needs both `from` and `to`, at most 366 days apart; the page defaults to the last 30 days | A bounded range keeps NFR-12 measurable |
| D-31 … D-36 | Tournament decisions (CH-12): fixed entries at round 1, the own-opponent exception to BR-16, owner-only results, standard Swiss scoring and tiebreakers, a stored round-1 seed, Sprint 3 allocation | See SRS v0.7 §10.1 |

### 0.6 Contract template

The same as Sprints 1 and 2: **Links** · **Behaviour** · **Rules, validation, boundaries** · **Permissions** ·
**UI** · **API** · **Data** · **Acceptance criteria** · **Planned tests**.

---

## 1. Feature-P — Check-in and Undo

**Links:** FR-21, FR-22, FR-28; BR-18, BR-19; NFR-11 · Re-verifies: SR-08, BR-14, BR-16 · Depends on: Feature-I,
SR-08 · Issue S3-01

**Behaviour**
1. The owner opens the registration list (`/organizer/events/:id/registrations`), now titled **Door check-in**. The
   page shows "Checked in 12 / 20" and a **Find a player** box that filters the list by display name in the browser.
2. While `checkIn.open` is true, each `REGISTERED` row has **CHECK IN**. It calls
   `POST /api/organizer/registrations/:id/check-in` (E-18). The row turns teal: "Checked in 17:02", with **Undo**.
3. **Undo** calls `DELETE /api/organizer/registrations/:id/check-in` (E-19). The row returns to `REGISTERED`.
4. Outside the window, the buttons are not shown and the page says "Check-in opens at 16:00 (60 minutes before the
   start)" or "Check-in closed at 21:00".
5. Both endpoints lock the event row (SDS §4.3a). They write the registration fields and an `EventChange` row
   (`field attendance`, with `registrationId`, old → new status) in the same transaction (FR-28).

**Rules, validation, boundaries:** the check-in window and final statuses are defined in §0.1 (D-26). The order of
checks (E-18 / E-19) is 401 → 403 (role) → 403 (Origin) → 400 (path id; body `{}` or none) → 404
`REGISTRATION_NOT_FOUND` (missing, or its event is not the caller's) → lock → 409 `NOT_IN_CHECK_IN_WINDOW` → E-18:
409 `REGISTRATION_NOT_ACTIVE` (`CANCELLED`, `EVENT_CANCELLED`) → 409 `ALREADY_CHECKED_IN` → 200 · E-19: 409
`NOT_CHECKED_IN` (status is not `CHECKED_IN`) → 200.

**Permissions:** owner of the registration's event only. Another organizer gets 404, byte-identical to a missing
id (D-08). Participant 403, visitor 401.

**UI:** CHECK IN is a 44 px pill and shows "Checking in…" with `aria-busy`. Each row's result is announced in a
polite live region ("Mint checked in."). Undo is a text button. Focus stays on the row's new control. The count
updates without reloading the page.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-18 | `POST /api/organizer/registrations/:id/check-in` | `200 OrganizerRegistrationRow` | 400 · 401 · 403 · 404 · 409 (three codes) · 415 |
| E-19 | `DELETE /api/organizer/registrations/:id/check-in` | `200 OrganizerRegistrationRow` | 400 · 401 · 403 · 404 · 409 (two codes) |
| E-08 | *(changed)* gains `checkIn` and `counts`; rows gain `checkedInAt`, `checkedInBy` | — | — |

**Data:**
- `Registration.checkedInAt` (timestamptz null) and `checkedInById` (FK User, null), with
  `registration_checkin_fields` (SDS §4.3).
- `EventChange.registrationId` (FK, null) and the `field` value `attendance`.
- Migration `0005_sprint3_attendance`.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-P-01** | Quantum Cards owns event X (start T + 30 min), Mint `REGISTERED`; clock T | E-18 for Mint's registration; then E-08; UI: press CHECK IN on Mint's row | `200`, `status CHECKED_IN`, `checkedInAt = T`, `checkedInBy` "Quantum Cards"; the row in the database matches; one `EventChange` `attendance` REGISTERED → CHECKED_IN with Mint's registration id; E-08 `counts.checkedIn` = 1; seats unchanged; the UI shows "Checked in 17:02" (Bangkok), Undo, and the live-region text |
| **AC-P-02** | X starts at S, ends at E | E-18 with the clock at S − 61 min, S − 60 min, E − 1 min and E (separate registrations); E-19 at E for a checked-in one; E-08 `checkIn.open` at each time | `409 NOT_IN_CHECK_IN_WINDOW`, `200`, `200`, `409`; the undo at E is `409`; `open` = false, true, true, false |
| **AC-P-03** | Mint checked in at T | E-19 at T + 5 min; E-08; UI: press Undo | `200`, status `REGISTERED`, `checkedInAt` and `checkedInById` null; one `EventChange` CHECKED_IN → REGISTERED; the count goes back; the row shows CHECK IN again |
| **AC-P-04** | rows of X: Mint `CHECKED_IN`, Ploy `CANCELLED`, Boss `EVENT_CANCELLED` (on a cancelled event), Nok `REGISTERED` | E-18 Mint; E-18 Ploy; E-18 Boss; E-19 Nok | `409 ALREADY_CHECKED_IN`, `409 REGISTRATION_NOT_ACTIVE` ×2, `409 NOT_CHECKED_IN`; no row or change record changes |
| **AC-P-05** | Mint's registration on Quantum Cards' event | E-18 and E-19 by Dragon's Den, by Mint, by a visitor, with a foreign Origin, for id 999999 and `abc` by the owner | `404` (byte-identical to 999999), `403`, `401`, `403`, `404 REGISTRATION_NOT_FOUND`, `400`; nothing changes |
| **AC-P-06** | X in its window and before its deadline; Mint `REGISTERED`; 20 rounds | (a) two E-18 for Mint at the same time; (b) E-18 by the owner and E-16 by Mint at the same time | (a) one `200` and one `409 ALREADY_CHECKED_IN`, one change row; (b) either `CHECKED_IN` (E-16 got `409 ALREADY_CHECKED_IN`) or `CANCELLED` (E-18 got `409 REGISTRATION_NOT_ACTIVE`), never both and never a row with `cancelledAt` and `checkedInAt` both set |

**Planned tests:** TEST-P-01 … 06 (U, I, C, E2E). TEST-P-06 is a concurrency test.

---

## 2. Feature-Q — Event Attendance Report

**Links:** FR-23; BR-20; NFR-10 · Depends on: Feature-P · Issue S3-02

**Behaviour**
1. The owner opens `/organizer/events/:id/attendance` from the dashboard (**Attendance**) or from Door check-in.
2. `GET /api/organizer/events/:id/attendance` (E-20) computes every number by SQL aggregates when it is read
   (SD-13). With re-registration, each participant counts once per event (D-28).
3. The page shows one table, "Attendance for {title}":

   | Row | Value |
   |---|---|
   | Capacity | 24 |
   | Registered | 20 |
   | Cancelled by players | 3 |
   | Checked in | 15 |
   | No-shows | 5 |
   | Attendance rate | 75% |
   | Seats filled | 83% |

   Before the end, No-shows and Attendance rate read "After the event ends". On a cancelled event, the table
   reads "Event cancelled: {reason}" and both rates read "—".

**Rules:** `noShow` and `attendanceRate` are `null` until the event has ended (§0.1). `attendanceRate` is also
`null` when `checkedIn + noShow = 0`. For a cancelled event, `phase = CANCELLED`, the `EVENT_CANCELLED` count is
reported, and both rates are `null`. Drafts work too (all zeros), so an owner never meets an error page.

**Permissions:** owner only. Other organizer 404, participant 403, visitor 401.

**UI:** a real `<table>` with `<caption>` and `<th scope="row">`, not tiles or a big-number hero. The numbers use
tabular digits. It works at 390 px with no horizontal scroll (NFR-08) and passes the axe scan (NFR-10). It links
back to Door check-in.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-20 | `GET /api/organizer/events/:id/attendance` | `200 AttendanceReport` | 400 · 401 · 403 · 404 |

**Data:** no new fields.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-Q-01** | an ended event, capacity 24: 15 `CHECKED_IN`, 5 `REGISTERED`, 3 `CANCELLED`, and 1 participant who cancelled and then re-registered and checked in | E-20 by the owner; UI: open the page | `phase ENDED`, `active 21`, `checkedIn 16`, `noShow 5`, `cancelled 3` (the re-registered player is not counted as cancelled, D-28), `attendanceRate` 16/21, `fillRate` 21/24; each number equals an independent SQL count; the table shows "76%" and "88%" |
| **AC-Q-02** | the same event with the clock at `endAt − 1 min` and at `endAt` | E-20 at both times | first: `phase IN_PROGRESS`, `noShow null`, `attendanceRate null`, and the page reads "After the event ends"; second: `ENDED` with the numbers of AC-Q-01 |
| **AC-Q-03** | an ended event with no registrations; an ended event where all 4 registrations were cancelled; a cancelled event with 3 `EVENT_CANCELLED` | E-20 on each | `attendanceRate null` ("—") in all three, no error; the cancelled one has `phase CANCELLED`, `eventCancelled 3` and shows the reason |
| **AC-Q-04** | Quantum Cards' event | E-20 by Dragon's Den, Mint, a visitor; id 999999 and `abc` | `404` (byte-identical), `403`, `401`, `404`, `400` |
| **AC-Q-05** | the report page with data | axe scan; keyboard walk-through; widths 390 / 768 / 1440 | 0 serious or critical issues; the caption and row headers are read; no horizontal scroll |

**Planned tests:** TEST-Q-01 … 05 (U, I, C, E2E).

---

## 3. Feature-R — Organizer Attendance Summary

**Links:** FR-24; BR-20; NFR-12 · Depends on: Feature-Q · Issue S3-03

**Behaviour**
1. `/organizer/summary` (a **Summary** link in the organizer navigation) shows **From** and **To** date inputs,
   default the last 30 days up to today (Bangkok), and **Show summary**.
2. `GET /api/organizer/summary?from&to` (E-21) takes the caller's own events whose `startAt` falls in the Bangkok
   days `from` … `to` (both included, D-22), excluding drafts. Cancelled events are counted in `cancelledEvents`
   and left out of every other number.
3. The page shows a summary table (Events, Cancelled, Registrations, Check-ins, Average seats filled, Attendance
   rate) and a second table with one row per event, each linking to its report (Feature-Q).

**Rules, validation, boundaries**

| Check | Result |
|---|---|
| `from` or `to` missing, not `YYYY-MM-DD`, or not a real date | `400` on that key |
| `from > to` | `400` on `to`: "The end date must be on or after the start date." |
| range over 366 days (D-30) | `400` on `to`: "Choose at most one year." |
| unknown key (`organizerId`) | `400` |
| no events in range | `200` with zero counts, `averageFillRate null`, `attendanceRate null` |

- `registrations` = active registrations (`REGISTERED` + `CHECKED_IN`, latest per participant per event, D-28)
  over counted events. `checkIns` = `CHECKED_IN`.
- `averageFillRate` = the mean of each counted event's fill rate. `attendanceRate` = Σ checked in ÷ Σ (checked in +
  no-show) over **ended** counted events.
- NFR-12: with 500 events and 5,000 registrations, p95 < 500 ms (measured by SR-06).

**Permissions:** organizers; always only the caller's events (BR-14). Participant 403, visitor 401.

**UI:** native `<input type="date">` fields with visible labels; errors under the field; both tables have
captions; on phones the per-event table scrolls inside its own box, never the page.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-21 | `GET /api/organizer/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` | `200 OrganizerSummary` | 400 · 401 · 403 |

**Data:** no new fields. A query index is added only if SR-06 shows it is needed.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-R-01** | Quantum Cards in November: 3 ended events (fill 75%, 50%, 100%; attendance 8/10, 3/5, 0/0), 1 upcoming event (fill 25%), 1 cancelled event, 1 draft | E-21 `from=2026-11-01&to=2026-11-30` | `events 4`, `cancelledEvents 1`, the draft absent; `registrations` and `checkIns` equal independent counts; `averageFillRate` = mean(0.75, 0.5, 1, 0.25) = 0.625; `attendanceRate` = 11/15; `rows` has 4 entries in `startAt` order |
| **AC-R-02** | events at 23:30 Bangkok on 30 Nov and at 00:30 Bangkok on 1 Dec; Dragon's Den events in the same range | E-21 `to=2026-11-30` as Quantum Cards | the 23:30 event is included, the 00:30 one is not; no Dragon's Den event appears |
| **AC-R-03** | Quantum Cards | `from` after `to`; a 367-day range; `from=2026-02-30`; no `to`; `organizerId=2`; a range with no events | `400` ×5 naming the key; the empty range gives `200` with 0 counts and both rates `null` (shown "—") |
| **AC-R-04** | — | E-21 by Mint and by a visitor | `403`, `401` |
| **AC-R-05** | the summary page | open it, change the dates, submit; at 390 / 768 / 1440 px; axe scan | the default range is the last 30 days; the URL holds `from` and `to`; tables have captions; no page-level horizontal scroll; 0 serious axe issues |

**Planned tests:** TEST-R-01 … 05 (U, I, C, E2E).

---

## 4. Feature-S — Participant Event History

**Links:** FR-25; BR-20, BR-16 · Depends on: Feature-H, Feature-P · Issue S3-04

**Behaviour**
1. Participants get a third tab, **History**, next to Find an Event and My Events (`/me/history`).
2. `GET /api/me/history?page` (E-22) returns the caller's registrations that have a **final status** (§0.1), one
   per event (the latest registration, D-28), with the newest event first, 20 per page.
3. Each row is the Sprint 1 event card plus a status chip:
   - **Attended**: teal with a check icon;
   - **No-show**: amber;
   - **Cancelled**: muted;
   - **Event cancelled**: red, with the organizer's reason.
4. Registrations that are still upcoming or in progress stay in My Events. They move to History when the event
   ends or the registration is cancelled.

**Rules:** an active registration on an event that has not ended has no final status, so it is not in History.
`CHECKED_IN` on an in-progress event is not yet `ATTENDED`. The response never contains another participant's data.

**Permissions:** participant, own only. Organizer 403, visitor 401.

**UI:** the empty state reads "No past events yet" with **Find an Event**. Chips use text as well as colour.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-22 | `GET /api/me/history?page` | `200 { "items": HistoryItem[], "meta": { page, pageSize: 20, totalItems } }` | 400 · 401 · 403 |

**Data:** no new fields.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-S-01** | Mint: an ended event checked in; an ended event still `REGISTERED`; a cancelled registration on an upcoming event; an `EVENT_CANCELLED` registration | E-22; UI: open History | 4 items with `ATTENDED`, `NO_SHOW`, `CANCELLED`, `EVENT_CANCELLED` (with `cancelReason`), newest event first; the chips show those words |
| **AC-S-02** | Mint cancelled and then re-registered on event Y, which has ended and where she was checked in | E-22 | exactly one item for Y, `ATTENDED` |
| **AC-S-03** | Mint is registered on an upcoming event, and checked in on an event in progress; the clock then moves to that event's end | E-22 before and after | before: neither appears; after: the in-progress one appears as `ATTENDED` |
| **AC-S-04** | Ploy also has history | E-22 as Mint; as Quantum Cards; as a visitor; `page=0` | only Mint's items, and no body contains Ploy's name or id; `403`; `401`; `400` |
| **AC-S-05** | Nok has no history; Mint has 25 items | the History tab as Nok and as Mint | "No past events yet" with Find an Event; 20 items and a Next page with "21–25 of 25" |

**Planned tests:** TEST-S-01 … 05 (I, C, E2E).

---

## 5. Feature-T — Sign-in Throttling

**Links:** NFR-16; FR-02 · Depends on: Feature-A, SR-03 · Issue S3-05

**Behaviour**
1. E-01 normalises the email (trimmed, lower-case), then counts that email's **failed** `LoginAttempt` rows in the
   last 10 minutes.
2. If there are 5 or more, it answers `429 TOO_MANY_ATTEMPTS` straight away, without checking the password and
   without recording the attempt (D-29). A `Retry-After` header gives the seconds until the 5th-newest failure is
   10 minutes old.
3. Otherwise sign-in goes on as in Sprint 1, and the attempt is recorded with `succeeded` true or false. Unknown
   emails are recorded and throttled the same way (D-27). A success does not delete earlier failures.
4. The sign-in page shows the server message in the existing alert and keeps the email. There is no countdown
   timer: the message says 10 minutes.

**Rules, boundaries:**
- Failures 1–5 each get `401 INVALID_CREDENTIALS`. Attempt 6 within 10 minutes of the 1st gets `429`, even with
  the right password.
- With the 5th failure at time F, an attempt at F + 9 min 59 s gets `429`, and one at F + 10 min is checked
  normally.
- Different emails never affect each other.
- The 429 body has the same shape as every error, and reveals nothing about whether the account exists.

**Permissions:** public (E-01). `LoginAttempt` is never returned by any endpoint.

**UI:** no new screen. `/login` shows the 429 message in its existing `role="alert"` box, keeps the email, and
moves focus to the alert (Behaviour 4). There is no countdown.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-01 | *(changed)* `POST /api/auth/login` | as Sprint 1 | adds `429 TOO_MANY_ATTEMPTS` with `Retry-After` |

**Data:** `LoginAttempt` (SDS §4.1) with index `(email, attemptedAt)`, from migration `0005_sprint3_attendance`.
Rows older than 24 hours are deleted at sign-in. Only these rows may ever be deleted, because they are not product
records (X-11).

| AC | Given | When | Then |
|---|---|---|---|
| **AC-T-01** | Mint; clock fixed | 5 wrong passwords, then the right password | five `401 INVALID_CREDENTIALS`, then `429 TOO_MANY_ATTEMPTS` with "Too many sign-in attempts. Try again in 10 minutes." and `Retry-After`; no session or cookie is created; 5 failure rows exist |
| **AC-T-02** | Mint's 5th failure at F | the right password at F + 9 min 59 s; 20 more attempts during the lock; the right password at F + 10 min | `429`; all 20 `429` and no new rows (D-29); `200` with a session |
| **AC-T-03** | `ghost@player.example` (unknown) and Mint | 5 failures for ghost, then a 6th; failures for Mint sent as `MINT@player.example` and ` mint@player.example ` | ghost gets `429` in the same shape and timing class as Mint would; the case and space variants share Mint's counter |
| **AC-T-04** | Mint is locked | Ploy signs in correctly; Mint signs in correctly at F + 10 min, then fails once | Ploy `200`; Mint `200`, then her next failure is `401`, not `429` (earlier failures are now older than 10 min) |
| **AC-T-05** | 5 failures recorded | a new Prisma client and a restarted app; E-01 again; every Sprint 1–3 response body is scanned | still `429` (the lock is stored in PostgreSQL); no response contains `LoginAttempt`, `attemptedAt` or the attempted passwords; the UI shows the message in the alert with the email kept |

**Planned tests:** TEST-T-01 … 05 (U, I, C).

---

## 6. Feature-V — Store Logo and Event Banner (CH-11)

**Links:** FR-30 (logo), FR-31; NFR-17, NFR-13; BR-14, BR-17 · Depends on: Feature-U, SR-04 · Issue S3-06 ·
Prototype: the "TCG Event Hub — Store Branding" canvas, revised after the Impeccable critique of 21 Nov 2026 ·
Moved here from Sprint 2 contracts §11.2 (D-24)

**Behaviour**
1. **Logo:** on `/organizer/store`, **Upload logo** or **Replace logo** sends the file to
   `PUT /api/organizer/store/logo` (E-24). **Remove** asks first ("Remove your logo? Your 6 upcoming events will
   show QC instead.") and then calls `DELETE` on the same path.
2. **Banner:** in the create and edit forms ("Game and banner"), the drop zone sends the file to
   `PUT /api/organizer/events/:id/banner` (E-25), with `DELETE` to remove it. A new event saves first (draft or
   published), then uploads.
3. **Browser side:** an image larger than the limit is scaled down in the browser to at most 1600 × 1600 (logo) or
   2400 × 800 (banner) as WebP before upload ("Resized from 7.2 MB to 0.6 MB"). The server limits stay the safety
   net.
4. **Server side**, with a raw body and no multipart:
   - reads at most the limit (`express.raw({ limit })`), otherwise `413`;
   - checks the magic bytes, otherwise `415`;
   - decodes the image with `sharp` (`limitInputPixels` 25 MP), otherwise `400 IMAGE_UNREADABLE`;
   - checks the minimum size (logo 256 × 256, banner 1200 × 400), otherwise `422 IMAGE_TOO_SMALL`;
   - re-encodes it to WebP: the logo as a 512 × 512 centre crop, the banner as a 1600 × 533 centre crop;
   - stores it through `MediaStore` (SD-12) under `logos/<uuid>.webp` or `banners/<uuid>.webp`;
   - saves the key, then deletes the previous object.
5. **Responses:** `EventSummary.store.logoUrl` and `EventDetail.bannerUrl` are built from `MEDIA_BASE_URL`, or are
   `null`. The pages follow design-direction §5.4:
   - the banner is decorative, 240 px high on desktop;
   - the logo is 80 px, overlapping the banner, and 32 px in lists;
   - without them, the page shows initials and the playmat pattern.

**Rules and permissions:**
- A logo belongs to the caller's own profile.
- A banner can be changed only by the event's owner (other organizer 404, participant 403, visitor 401), and not on
  a `CANCELLED` event (`409 ALREADY_CANCELLED`).
- A banner may change after the start: it is not a frozen field (BR-15).
- Removing an image clears a display field; it is not a record deletion (X-11).
- The Origin check applies to PUT and DELETE.

**UI:** `/organizer/store` (logo) and the "Game and banner" box of the create and edit forms (banner), as in
Behaviour 1–3 and 5 and the Store Branding prototype: preview with the cropped strips shaded, "Resized from …"
note, the confirmation before Remove, errors in an alert that names the fix, and 44 px targets.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-24 | `PUT /api/organizer/store/logo` (raw image) · `DELETE` | `200 { "logoUrl" }` · `204` | 401 · 403 · 413 · 415 · 400 `IMAGE_UNREADABLE` · 422 `IMAGE_TOO_SMALL` |
| E-25 | `PUT /api/organizer/events/:id/banner` (raw image) · `DELETE` | `200 { "bannerUrl" }` · `204` | 400 · 401 · 403 · 404 · 409 `ALREADY_CANCELLED` · 413 · 415 · 422 |

**Data:**
- `User.logoKey` and `Event.bannerKey`, both `varchar(80) null` (SDS §4.1), in migration `0006_media`.
- Environment variables: `MEDIA_DRIVER`, `MEDIA_BUCKET`, `MEDIA_BASE_URL` (SDS §9.4 until S3-06 adds them to the code, then §9.1).
- A GCS bucket with public-read objects. The service account gets `roles/storage.objectAdmin` on that bucket only.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-V-01** | Quantum Cards; a 600 × 600 PNG with EXIF GPS | E-24; then E-05 of a Quantum Cards event and E-04; a second upload | `200 { logoUrl }`; the stored object is WebP 512 × 512 with no EXIF; E-05 and E-04 carry the same `logoUrl`; after the second upload the first object is gone |
| **AC-V-02** | Quantum Cards owns event X | E-25 with a 2400 × 800 JPEG; then E-05 X as a visitor | `200 { bannerUrl }`; stored as WebP 1600 × 533; E-05 has `bannerUrl` |
| **AC-V-03** | — | E-25 with 5 MB + 1 byte; a PNG sent as `image/jpeg`; an SVG; a text file sent as `image/png`; 1199 × 400; a 30,000 × 30,000 PNG | `413`; accepted (the bytes decide); `415`; `415`; `422 IMAGE_TOO_SMALL`; `400 IMAGE_UNREADABLE`; nothing is stored after any failure |
| **AC-V-04** | event X (Quantum Cards); cancelled event C | E-25 on X by Dragon's Den, Mint, a visitor and with a foreign Origin; E-25 on C by the owner; E-24 by Mint | `404`, `403`, `401`, `403`; `409 ALREADY_CANCELLED`; `403`; no object is written |
| **AC-V-05** | a logo and a banner exist | `DELETE` on E-24 and E-25; then E-05 | `204` ×2; `logoUrl` and `bannerUrl` are `null`; the objects are gone; the page shows initials and the playmat |
| **AC-V-06** | the deployed candidate on Cloud Run | upload a banner, fetch its URL, deploy a new revision, fetch again | `200`, `content-type: image/webp`, `x-content-type-options: nosniff`; the object is in the bucket; still there after the new revision |
| **AC-V-07** | the store profile and banner box in the browser | a 7 MB photo; a GIF; Remove logo then Keep it, then Remove logo; at 390 / 768 / 1440 px | "Resized from …" and success; the alert names the GIF and the fix with focus on the file input; the confirmation appears and Keep it changes nothing; the preview shades the cropped strips; no horizontal scroll |

**Planned tests:** TEST-V-01 … 07 (U, I, C, E2E, M for V-06).

---

## 7. Feature-W — Swiss Pairings and Rounds (CH-12)

**Links:** FR-32, FR-33, FR-37; BR-21, BR-22, BR-14; NFR-18, NFR-05 · Depends on: Feature-P, SR-08 · Issue S3-10 ·
Decisions D-31, D-35, D-36 · Design SDS SD-14

**Behaviour**
1. On a `TOURNAMENT` event, the owner's dashboard row and Door check-in page get **Tournament**, which opens
   `/organizer/events/:id/tournament`. Before the start, the page shows the checked-in players, the number of
   rounds (default ⌈log₂ n⌉, editable from 1 to the BR-21 maximum) and **START TOURNAMENT**.
2. `POST /api/organizer/events/:id/tournament/start` (E-26), body `{ "rounds"?: int }`, locks the event row and
   checks BR-21. In one transaction it then:
   - creates one `TournamentEntry` per `CHECKED_IN` registration;
   - sets `tournamentStatus RUNNING` and `tournamentRounds`;
   - pairs round 1 with `pairRound` from a new random seed, stored on the round (D-35);
   - stores a bye as a 2–0 win;
   - writes an `EventChange` (`field status`, `NOT_STARTED → RUNNING`).
3. The page then shows **Round 1** as a table list: table number, player A, player B (or **Bye**), and a result
   control (Feature-X). A "Print pairings" view shows the same list in large type for the store wall.
4. When every match of the current round has a result, **PAIR ROUND 2** is enabled. It calls
   `POST /api/organizer/events/:id/tournament/rounds` (E-27), which locks the row, checks
   `ROUND_NOT_COMPLETE` and `NO_ROUNDS_LEFT`, and pairs the next round by the Swiss rules (BR-22) from the current
   standings (Feature-X).
5. **Drop** on a player row calls `POST /api/organizer/tournament-entries/:id/drop` (E-29). The entry is not
   paired again. Its results and place in the standings stay (FR-37). A drop is allowed only between rounds: the
   entry's match in the current round must have a result.
6. `pairRound(entries, history, seed)` is a pure function in `server/src/domain/tournament/pairing.ts` (SD-14):
   - **Round 1:** a seeded shuffle.
   - **Later rounds:** order by standings, then pair from the top, each entry with the highest-placed entry it has
     not met. When a score group can't be paired, its lowest entry floats down to the next group. A backtracking
     search guarantees no rematch.
   - **Bye:** with an odd count, the bye goes to the lowest entry without one.

**Rules, validation, boundaries:** BR-21 (who can be paired, rounds 1 … the maximum) and BR-22 (Swiss pairing, no
rematch, one bye) as in Behaviour 2, 4 and 6. The order of checks (E-26, E-27, E-29) is 401 → 403 → 403 (Origin) → 400 (path, body) → 404 (missing or not owner)
→ lock → 409 `ALREADY_CANCELLED` → 409 `NOT_A_TOURNAMENT` → E-26: 409 `TOURNAMENT_STARTED`, 409
`EVENT_NOT_IN_PROGRESS`, 409 `NOT_ENOUGH_PLAYERS`, 422 `rounds` out of range · E-27: 409 `TOURNAMENT_NOT_RUNNING`,
409 `ROUND_NOT_COMPLETE`, 409 `NO_ROUNDS_LEFT`, 409 `NOT_ENOUGH_PLAYERS` (fewer than 2 active entries) · E-29: 409
`TOURNAMENT_NOT_RUNNING`, 409 `ALREADY_DROPPED`, 409 `ROUND_NOT_COMPLETE` (the entry's current match has no result)
→ 200/201.

**Permissions:** owner only; other organizer 404, participant 403, visitor 401.

**UI:** pairings are a real table (`<caption>Round 2 pairings</caption>`); the table number is the first column,
with large tabular digits. Buttons are 44 px. START and PAIR show a busy state; extra presses are ignored (the lock
makes them safe anyway). After pairing, the live region announces "Round 2 paired: 8 tables, 1 bye".

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-26 | `POST …/events/:id/tournament/start` `{ rounds? }` | `201 TournamentView` | 400 · 401 · 403 · 404 · 409 (five codes) · 415 · 422 |
| E-27 | `POST …/events/:id/tournament/rounds` `{}` | `201 TournamentView` | 400 · 401 · 403 · 404 · 409 (five codes) |
| E-29 | `POST /api/organizer/tournament-entries/:id/drop` `{}` | `200 TournamentView` | 400 · 401 · 403 · 404 · 409 (three codes) |
| E-31 | `GET …/events/:id/tournament` | `200 TournamentView` (status, rounds, current round, matches, standings) | 400 · 401 · 403 · 404 · 409 `NOT_A_TOURNAMENT` |

**Data:** the Event tournament fields, `TournamentEntry`, `TournamentRound` and `Match` (SDS §4.1, §4.3), in
migration `0007_tournaments`.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-W-01** | Dragon's Den owns a `TOURNAMENT` event in progress with 5 `CHECKED_IN` and 2 `REGISTERED` players; clock fixed | E-26 `{}` | `201`; 5 entries, exactly the checked-in ones; `tournamentRounds 3` (⌈log₂ 5⌉); round 1 has 3 matches, one of them a bye stored 2–0–0; every entry appears once; the stored seed reproduces the same pairings when `pairRound` is called again; one `EventChange` NOT_STARTED → RUNNING |
| **AC-W-02** | events: `CASUAL`; cancelled; tournament before `startAt`; tournament with 1 checked-in player; tournament already `RUNNING`; a 4-player tournament | E-26 on each; on the 4-player one `rounds` 0, 3, 2 | `409 NOT_A_TOURNAMENT`, `409 ALREADY_CANCELLED`, `409 EVENT_NOT_IN_PROGRESS`, `409 NOT_ENOUGH_PLAYERS`, `409 TOURNAMENT_STARTED`; `422` for 0 and 3 (max is 4 ÷ 2 = 2), `201` for 2; nothing is created on any rejection |
| **AC-W-03** | `pairRound` with fixed seeds | (U) 1,000 generated tournaments, 2–64 entries, random results, every allowed round count, random drops | no rematch in any tournament; no entry has two byes; every active entry is paired exactly once per round; in every round each match joins entries whose point totals differ by at most the float-down needed (checked against the score groups) |
| **AC-W-04** | a running 6-player tournament, round 1 with one result missing; then complete | E-27; enter the last result; E-27; E-29 on an entry; E-27 after the final round | `409 ROUND_NOT_COMPLETE`; then `201` with round 2 paired by points and no rematch; the drop gives `200` and the entry is absent from round 3's pairings but present in the standings; `409 NO_ROUNDS_LEFT` |
| **AC-W-05** | Dragon's Den's tournament | E-26, E-27, E-29, E-31 by Quantum Cards, by Mint, by a visitor, with a foreign Origin (POST) | `404` (byte-identical to a missing id), `403`, `401`, `403`; nothing changes |
| **AC-W-06** | round 1 complete; 20 rounds | two E-27 calls at the same time | one `201`, one `409 ROUND_NOT_COMPLETE` or `NO_ROUNDS_LEFT`; exactly one round 2 exists; entries paired once |
| **AC-W-07** | 256 entries with 8 rounds of generated history (NFR-18) | (U) `pairRound` for round 9 with the rounds cap lifted for the benchmark only, timed 20 times | median and maximum < 1 s; result valid (no rematch, one bye at most) |

**Planned tests:** TEST-W-01 … 07 (U, I, C, E2E).

---

## 8. Feature-X — Match Results, Standings and Winner (CH-12)

**Links:** FR-34, FR-35, FR-36; BR-23, BR-24, BR-16 (D-32 exception), BR-20 · Depends on: Feature-W, Feature-S ·
Issue S3-11 · Decisions D-32, D-33, D-34

**Behaviour**
1. **Entering a result.** On the tournament page, each match row has a result control: three steppers (games won
   by A, by B, and drawn, 0–3) and the quick buttons **2–0**, **2–1**, **1–2**, **0–2**, **1–1**.
   `PUT /api/organizer/matches/:id/result` (E-28), body `{ "aWins", "bWins", "draws" }`:
   - locks the event row;
   - checks BR-23;
   - saves the result with `reportedAt` and `reportedById`;
   - answers with the updated `TournamentView`.

   A result in the **current** round can be changed as often as needed. Once the next round is paired, that
   round's results answer `409 ROUND_LOCKED`.
2. **Standings** are computed when read (SD-13) with BR-24:
   - match points, OMW%, GW% and OGW% (each with a 1/3 floor, byes left out of opponents' figures), then the
     earliest registration;
   - the owner sees the whole table: rank, player, points, W–L–D, OMW%, GW%, OGW%, and Dropped.
3. **Finishing.** After the final round is complete, **FINISH TOURNAMENT** calls
   `POST /api/organizer/events/:id/tournament/finish` (E-30). It sets `FINISHED` and `tournamentFinishedAt`, and
   writes an `EventChange` RUNNING → FINISHED. The page then shows "Winner: {name}" and the final standings. Nothing
   can change after this.
4. **The player's view** (D-32), `/me/registrations/:id/tournament` (E-32), linked from My Events and the event
   detail while the player has an entry:
   - **Running:** "Round 2 · Table 4 · You play **Ploy**", the player's own record "1–0–0 · 3 points", and their
     current rank as "3rd of 8".
   - **Finished:** "Final placing: 2nd of 8".

   The player never sees other matches, other players' records or the full standings. The History row of a
   finished tournament (Feature-S) shows "2nd of 8".

**Rules, validation, boundaries** (E-28)

| Check | Result |
|---|---|
| `aWins`, `bWins`, `draws` missing, not whole numbers, or outside 0–3 | `400` on the field |
| total outside 1–5 | `400` on `draws`: "Enter between 1 and 5 games." |
| the match is a bye | `409 ROUND_LOCKED` (a bye's result is fixed) |
| match in an earlier round than the current one, or tournament `FINISHED` | `409 ROUND_LOCKED` / `409 TOURNAMENT_NOT_RUNNING` |
| E-30 with a missing result in the final round, or before the final round | `409 ROUND_NOT_COMPLETE` |

- Points: win 3, draw 1, loss 0. A bye counts as a 2–0 win, and is left out of the opponents' figures of the player
  who had it.
- Percentages are shown to one decimal place, and compared unrounded.

**Permissions:**
- E-28 and E-30: owner of the event; other organizer 404, participant 403, visitor 401.
- E-32: the participant who owns the registration; another participant 404, organizer 403, visitor 401. A
  registration without an entry: `404 NOT_FOUND`.

**UI:** the result control, standings table and winner line on `/organizer/events/:id/tournament`, and the
player's view at `/me/registrations/:id/tournament`, as in Behaviour 1, 3 and 4. The standings are a real table
with a caption; percentages use tabular figures; results are announced in the live region.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-28 | `PUT /api/organizer/matches/:id/result` `{ aWins, bWins, draws }` | `200 TournamentView` | 400 · 401 · 403 · 404 · 409 `ROUND_LOCKED` / `TOURNAMENT_NOT_RUNNING` · 415 |
| E-30 | `POST …/events/:id/tournament/finish` `{}` | `200 TournamentView` (`status FINISHED`, `winner`) | 400 · 401 · 403 · 404 · 409 `TOURNAMENT_NOT_RUNNING` / `ROUND_NOT_COMPLETE` |
| E-32 | `GET /api/me/registrations/:id/tournament` | `200 { status, round, table, opponent: { displayName } \| null, record, points, rank, of, finalPlacing }` | 400 · 401 · 403 · 404 |
| E-22 | *(changed)* history items gain `placing: { rank, of } \| null` for finished tournaments | — | — |

**Data:** no new tables beyond Feature-W. The result constraints are `match_result_range` and `match_bye_result`.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-X-01** | round 1 of a running tournament | E-28 with 2–1–0, 0–2–0, 1–1–1; then `{3,3,0}`, `{0,0,0}`, `{2,-1,0}`, `{1.5,0,0}`, and on the bye | `200` each, and points 3/0, 0/3, 1/1 in the standings; the four bad bodies `400` naming the field; the bye `409 ROUND_LOCKED`; the stored row has `reportedById` = the owner |
| **AC-X-02** | round 1 complete, then round 2 paired | E-28 changing a round-1 result; E-28 changing a round-2 result twice | `409 ROUND_LOCKED`, round 1 unchanged; `200` twice, and the last value wins |
| **AC-X-03** | a hand-computed fixture: 6 players, 3 rounds, one bye, one draw, one drop | E-31 standings | rank, points, OMW%, GW% and OGW% equal the worked values in STS §1.3 to 4 decimal places, including a tie broken by OMW% and a player whose opponents are under the 1/3 floor |
| **AC-X-04** | final round complete | E-30; then E-28, E-27, E-29, E-26; E-31; Ploy's History (E-22) | `200 FINISHED` with `winner` = rank 1; the four writes `409 TOURNAMENT_NOT_RUNNING` / `TOURNAMENT_STARTED`; standings unchanged; History shows Ploy's `placing` |
| **AC-X-05** | Mint plays Ploy at table 2 in round 2 | E-32 for Mint's registration as Mint; as Ploy (her registration id); as Quantum Cards; as a visitor; stringify Mint's body | Mint sees table 2, opponent "Ploy", her own record, points and rank; Ploy gets `404`; organizer `403`; visitor `401`; Mint's body has no other player's name, no `standings` and no email |
| **AC-X-06** | the finished tournament | E-30 by another organizer, a participant, a visitor; E-30 before the final round | `404`, `403`, `401`; `409 ROUND_NOT_COMPLETE` |
| **AC-X-07** | the tournament page and the player view in the browser | enter results with the quick buttons; finish; axe scan; 390 / 768 / 1440 px; print view | results save with the busy state and live-region text; "Winner: …" shows; 0 serious axe issues; tables keep their captions; no page-level horizontal scroll; the print view shows table, player A, player B |

**Planned tests:** TEST-X-01 … 07 (U, I, C, E2E).

---

## 9. SR-05 — Responsive Layout and Accessibility (full)

**Links:** NFR-08 (all screens), NFR-10 · Depends on: Feature-C · Issue S3-07

**Behaviour:**
1. An `@axe-core/playwright` scan runs on the 14 main screens, as signed-out, participant and organizer:
   - Find an Event;
   - event detail: open, registered and cancelled;
   - sign in;
   - My Events and History;
   - dashboard;
   - create and edit event;
   - Door check-in;
   - attendance report;
   - summary;
   - store profile.

   The same screens are checked at 390, 768 and 1440 px.
2. A keyboard-only walk-through of four journeys is recorded (M): register, cancel that registration in My Events,
   check in, and cancel an event. After a confirmed Cancel registration, focus moves to the "Your registration is cancelled." notice (`tabindex="-1"`), so the result is read out and focus is not lost when
   the dialog closes. This closes the known limitation of the Sprint 2 release (Sprint 2 `sts.md` §6; team decision
   27 Nov).
3. Fixes follow design-direction v0.6: Deep Lagoon tokens, focus ring, `--control-line` and 44 px targets.

**Layers:** UI: fixes only, no new screen. Rules, Permissions, API and Data: no change in this layer.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-SR5-02** | the release candidate with seed data | axe scan of the 14 screens (WCAG 2.1 A and AA rules) | **0 serious and 0 critical** violations; moderate ones listed in STS §6 with a decision |
| **AC-SR5-03** | the same 14 screens | open at 390, 768, 1440 px | `scrollWidth ≤ innerWidth` on all 42; screenshots saved |
| **AC-SR5-04** | keyboard only, no mouse | register for an event; cancel that registration in My Events; check a player in and undo; cancel an event | each journey finishes; focus is always visible and never lost; dialogs return focus; after the confirmed Cancel registration, focus is on the "Your registration is cancelled." notice; recorded with screenshots |

**Planned tests:** TEST-SR5-02 … 04 (E2E, M).

---

## 10. SR-06 — Performance

**Links:** NFR-12 · Depends on: Feature-J, Feature-R · Issue S3-08

**Behaviour:**
1. `npm --prefix server run seed:perf` fills a separate database with 500 events, 5,000 registrations and 20
   organizers. It is deterministic, refuses to run on `DATABASE_URL`, and needs `DATABASE_URL_PERF`.
2. `scripts/perf.mjs` runs autocannon against a production build: 30 s and 10 connections per endpoint. It writes
   p50, p95 and p99 to `docs/sprints/sprint-3/evidence/perf-<commit>.txt`.

**Layers:** Data: a new index only if AC-SR6-02 finds a plan without one (a migration and an SDS §4.1 row).
Rules, Permissions, UI and API: no change in this layer.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-SR6-01** | the perf database and a production build on the developer laptop | autocannon on E-04 (no query; `q=store&game=MAGIC&seatsAvailable=true&page=3`) and E-20 | p95 < 500 ms for each; the results file names the commit and the machine |
| **AC-SR6-02** | the same database | autocannon on E-21 for a 366-day range as the busiest organizer; `EXPLAIN ANALYZE` of the E-04 and E-21 queries | p95 < 500 ms; the plans use the `(status, startAt)` index or a recorded new index |

**Planned tests:** TEST-SR6-01, 02 (M with recorded evidence).

---

## 11. SR-07 — Verification and Traceability at the final release

**Links:** NFR-14 (SR-07) · Depends on: every Sprint 1–3 feature · Issue S3-09

**Behaviour:** `scripts/sts-coverage.mjs` takes the sprint folder as an argument (S2-08) and is run for all three
sprints on the `v1.0.0` candidate. The traceability matrix gets each requirement's final result and version.

**Layers:** documents and a script only. Rules, Permissions, UI, API and Data: no change in this layer.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-SR7-02** | the `v1.0.0` candidate | `npm run sts:check -- sprint-1`, `-- sprint-2`, `-- sprint-3`; the traceability matrix | every AC of every sprint has a recorded result; every BR has a rejection test; every FR, BR and NFR row in `traceability.md` names its actual test and result |

**Planned tests:** TEST-SR7-02 (M, script).

---

## 12. Changes to earlier features (re-verification)

| Earlier item | Sprint 3 change | How it is re-tested |
|---|---|---|
| Feature-B, TEST-B-03 | Matrix rows for E-18 … E-22, E-24 … E-32 | Rows added |
| Feature-I, E-08 | Page becomes Door check-in; response gains `checkIn`, `counts`, check-in fields | TEST-I-01 … 03 still green; TEST-P-01 |
| Feature-H, My Events | Ended and cancelled registrations also appear in History (they are not removed from My Events) | TEST-H-01, 02 still green; TEST-S-03 |
| Feature-A, E-01 | Throttling | TEST-A-01 … 06 still green (none fails 5 times in 10 min); TEST-T-* |
| Feature-N, E-16 | Races with E-18 | TEST-P-06 |
| SR-01, AC-SR1-02 | Seed has 11 events (EV-10, EV-11) | TEST-SR1-02 revised in S3-01 (EV-10) and S3-10 (EV-11) |
| Feature-S, E-22 | History items gain the tournament `placing` | TEST-X-04 |
| Feature-P | Check-ins become tournament entries; check-in stays possible after the start, but a late player is not entered (D-31) | TEST-W-01 |
| SR-02, TEST-SR2-03 / 04 | Route table and new codes | Rows added |
| SR-08 | Check-in and undo are recorded | TEST-P-01, P-03 |

## 13. Journeys (E2E, on the release candidate)

| ID | Journey | Covers |
|---|---|---|
| JRN-05 | Quantum Cards opens Door check-in for EV-4, finds Mint, checks her in, undoes it, checks her in again; the clock moves past the end; the attendance report shows her as checked in; Mint's History shows **Attended** | P, Q, S, SR-08 |
| JRN-06 | A visitor fails sign-in 5 times, sees the 10-minute message, and signs in after the window (fixed clock in the test build) | T |
| JRN-07 | Quantum Cards uploads a logo and a banner; a visitor sees both on the event and the logo in search | V, U |
| JRN-08 | Dragon's Den starts EV-11 (4 players, 2 rounds), enters round 1 results, pairs round 2 (no rematch), enters results, finishes; Mint sees her table and opponent during round 2 and her final placing in History | W, X, S |
| JRN-01 … 04 | The Sprint 1 and 2 journeys, unchanged | Regression |

## 14. AC summary

| Item | ACs | Count |
|---|---|---|
| Feature-P | AC-P-01 … 06 | 6 |
| Feature-Q | AC-Q-01 … 05 | 5 |
| Feature-R | AC-R-01 … 05 | 5 |
| Feature-S | AC-S-01 … 05 | 5 |
| Feature-T | AC-T-01 … 05 | 5 |
| Feature-V | AC-V-01 … 07 | 7 |
| SR-05 | AC-SR5-02 … 04 | 3 |
| SR-06 | AC-SR6-01, 02 | 2 |
| SR-07 | AC-SR7-02 | 1 |
| Feature-W *(CH-12)* | AC-W-01 … 07 | 7 |
| Feature-X *(CH-12)* | AC-X-01 … 07 | 7 |
| **Total** | | **53** |

Requirements established in Sprint 3 ([`../plan.md`](../plan.md) §5): FR-21, FR-22, FR-23, FR-24, FR-25, FR-31,
FR-32 … FR-37 · BR-18 … BR-24 · NFR-10, NFR-12, NFR-16, NFR-17, NFR-18 (24). FR-30 (logo part) and NFR-08 (all screens) are completed
here. Each one is linked to at least one AC above.

## 15. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 21 Nov 2026 | First draft: time words, shapes, seed EV-10 (AC-SR1-02 revised to 10 events), new codes, D-28 … D-30 proposed; Feature-P, Q, R, S, T, V (moved from Sprint 2 §11.2 with AC-V-07 added), SR-05, SR-06, SR-07; 39 ACs; re-verification table; JRN-05 … 07 | Team (AI-assisted) |
| v0.2 | 21 Nov 2026 | CH-12: §7 Feature-W (Swiss pairings and rounds) and §8 Feature-X (results, standings, winner, player view), 14 ACs; seed EV-11 (AC-SR1-02: 11 events); tournament error codes; D-31 … D-36; re-verification rows; JRN-08; later sections renumbered §9 … §15; 53 ACs | Team (AI-assisted) |
| #118 | 25 Nov 2026 | Deliverable 2 check (Part C): every contract names each template layer, or says "no change in this layer" (P and W rules labelled; UI lines for T, V and X; layer lines for SR-05 and SR-06; SR-07 gains Links and Behaviour); CH-13 noted in the shared rules; §0.3 says two seed events; inputs SRS v0.8, traceability v0.9, SDS v0.15, Sprint 2 contracts v0.6. No AC changes | Team (AI-assisted) |
| #118 | 27 Nov 2026 | Deliverable 2 check, 27 Nov: inputs are the current SRS v0.9, traceability v0.12 and the released Sprint 2 contracts v0.10, re-read for Sprint 3 (CH-13, D-40 and D-41 change no Sprint 3 rule); §0.5 says D-28 … D-36 are recorded in the SRS, not only proposed. No AC changes | Team (AI-assisted) |
| #118 | 27 Nov 2026 | §9 Behaviour 2 and AC-SR5-04 (team decision 27 Nov): a fourth keyboard journey, cancel a registration in My Events, and focus then moves to the "Your registration is cancelled." notice. This specifies the focus gap left by the Sprint 2 release | Team (AI-assisted) |
| S3-05 | 28 Nov 2026 | §5 Feature-T: the `LoginAttempt` migration is `20261128010000_s3-05_login_attempt` (timestamped folder, AGENTS.md §4), not `0005_sprint3_attendance`, which S3-01 replaced with its own timestamped folder. No AC changes | Team (AI-assisted) |
