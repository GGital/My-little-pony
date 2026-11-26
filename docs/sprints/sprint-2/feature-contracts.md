# Sprint 2 Feature Engineering Contracts

Project: **TCG Event Hub** · Sprint 2 (9–29 Nov 2026) · Document version: v0.8 — **draft for team review** (changes in §13; v0.6 = Lab 7 CH-13, Issue #77; v0.7 = S2-02; v0.8 = S2-04)
Inputs: [`../../srs.md`](../../srs.md) v0.6 · [`../../features.md`](../../features.md) v0.4 ·
[`../../traceability.md`](../../traceability.md) · [`../../system-sds.md`](../../system-sds.md) ·
[`../plan.md`](../plan.md) §3 · [`../../ui/design-direction.md`](../../ui/design-direction.md) ·
Sprint 1 contracts: [`../sprint-1/feature-contracts.md`](../sprint-1/feature-contracts.md) v1.13 ·
Tests: [`sts.md`](sts.md) · Issues and Definition of Done: [`README.md`](README.md)

This document has one engineering contract for each Sprint 2 feature and for SR-08. Each contract is written and
reviewed **before** any implementation. The Sprint 2 goal ([`../plan.md`](../plan.md) §3) is that an organizer
controls the whole life of their event, a player can change their mind, and every change records who made it and
when.

Everything in the Sprint 1 contracts still applies: the check order (SDS §2.3), the error shape (SDS §6.1), the
permission matrix (SDS §7), strict zod bodies, the Origin check, the server clock and the seed accounts. These
contracts repeat Sprint 1 only where Sprint 2 changes it. AC IDs follow the same pattern: `AC-<feature>-nn` here,
with a matching `TEST-<feature>-nn` in the STS.

---

## 0. Shared definitions for all Sprint 2 contracts

### 0.1 What changes in the Sprint 1 resource shapes

Fields that are added are marked `+`. Fields that are not listed here keep their Sprint 1 meaning.

```jsonc
// EventSummary (Sprint 1 §0.1)
{
  "...Sprint 1 fields": "…",
  "status": "DRAFT | PUBLISHED | CANCELLED",         // DRAFT is now possible (Feature-K)
  "+registrationDeadline": "2026-11-05T09:00:00.000Z" // the EFFECTIVE deadline: the stored one, or startAt when none is set (BR-08)
}

// EventDetail (Sprint 1 §0.1)
{
  "...EventSummary fields": "…",
  "+cancelReason": null,             // text when status = CANCELLED, shown publicly (SDS §7.2)
  "+cancelledAt": null,              // ISO time when status = CANCELLED
  "viewer": {
    "action": "…",                   // same values as Sprint 1; the CLOSED rule changes (§0.2)
    "registrationId": 31,
    "+canCancel": true               // the server decides whether the viewer may cancel now (Feature-N)
  }
}

// ParticipantRegistration (Sprint 1 §0.1)
{
  "...Sprint 1 fields": "…",
  "status": "REGISTERED | CHECKED_IN | CANCELLED | EVENT_CANCELLED",
  "+cancelledAt": null,              // set together with CANCELLED or EVENT_CANCELLED
  "+canCancel": true                 // status REGISTERED, event PUBLISHED, and now < registrationDeadline
}

// OrganizerRegistrationRow (Sprint 1 §0.1)
{ "...Sprint 1 fields": "…", "+cancelledAt": null }

// EventChange (new, SR-08): one row of the owner's change history
{
  "id": 4, "field": "capacity", "oldValue": "24", "newValue": "30",
  "changedAt": "2026-11-23T08:00:00.000Z", "changedBy": { "displayName": "Quantum Cards" }
}
```

The client never compares times to make a rule decision (SDS §5.2). It shows `registrationDeadline` and acts on
`viewer.action` and `canCancel`, which the server computes.

### 0.2 The viewer action from Sprint 2 onwards

The order is the same as in Sprint 1. Only the `CLOSED` row changes, and a `DRAFT` is never visible to anyone
except its owner (BR-04).

| Condition, checked top to bottom | `action` |
|---|---|
| Event is a `DRAFT` and the viewer is not its owner | — (E-05 answers `404 EVENT_NOT_FOUND`) |
| Viewer is the event's owner | `MANAGE` (the button now opens `/organizer/events/:id/edit`) |
| Viewer is any other organizer | `ORGANIZER_CANNOT_REGISTER` |
| Viewer is a participant with an active registration | `REGISTERED` (+ `registrationId`, `canCancel`) |
| Event is not `PUBLISHED`, **or** has started, **or** `now ≥ registrationDeadline` | `CLOSED` |
| `seatsRemaining = 0` | `FULL` |
| Viewer is signed out | `SIGN_IN_TO_REGISTER` |
| Otherwise | `REGISTER` |

### 0.3 Registration openness (BR-04 + BR-08), used by E-05, E-09 and E-16

```
effectiveDeadline = event.registrationDeadline ?? event.startAt
open              = event.status = PUBLISHED  AND  now < effectiveDeadline
```

`effectiveDeadline ≤ startAt` always holds (CHECK constraint, §1), so "not started" is already part of `open`. At
exactly the deadline, registration is **closed**, just as an event is "started" at exactly `startAt` (Sprint 1
§3, D-17).

### 0.4 Seed additions (SR-01, re-verified)

The Sprint 1 seed (EV-1 … EV-6) is unchanged. Sprint 2 adds three events so that the E2E journeys and the
demonstrations have a draft, a cancelled event and a deadline that has passed. "S" is the seed run time.

| Key | Event | Details |
|---|---|---|
| EV-7 | Prerelease Planning Night, Quantum Cards | **DRAFT**, S + 10 days, capacity 16, no registrations |
| EV-8 | Rainy Day Casual, Dragon's Den | **CANCELLED** at S, reason "Store closed for flooding repairs.", S + 6 days, capacity 12; Boss → `EVENT_CANCELLED` |
| EV-9 | Early Deadline Sealed, Quantum Cards | S + 2 days, `registrationDeadline` = S − 1 h (**passed**), capacity 8; Mint `REGISTERED` (cannot cancel) |

**Games (Feature-U):**
- **Store games:** Quantum Cards runs Pokémon TCG, Magic, One Piece, Yu-Gi-Oh! and Digimon; Dragon's Den runs Magic,
  Yu-Gi-Oh! and Lorcana.
- **Store contact (Feature-U, D-37):** Quantum Cards: phone `02 555 0101`, email `hello@quantumcards.example`,
  website `https://quantumcards.example`, LINE `@quantumcards`. Dragon's Den: phone `02 555 0202`, email
  `play@dragonsden.example`, no website, no LINE. All values are synthetic.
- **Event games:** EV-1, EV-2 and EV-5 are `MAGIC`; EV-3 and EV-8 are `YUGIOH`; EV-4 is `LORCANA`; EV-6 and EV-9 are
  `POKEMON`; EV-7 is `ONE_PIECE`.

After the seed there are 6 users and **9** events. AC-SR1-02 is revised to say 9 events (§12, v0.1). On the live
database, events that already exist keep the times of their first seed. EV-7 … EV-9 get times relative to the
first seed run that includes them.

### 0.5 New and reused error codes

| Status · code | Used by | Message shown |
|---|---|---|
| 409 `CAPACITY_BELOW_REGISTERED` *(SDS §6.2)* | E-13 | "{n} players are registered, so capacity can't go below {n}." |
| 409 `EVENT_STARTED` *(SDS §6.2)* | E-13, E-15 | "This event has started, so this can no longer be changed." |
| 409 `ALREADY_CANCELLED` *(SDS §6.2)* | E-13, E-14, E-15, E-16 | "This event has been cancelled." / "This registration is already cancelled." |
| 409 `ALREADY_CHECKED_IN` *(SDS §6.2)* | E-16 | "You've already been checked in, so this registration can't be cancelled." |
| 409 `ALREADY_PUBLISHED` **new** | E-14 | "This event is already published." |
| 409 `NOT_PUBLISHED` **new** | E-15 | "Only a published event can be cancelled." |
| 409 `REGISTRATION_CLOSED` *(Sprint 1, wider meaning)* | E-09, E-16 | E-09: "Registration for this event has closed." · E-16: "The registration deadline has passed, so this registration can't be cancelled." |
| 422 `EVENT_TIME_INVALID` *(Sprint 1, wider meaning)* | E-13, E-14 | now also names `registrationDeadline` |

TEST-SR2-04 (every catalogue code) gains the two new codes. SDS §6.2 gets a version row.

### 0.6 Decisions proposed with these contracts (recorded in SRS v0.6 §10.1)

| ID | Decision | Why |
|---|---|---|
| D-16 | A draft cannot be cancelled. It stays a draft until it is published, because records are never deleted (X-11) | A cancelled event is public (BR-04), so cancelling a draft would publish it as "cancelled" |
| D-17 | Registration closes **at** the deadline (`now ≥ deadline` is closed) | Same boundary as "started" in Sprint 1, so there is one rule to test |
| D-18 | E-06 takes `"saveAsDraft": true` to save a draft. The client still cannot send `status` (Sprint 1 TEST-SR2-02 stays as it is) | The server keeps full control of `status` (BR-17 spirit) |
| D-19 | After start, only `description`, `structureNote`, `contact` and `feeLabel` can be edited. Title, type, format and venue are frozen as well | This is the literal reading of BR-15 ("only … may be edited") |
| D-20 | A `details` change history row stores the **names** of the changed fields, not their old and new text | The history stays short; 2,000-character descriptions are not copied |
| D-21 | Publishing a draft checks BR-02 and BR-08 again (the start must still be at least 60 minutes away, CH-13, and the deadline in the future) | A draft can go stale while it waits |
| D-22 | The search date range uses Bangkok calendar days and includes both ends (`from` 00:00 to `to` 23:59:59.999 +07:00) | Players think in local dates (NFR-11) |
| D-23 | If a new start time is earlier than the stored deadline, the edit is rejected, not adjusted automatically | The organizer sees what will change; nothing changes silently |
| D-24 | Scope change CH-11 is split. Feature-U (game per event, store games) is built in **Sprint 2**. Feature-V (store logo and event banner upload to GCS) is built in **Sprint 3** (decided 21 Nov 2026) | The game field is one column and one filter. Uploads need a bucket, an image library and new deploy settings, which would put the required Sprint 2 features at risk |
| D-25 | `game` is optional in the API and defaults to `OTHER`; the UI requires it. The server does not tie an event's game to the store's game list | Sprint 1 request bodies and tests stay valid; the store list only orders the choices in the form |
| D-37 | The store profile holds the store's **public contact details** (phone, email, website, LINE). Every event shows them in its host section. The event's own `contact` field (Sprint 1, FR-06) stays as an optional "Contact for this event" shown above them. The store email is a separate public field, never the organizer's sign-in email (D-14 is unchanged) | Organizers stop retyping contact details on every event, and players always find a way to reach the store |
| D-38 | Sprint 2 re-themes the client: **Deep Lagoon** colours, **Inter** for text, **Manrope** for figures, IBM Plex Sans Thai kept for Thai (design-direction v0.6). Token names stay; seats move to green | The team chose the palette and fonts from the trials on 21 Nov 2026; keeping token names limits the change to one file and the font imports |
| D-40 | `include=cancelled` adds cancelled events that **have not started yet**; `include=past` adds started events; both together show every cancelled event. The time rule (`past`) and the status rule (`cancelled`) are independent. `seatsAvailable=false` is accepted and is the same as leaving it out. `%` and `_` in `q` match themselves | The AC-J-04 sentence "plus cancelled" had no time rule, and the review of S2-03 asked for one rule that S2-08 (Feature-O) and the traceability rows share |

### 0.7 Contract template

The template is the same as in Sprint 1: **Links** · **Behaviour** · **Rules, validation, boundaries** ·
**Permissions** · **UI** · **API** · **Data** · **Acceptance criteria** · **Planned tests**. When a layer does
not change, the contract says *No change in this layer*.

---

## 1. SR-08 — Record keeping (with the Sprint 2 data foundation)

**Links:** FR-28; X-11; backs BR-08, BR-12 · Depends on: SR-01 · Issue S2-01 · Re-verified in Sprint 3 (check-in)

**Behaviour**
1. Migration `0003_sprint2_lifecycle` adds the Sprint 2 fields of SDS §4.1 and the `EventChange` table.
   Migration `0004_sprint2_constraints` then adds the SQL rules in **Data** below. They are separate migrations so
   the history shows the constraints arriving after their failing tests, as in Sprint 1 (I-01).
2. Every state change records **who** and **when**, either on the record itself or as an `EventChange` row:

| Change | Where it is recorded | Who | When |
|---|---|---|---|
| Event created (draft or published) | `EventChange` `field = status`, `oldValue null` → `DRAFT` / `PUBLISHED` | creator (= owner) | `changedAt` |
| Event published (E-14) | `Event.publishedAt` + `EventChange status DRAFT → PUBLISHED` | owner | both |
| Details edited (E-13) | `EventChange field = details`, `newValue` = changed field names (D-20) | owner | `changedAt` |
| Capacity changed (E-13) | `EventChange field = capacity`, old → new | owner | `changedAt` |
| Deadline changed (E-13) | `EventChange field = deadline`, old effective → new effective (ISO). Only when the body sets a **different** `registrationDeadline`; a start move with no stored deadline is recorded by its `details` row (S2-06, team decision 26 Nov) | owner | `changedAt` |
| Event cancelled (E-15) | `Event.cancelledAt`, `cancelledById`, `cancelReason` + `EventChange status PUBLISHED → CANCELLED` | owner | both |
| Registration created (E-09) | `Registration.participantId`, `createdAt` (Sprint 1) | participant | `createdAt` |
| Registration cancelled (E-16) | `Registration.status = CANCELLED`, `cancelledAt` | the participant (the only one allowed, BR-11) | `cancelledAt` |
| Registration cancelled by the event (E-15) | `Registration.status = EVENT_CANCELLED`, `cancelledAt` | `Event.cancelledById` | `cancelledAt` |

3. `GET /api/organizer/events/:id/changes` (E-17) returns the event's history, newest first, to its owner only.
4. Every change, together with its record, is written in the **same transaction**.

**Rules:** `EventChange` rows are append-only. A database trigger rejects `UPDATE` and `DELETE` on the table
(X-11). No API route deletes an event, registration or change row.

**Permissions:** E-17 follows the SDS §7.1 row "Change history": visitor 401, participant 403, owner ✓, other
organizer 404.

**UI:** a **History** panel on `/organizer/events/:id/edit` lists each change as "23 Nov · 15:00 — Quantum Cards
changed capacity from 24 to 30". The registration list (Feature-I) shows cancelled rows with a muted
**Cancelled** chip and the cancel time.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-17 | `GET /api/organizer/events/:id/changes` | `200 { "items": EventChange[] }`, `changedAt` desc, `id` desc | 400 · 401 · 403 · 404 `EVENT_NOT_FOUND` |
| E-08 | *(changed)* rows gain `cancelledAt` | — | — |

**Data**

| Table | Field | Type | Constraint |
|---|---|---|---|
| Event | `registrationDeadline` | timestamptz null | `event_deadline_before_start`: `"registrationDeadline" IS NULL OR "registrationDeadline" <= "startAt"` |
| Event | `cancelledAt`, `cancelledById` (FK User), `cancelReason` varchar(200) | null | `event_cancel_fields`: all three are set **if and only if** `status = 'CANCELLED'` |
| Registration | `cancelledAt` | timestamptz null | `registration_cancel_fields`: set **if and only if** `status IN ('CANCELLED','EVENT_CANCELLED')` |
| EventChange | `id`, `eventId` FK, `changedById` FK, `field` enum `status \| details \| capacity \| deadline`, `oldValue` text null, `newValue` text, `changedAt` timestamptz | index `(eventId, changedAt)` | trigger `event_change_append_only` (`BEFORE UPDATE OR DELETE … RAISE EXCEPTION`) |

| AC | Given | When | Then |
|---|---|---|---|
| **AC-SR8-01** | Quantum Cards signed in; clock fixed at T | creates an event (capacity 24), then at T + 1 h changes capacity to 30, then at T + 2 h sets a deadline, then calls E-17 | `200` with 3 items, newest first: `deadline` (old = start time, new = the new deadline), `capacity` 24 → 30, `status` null → `PUBLISHED`; each has `changedBy.displayName` "Quantum Cards" and the clock time; no body contains an email or a user id |
| **AC-SR8-02** | change rows exist | direct SQL `UPDATE` and `DELETE` on `"EventChange"` | both are rejected by `event_change_append_only`; the rows are unchanged |
| **AC-SR8-03** | Direct SQL against the test database | insert an event with a deadline after its start; set `status = 'CANCELLED'` without `cancelReason`; set a registration to `CANCELLED` without `cancelledAt` | each is rejected by its named CHECK constraint |
| **AC-SR8-04** | an event owned by Quantum Cards with changes | E-17 as Dragon's Den, Mint and a visitor, and for id 999999 | `404` (byte-identical to the missing id), `403`, `401`, `404` |

**Planned tests:** TEST-SR8-01 … 04 (I).

---

## 2. Feature-K — Draft Events

**Links:** FR-08; BR-04, BR-13; NFR-02 · Re-verifies: BR-04, BR-13 (Feature-D) · Depends on: Feature-D, SR-08 · Issue S2-02

**Behaviour**
1. On `/organizer/events/new`, the organizer can press **SAVE DRAFT** (a secondary button) as well as
   **PUBLISH EVENT**. Both send E-06. SAVE DRAFT adds `"saveAsDraft": true` (D-18).
2. The server validates exactly as Feature-D does (all fields, BR-01 … BR-03). A draft is stored with
   `status DRAFT` and `publishedAt null`, and an `EventChange` row is written (`status` null → `DRAFT`). The UI goes
   to the draft's edit page (`/organizer/events/:id/edit`) with the toast "Draft saved. Only you can see it."; the
   edit page shows the draft banner and **PUBLISH EVENT** (v0.8; from v0.7 until S2-04 it went to `/events/:id`)
3. The draft appears on the dashboard (E-07) with a **Draft** chip and a **Publish** button. Only its owner can
   open its detail page, which shows the banner "Draft — only you can see this event." and **PUBLISH EVENT**.
4. **PUBLISH EVENT** calls E-14. It checks BR-02 and BR-08 again (D-21), then sets `status PUBLISHED`,
   `publishedAt = now`, and writes `EventChange` `DRAFT → PUBLISHED`. Toast: "Your event is live."

**Rules, validation, boundaries**
- `saveAsDraft` is an optional boolean (default `false`); any other type gives `400`. `status`, `publishedAt` and
  `organizerId` are still forbidden keys (Sprint 1 §7).
- A draft is invisible to everyone except its owner, everywhere: E-04 (with any filter, including
  `include=past,cancelled`), E-05 and E-09 answer as if it did not exist (`404 EVENT_NOT_FOUND`), and E-16 never
  applies because a draft has no registrations.
- E-14 order: 401 → 403 (role) → 403 (Origin) → 400 (path, body `{}` or none) → 404 (missing or not the owner) →
  409 `ALREADY_CANCELLED` → 409 `ALREADY_PUBLISHED` → 422 `EVENT_TIME_INVALID` (`startAt < now + 60 min`,
  CH-13, or `registrationDeadline ≤ now`) → 200.
- A draft can be edited with E-13 like an upcoming event (Feature-L). It cannot be cancelled (D-16).

**Permissions:** E-06 organizer only (as Sprint 1). E-14 owner only: other organizer 404, participant 403, visitor
401.

**UI**
- Create page: **PUBLISH EVENT** (primary) and **SAVE DRAFT** (secondary). Both show a busy state, and both keep
  the input when there is an error.
- Dashboard: Draft chip (muted) · **Publish** and **Edit** buttons · no **Registrations** link for drafts (Edit since
  S2-04, v0.8).
- Detail page (owner, draft): amber banner and **PUBLISH EVENT**. Organizer actions are not shown to anyone else.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-06 | *(changed)* `POST /api/events` with optional `saveAsDraft: boolean` | `201 EventDetail` (`status DRAFT` or `PUBLISHED`) | as Sprint 1 |
| E-14 | `POST /api/organizer/events/:id/publish`, body `{}` or none | `200 EventDetail` | 400 · 401 · 403 · 404 · 409 `ALREADY_PUBLISHED` / `ALREADY_CANCELLED` · 422 |
| E-04, E-05, E-09 | *(changed)* drafts are excluded / `404` for non-owners | — | — |

**Data:** no new fields (`status DRAFT` has existed since Sprint 1). The `EventChange` rows come from SR-08.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-K-01** | Quantum Cards signed in; clock fixed | E-06 with a valid body and `saveAsDraft: true`; then E-07 and E-05 as the owner; UI: fill the form and press SAVE DRAFT | `201`; the row has `status DRAFT`, `publishedAt null`, owner = Quantum Cards; one `EventChange` null → `DRAFT`; E-07 lists it as Draft; E-05 gives `MANAGE`; the UI lands on the draft's edit page with "Draft saved. Only you can see it." and the draft banner |
| **AC-K-02** | the draft from AC-K-01 | E-04 (no filter, and with `include=past,cancelled` and `q` = its title) as a visitor, Nok and Dragon's Den; E-05 for it as a visitor, Nok and Dragon's Den; E-09 for it by Nok | the draft is in no list; every E-05 is `404 EVENT_NOT_FOUND`, byte-identical to id 999999; E-09 is `404` and no row is stored |
| **AC-K-03** | the draft; clock T | the owner calls E-14; then E-04 as a visitor; UI: press PUBLISH EVENT on the dashboard | `200`, `status PUBLISHED`, `publishedAt = T`; `EventChange` `DRAFT → PUBLISHED`; the event is now in E-04; toast "Your event is live." |
| **AC-K-04** | a draft whose start is now in the past (clock moved); a draft starting in 30 min; a draft starting in exactly 60 min; a published event; a cancelled event | the owner calls E-14 on each | `422 EVENT_TIME_INVALID` (field `startAt`) and the event stays `DRAFT` for the first two (CH-13); `200` for the 60-min draft; `409 ALREADY_PUBLISHED`; `409 ALREADY_CANCELLED`; nothing is changed and no change row is written |
| **AC-K-05** | a draft owned by Quantum Cards | E-14 by Dragon's Den, Mint, a visitor and with a foreign Origin; E-06 by Mint with `saveAsDraft: true`; E-06 with `saveAsDraft: "yes"` and with `status: "DRAFT"` | `404`, `403`, `401`, `403`; Mint's E-06 is `403`; both bad bodies are `400`; nothing is stored or changed |

**Planned tests:** TEST-K-01 … 05 (U, I, C, E2E).

---

## 3. Feature-L — Event Editing and Capacity Change

**Links:** FR-09, FR-28; BR-01, BR-02, BR-09, BR-15; NFR-11 · UAT finding **#64** (owners need to edit a published
event) is delivered here · Depends on: Feature-D, Feature-G, SR-08 · Issue S2-04

**Behaviour**
1. The owner opens `/organizer/events/:id/edit` from **MANAGE** on the detail page or **Edit** on the dashboard.
   The form is the create form filled with the current values. Only the fields that changed are sent, with
   `PATCH /api/organizer/events/:id` (E-13).
2. The server locks the event row (`FOR UPDATE`, the same lock as registration in SDS §4.4), checks the rules
   below, saves, writes one `EventChange` row per kind of change (`details`, `capacity`, `deadline`), and
   responds with the fresh `EventDetail`. Toast: "Changes saved."
3. The page also contains the **Registrations** link, the **History** panel (SR-08) and the **Cancel event**
   section (Feature-O, added by S2-05). For a draft it also has the draft banner and **PUBLISH EVENT** (Feature-K).
4. A 409 refusal lists its reason in `details` too: `EVENT_STARTED` names each frozen field in the order the body sent
   them, and `CAPACITY_BELOW_REGISTERED` says "{n} players are registered, so capacity can't go below {n}." on
   `capacity` (v0.8).

**Rules, validation, boundaries** (shape errors are reported together, then rule errors)

| Check | Result |
|---|---|
| Body has no fields (`{}`) | `400` "Change at least one field." |
| A field fails its Feature-D shape rule (length, enum, capacity 1–256 whole number) | `400 VALIDATION_FAILED` with the Sprint 1 message |
| Unknown or forbidden key (`organizerId`, `status`, `publishedAt`, `saveAsDraft`) | `400` "This value cannot be set." |
| Event is `CANCELLED` | `409 ALREADY_CANCELLED` |
| Event has started (`startAt ≤ now`) and the body has any field other than `description`, `structureNote`, `contact`, `feeLabel` (BR-15, D-19) | `409 EVENT_STARTED`; `details` lists each frozen field |
| A new `startAt` in the body that is `< now + 60 min` (CH-13; checked **only when the body sets `startAt`**, so editing the end or other fields of an event starting soon still works); new end ≤ new start; new end > new start + 24 h (the end rules use the **resulting** start and end, so a body with only `endAt` uses the stored `startAt`) | `422 EVENT_TIME_INVALID` naming the field (BR-02) |
| New `capacity` < active registrations (BR-09) | `409 CAPACITY_BELOW_REGISTERED`; the message gives the number |
| The deadline rules of Feature-M | see §4 |

- Boundaries: capacity = active count is accepted. Capacity 256 is accepted and 257 is rejected. At `now = startAt`
  the event counts as started.
- Raising capacity never changes a registration. Lowering it never removes one (D-04).

**Permissions:** owner only. Other organizer 404, participant 403, visitor 401, foreign Origin 403.

**UI**
- The same field order and client checks as the create page. Under the capacity field: "At least {n}: that's how
  many players are registered."
- On a started event, the frozen fields are shown read-only with the note "This event has started. Only the
  description, structure, contact and fee can change."
- **SAVE CHANGES** is disabled until something changes. On `409`, the server message is shown above the form and
  the input is kept. Leaving the page with unsaved changes asks "Leave without saving?".

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-13 | `PATCH /api/organizer/events/:id`, a partial body of the E-06 fields plus `registrationDeadline` (Feature-M) | `200 EventDetail` | 400 · 401 · 403 · 404 · 409 `ALREADY_CANCELLED` / `EVENT_STARTED` / `CAPACITY_BELOW_REGISTERED` · 415 · 422 |

**Data:** no new fields beyond SR-08.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-L-01** | Quantum Cards owns an upcoming event with 3 registrations; clock fixed | E-13 with a new `title`, `venueName` and `description`; then E-05; UI: change the title on the edit page and press SAVE CHANGES | `200` with the new values; E-05 shows them; the 3 registrations are unchanged; one `EventChange` row with `field details`, `newValue` "title, venueName, description"; the UI shows "Changes saved." |
| **AC-L-02** | the same event: capacity 24, 3 active | E-13 `capacity` = 3, 2, 256, 257, 0, 1.5, then 30 | 3 → `200`; 2 → `409 CAPACITY_BELOW_REGISTERED` ("3 players are registered…"); 256 → `200`; 257, 0 and 1.5 → `400`; 30 → `200` with `seatsRemaining 27` (checked by an independent count); one `capacity` change row per accepted value; no registration is touched |
| **AC-L-03** | an event with capacity 10 and 8 active; 5 more participants signed in | E-13 `capacity 8` and the 5 E-09 calls are sent at the same time; repeated for 20 rounds | in every round, active ≤ capacity at the end; either the capacity change wins (`200`, and all 5 registrations get `409 EVENT_FULL`) or some registrations win first (the change then gets `409 CAPACITY_BELOW_REGISTERED`) |
| **AC-L-04** | an upcoming event starting at T + 2 days, 4 hours long; clock T | E-13 with `startAt` = T − 1 min; `startAt` = T + 59 min; `startAt` = T + 60 min **with `endAt` = T + 5 h** (v0.8: a start alone would make a 51-hour event, which the end rule refuses); `endAt` only = start + 25 h; `endAt` only = start + 24 h; `startAt` = T + 3 days together with `endAt` = T + 3 days + 4 h | `422` on `startAt` ×2 (CH-13); `200`; `422` on `endAt`; `200`; `200`, and the event moves later in E-04 order |
| **AC-L-05** | an event that started 1 h ago (clock fixed), with 2 registrations | E-13 with `description` + `feeLabel`; then with `capacity`; then with `startAt` + `title`; UI: open its edit page | `200` for the first; `409 EVENT_STARTED` with `details` for `capacity`, then for `startAt` and `title`; nothing frozen changes; the page shows those fields read-only with the started note |
| **AC-L-06** | an event owned by Quantum Cards; a cancelled event owned by Quantum Cards | E-13 by Dragon's Den, Mint, a visitor, with a foreign Origin, with `{}`, with `organizerId`; E-13 on the cancelled event | `404`, `403`, `401`, `403`, `400` "Change at least one field.", `400`; `409 ALREADY_CANCELLED`; nothing is stored or changed |

**Planned tests:** TEST-L-01 … 06 (U, I, C, E2E). TEST-L-03 is a concurrency test, run like TEST-G-06.

---

## 4. Feature-M — Registration Deadline

**Links:** FR-09 (deadline field); BR-08; NFR-11 · Re-verifies: BR-04 · Depends on: Feature-L, Feature-G, SR-03 · Issue S2-06

**Behaviour**
1. The create and edit forms have an optional **Registration closes** date-time (Bangkok time). If it is left
   empty, registration closes at the start time.
2. The detail page shows "Registration closes Thu 5 Nov · 15:00" under the seats card, using `registrationDeadline`
   from E-05. After the deadline, the button is **REGISTRATION CLOSED** (server action `CLOSED`).
3. Every registration (E-09) and every participant cancellation (E-16) uses the openness rule in §0.3.

**Rules, validation, boundaries** (field `registrationDeadline`, E-06 and E-13)

| Input | Result |
|---|---|
| ISO 8601 **with offset**, or `null` | accepted shape (`null` = default to the start time); anything else gives `400` "Enter a date and time." |
| deadline > (resulting) `startAt` | `422 EVENT_TIME_INVALID` "Registration must close at or before the start." |
| deadline ≤ now | `422 EVENT_TIME_INVALID` "The deadline must be in the future." |
| deadline = `startAt` | accepted |
| a new `startAt` earlier than the stored deadline, with no new deadline in the body | `422` on `registrationDeadline` (D-23) |
| the event has started | the deadline is frozen (`409 EVENT_STARTED`, Feature-L) |
| clock `= deadline` | registration and cancellation are closed (D-17) |

**Permissions:** set by the owner (E-06 creator, E-13 owner). Read by everyone who can see the event.

**UI:** the date-time input sits next to start and end, with the hint "Leave empty to close at the start time."
Errors appear under the field.

**API:** E-06 and E-13 accept `registrationDeadline`. E-04, E-05, E-07, E-10 and E-11 return the effective
`registrationDeadline`. E-09 and E-16 enforce it. *No new endpoint.*

**Data:** `Event.registrationDeadline` and `event_deadline_before_start` from SR-08.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-M-01** | Quantum Cards signed in; clock T | E-06 with no deadline; E-06 with deadline = start − 2 h; E-13 setting a deadline on the first; then E-05 and the detail page | the first returns `registrationDeadline` = `startAt`; the second returns start − 2 h; the E-13 change returns `200` and writes a `deadline` change row; the page shows "Registration closes …" in Bangkok time |
| **AC-M-02** | an event starting at T + 1 day; clock T | deadline = start + 1 min; = T; = T − 1 min; = start; = `null`; a new `startAt` = T + 2 h while the stored deadline is T + 20 h | `422` ×3 naming `registrationDeadline`; `200` ×2 (`null` gives back `startAt`); `422` on `registrationDeadline` (D-23) |
| **AC-M-03** | an open event with deadline D (before start) and seats left; Nok | E-09 with the clock at D − 1 min, at D, and at D + 1 min (on separate events); E-05 at D | `201`; `409 REGISTRATION_CLOSED`; `409 REGISTRATION_CLOSED`; E-05 action `CLOSED`, and the page shows a disabled **REGISTRATION CLOSED**; the event is still in E-04 because it has not started |
| **AC-M-04** | Mint is registered on an event with deadline D | E-10, E-11 and E-05 at D − 1 min and at D; E-16 at D | `canCancel true`, then `false` in all three; E-16 at D gives `409 REGISTRATION_CLOSED` and the registration stays `REGISTERED` |

**Planned tests:** TEST-M-01 … 04 (U, I, C, E2E). TEST-M-04 runs in S2-07 (#84), where `canCancel` and E-16 are built (S2-06).

---

## 5. Feature-N — Registration Cancellation and Re-registration

**Links:** FR-19, FR-20, FR-28; BR-06, BR-11; NFR-05 · Re-verifies: BR-05, BR-06 (Feature-G) · Depends on: Feature-G, Feature-M, SR-08 · Issue S2-07

**Behaviour**
1. In My Events, and on the event detail page when `viewer.action = REGISTERED` and `canCancel = true`, the
   participant sees **Cancel registration**. It opens a confirmation dialog: "Cancel your seat at {title}? You can
   register again while seats are left." with **Keep my seat** and **Cancel registration**.
2. `POST /api/me/registrations/:id/cancel` (E-16) locks the **event** row (so the cancellation queues with
   registrations and capacity edits), checks the rules, sets `status CANCELLED` and `cancelledAt = now`, and
   responds with the `ParticipantRegistration` and fresh counts. The seat is free at once.
3. The row stays in My Events with a muted **Cancelled** chip. The event's button goes back to **REGISTER** if
   registration is still open.
4. Registering again (E-09) creates a **new** registration row (D-03). The old row is kept.

**Order of checks (E-16):** 401 → 403 (not a participant) → 403 (Origin) → 400 (path id; body `{}` or none) →
404 `REGISTRATION_NOT_FOUND` (missing or not the caller's) → 409 `ALREADY_CANCELLED` (`CANCELLED` or
`EVENT_CANCELLED`) → 409 `ALREADY_CHECKED_IN` → 409 `REGISTRATION_CLOSED` (§0.3 openness is false) → 200.

**Permissions:** participant, own registration only. Another participant's id gives `404`, byte-identical to a
missing id (D-08). Organizers get 403.

**UI:** the button shows "Cancelling…" with `aria-busy`, and extra presses are ignored. On success: toast "Your
registration is cancelled.", the chip changes, and the counts refresh. On `409`: the server message in an alert,
and the row is reloaded.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-16 | `POST /api/me/registrations/:id/cancel`, body `{}` or none | `200 ParticipantRegistration` | 400 · 401 · 403 · 404 · 409 (three codes) · 415 |
| E-10, E-11 | *(changed)* rows gain `cancelledAt`, `canCancel` | — | — |

**Data:** `Registration.cancelledAt` from SR-08. The partial unique index `registration_one_active` (Sprint 1) is
what allows one new active row after a cancel, and never two.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-N-01** | Mint `REGISTERED` on an event at 3 / 24 before its deadline; clock T | E-16 by Mint; then E-10, E-08 (owner) and E-05; UI: Cancel registration → confirm in My Events | `200`, `status CANCELLED`, `cancelledAt = T`, event 2 / 24 with 22 left (independent count); the row still exists; E-08 shows Mint as Cancelled with the time; E-05 gives `REGISTER`; the UI shows the Cancelled chip and the toast |
| **AC-N-02** | after AC-N-01 | E-09 by Mint; then E-09 by Mint again | `201` with a new id (≠ the old one); Mint has 2 rows for the event (1 `CANCELLED`, 1 `REGISTERED`); E-05 gives `REGISTERED` with the new id; the second E-09 is `409 ALREADY_REGISTERED` |
| **AC-N-03** | a full event (2 / 2: Ploy, Boss); Nok | Ploy cancels; Nok registers; Ploy registers again | `200`; `201`; `409 EVENT_FULL`; active = 2 = capacity |
| **AC-N-04** | Mint's registrations: one `CANCELLED`, one `EVENT_CANCELLED`, one `CHECKED_IN` (set by SQL), one on an event whose deadline has passed | E-16 on each | `409 ALREADY_CANCELLED` ×2, `409 ALREADY_CHECKED_IN`, `409 REGISTRATION_CLOSED`; no row changes |
| **AC-N-05** | Mint's active registration | E-16 by Ploy, by Quantum Cards (the event owner), by a visitor, with a foreign Origin, with body `{ "participantId": … }`; and for id 999999 by Mint | `404` (byte-identical to 999999), `403`, `401`, `403`, `400`; `404 REGISTRATION_NOT_FOUND`; nothing changes |
| **AC-N-06** | a full event (capacity 2) where P1 holds a seat; 10 other participants; separately, Mint with one active registration | P1's E-16 and 10 E-09 calls are sent at the same time; separately, Mint sends 2 E-16 calls at the same time; 20 rounds | each round: exactly one of the 10 gets `201`, active = 2; Mint gets one `200` and one `409 ALREADY_CANCELLED` |

**Planned tests:** TEST-N-01 … 06 (U, I, C, E2E). TEST-N-06 is a concurrency test.

---

## 6. Feature-O — Event Cancellation

**Links:** FR-10, FR-28; BR-04, BR-12; NFR-02 · Depends on: Feature-D, Feature-G, SR-08 · Issue S2-05

**Behaviour**
1. At the bottom of the edit page, **Cancel event** opens a dialog with a required **Reason** (it is shown to
   players) and the warning "This can't be undone. All {n} registered players will see the event as cancelled."
2. `POST /api/organizer/events/:id/cancel` (E-15) locks the event row and, **in one transaction**: sets
   `status CANCELLED`, `cancelledAt`, `cancelledById`, `cancelReason`; changes every active registration
   (`REGISTERED`, `CHECKED_IN`) to `EVENT_CANCELLED` with `cancelledAt`; and writes `EventChange` `PUBLISHED →
   CANCELLED`. Rows that are already `CANCELLED` are not touched.
3. The cancelled event stays visible (BR-04). Its detail page shows a red banner "Cancelled by the organizer:
   {reason}" and **REGISTRATION CLOSED**. It is left out of the default list (FR-14, Feature-J). In My Events,
   affected players see **Event cancelled**.

**Rules, validation, boundaries**

| Check (in order after auth, Origin, path and body shape) | Result |
|---|---|
| `reason` missing, not a string, or not 5–200 characters after trimming | `400` "Give a reason of 5 to 200 characters." |
| Not the owner, or missing | `404 EVENT_NOT_FOUND` |
| Already `CANCELLED` | `409 ALREADY_CANCELLED` |
| `DRAFT` (D-16) | `409 NOT_PUBLISHED` |
| Started (`startAt ≤ now`) | `409 EVENT_STARTED` |

- Cancellation is final: there is no endpoint that reverses it. E-13, E-14, E-15 and E-09 all refuse a cancelled
  event.
- Because cancellation and registration lock the same row, a registration that arrives after the cancellation
  gets `409 REGISTRATION_CLOSED`, and one that arrived before it becomes `EVENT_CANCELLED`.

**Permissions:** owner only. Other organizer 404, participant 403, visitor 401.

**UI:** the dialog has a character counter (5–200). **CANCEL EVENT** is red and shows "Cancelling…" while
sending. After success, the page goes to the detail page with the banner. The dashboard row shows a red
**Cancelled** chip and no Edit button.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-15 | `POST /api/organizer/events/:id/cancel`, body `{ "reason": string }` | `200 EventDetail` (`status CANCELLED`, `cancelReason`, `cancelledAt`) | 400 · 401 · 403 · 404 · 409 `ALREADY_CANCELLED` / `NOT_PUBLISHED` / `EVENT_STARTED` · 415 |
| E-05 | *(changed)* `cancelReason`, `cancelledAt` are public on a cancelled event; `cancelledById` is never returned | — | — |

**Data:** the cancel fields and `event_cancel_fields` from SR-08.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-O-01** | Quantum Cards owns an upcoming event with 3 `REGISTERED` and 1 `CANCELLED`; clock T | E-15 with reason "Store closed for renovation." | `200`; the event is `CANCELLED` with `cancelledAt = T`, `cancelledById` = Quantum Cards, and the reason; the 3 rows are `EVENT_CANCELLED` with `cancelledAt = T`; the `CANCELLED` row is unchanged; one change row `PUBLISHED → CANCELLED` |
| **AC-O-02** | after AC-O-01 | E-09 by Nok; E-13, E-14 and E-15 by the owner; E-04 default and with `include=cancelled`; E-05 as a visitor; E-10 as an affected player; UI: open the detail page and My Events | `409 REGISTRATION_CLOSED`; `409 ALREADY_CANCELLED` ×3; absent by default and present with `status CANCELLED` on request; E-05 has `cancelReason`, action `CLOSED` and no `cancelledById`; E-10 shows `EVENT_CANCELLED`; the page shows the red banner with the reason and My Events shows **Event cancelled** |
| **AC-O-03** | an upcoming event | `reason` missing, `"abcd"`, 201 characters, `"     "`; then 5 characters and 200 characters (on two events) | `400` ×4 with the reason message, nothing changes; `200` ×2 |
| **AC-O-04** | an event that started 1 min ago; an event starting exactly now; a draft | E-15 on each | `409 EVENT_STARTED` ×2; `409 NOT_PUBLISHED`; nothing changes |
| **AC-O-05** | an event owned by Quantum Cards | E-15 by Dragon's Den, Mint, a visitor, and with a foreign Origin | `404`, `403`, `401`, `403`; nothing changes |
| **AC-O-06** | an open event with 20 seats; 10 participants signed in | E-15 and 10 E-09 calls are sent at the same time; 20 rounds | at the end of each round the event is `CANCELLED` and has **no** active registration; every E-09 got either `201` (and that row is now `EVENT_CANCELLED`) or `409 REGISTRATION_CLOSED` |

**Planned tests:** TEST-O-01 … 06 (U, I, C, E2E). TEST-O-06 is a concurrency test.

---

## 7. Feature-J — Event Search and Filters

**Links:** FR-13, FR-14; BR-04, BR-16; NFR-12 (measured in Sprint 3, SR-06) · Depends on: Feature-F · Issue S2-03

**Behaviour**
1. The search bar on `/events` becomes active, replacing the inactive Sprint 1 bar and its note. It has **Where**
   (text: store, venue or city), **Event type**, **Format**, **From** and **To** dates, a **Seats available only**
   switch, and **Show past and cancelled events**. Pressing **Search** (or Enter) writes the filters into the URL
   (`/events?q=…&type=…&page=1`) and calls E-04 with the same query. Back and forward restore earlier searches.
2. Results are paged 20 at a time with **Previous** and **Next** and the text "21–40 of 45". Active filters show
   as chips with a remove (×) button, plus **Clear all**.
3. No results: "No events match your search." with **Clear filters**.

**Query parameters of E-04** (all optional; strict: an unknown key gives `400`)

| Key | Rule | Meaning |
|---|---|---|
| `q` | 1–100 characters after trimming (empty = ignored) | case-insensitive substring of `title`, `venueName` or `city`; `%` and `_` are matched literally; Thai text works |
| `type` | `CASUAL` · `TOURNAMENT` · `RELEASE` | exact |
| `format` | `CONSTRUCTED` · `SEALED` · `DRAFT` | exact |
| `from`, `to` | `YYYY-MM-DD`, a real date; `from ≤ to` | `startAt` inside the Bangkok days, both included (D-22) |
| `seatsAvailable` | `true` · `false` | `true` = `registeredCount < capacity` |
| `include` | comma list of `past`, `cancelled` | adds started events and/or `CANCELLED` events; **drafts are never included** |
| `page` | integer ≥ 1, default 1 | page size is fixed at 20 |

- All filters are combined with AND. Order: `startAt` asc, then `id` asc, so the pages never overlap or skip.
- Response: `{ "items": EventSummary[], "meta": { "page", "pageSize": 20, "totalItems" } }` (SDS §6.1). A page
  after the last one returns `items: []` with the right `totalItems`.
- Error details name the key, for example `to`: "The end date must be on or after the start date."
- A past or cancelled event is shown, but it is never registrable (E-05 `CLOSED`, E-09 `409`).

**Permissions:** public, as in Sprint 1. No response contains participant data (BR-16).

**UI:** filters use native `<select>`, `<input type="date">` and a checkbox, so they work with the keyboard and
screen readers. The result count is announced in a polite live region. Past and cancelled cards are dimmed and
show a **Past** or **Cancelled** chip.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-04 | *(changed)* `GET /api/events?q&type&format&from&to&seatsAvailable&include&page` | `200 { items, meta }` | 400 `VALIDATION_FAILED` |

**Data:** no new fields. A search index is left to SR-06 (Sprint 3) if the NFR-12 measurement needs one.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-J-01** | the seed (9 events) | E-04 with `q` = "quantum", "BANGKOK", "draft night", "เปิดกล่อง", "50%_off", 101 characters | the Quantum Cards upcoming events; every upcoming published event; EV-5; EV-6; `[]`; `400` on `q` |
| **AC-J-02** | built data: types, formats, dates across a Bangkok midnight, one full event | E-04 with `type`, `format`, `from`/`to` (an event at 23:30 Bangkok on `to` is included, one at 00:30 the next day is not), `seatsAvailable=true`, and all of them combined; then `type=PARTY`, `from=2026-02-30`, `from` after `to` | exactly the matching ids each time (AND); `400` ×3 naming the key |
| **AC-J-03** | 45 upcoming published events that match | pages 1, 2, 3 and 4; page `0` and `abc` | 20 + 20 + 5 items with `meta.totalItems 45`, no id twice and none missing, `startAt` then `id` order; page 4 `[]` with `totalItems 45`; `400` ×2 |
| **AC-J-04** | upcoming, started, cancelled and draft events | E-04 with no `include`, `include=past`, `include=cancelled`, `include=past,cancelled`, `include=drafts` | upcoming published only; plus started; plus cancelled that have not started (D-40); plus both; `400`; a draft never appears in any of them |
| **AC-J-05** | the seed, in the browser | type "quantum", choose Constructed, press Search; go to page 2 of a long list; press Back; remove a chip; search for "zzz" | the URL holds the filters and the list matches E-04; Previous/Next and "21–40 of N" are correct; Back restores the earlier list; removing a chip searches again; "No events match your search." with **Clear filters** |
| **AC-J-06** | registrations exist | E-04 with `organizerId=1` and with `participantId=3`; stringify the bodies of every AC-J call | `400` ×2; no body contains a participant id, display name, email or a `registrations` key |

**Planned tests:** TEST-J-01 … 06 (U, I, C, E2E).

---

## 8. Changes to Sprint 1 features (re-verification)

| Sprint 1 item | Sprint 2 change | How it is re-tested |
|---|---|---|
| Feature-B, TEST-B-03 | The permission matrix gains E-13 … E-17 (SDS §7.1 rows) | TEST-B-03 gains rows; every cell is checked |
| Feature-D, E-06 | Optional `saveAsDraft` and `registrationDeadline`; creation writes an `EventChange`; the `contact` field's hint now points at the store contact (D-37), with no rule change | TEST-D-01 … 05 unchanged and still green; TEST-K-01, TEST-M-01, TEST-U-04 |
| Feature-E, E-07 | Shows drafts and cancelled events with their chips; Edit and Publish buttons | TEST-E-01 gains a draft and a cancelled row |
| Feature-F, E-04 / E-05 | Query, paging and `meta` (J); drafts are 404 (K); the new `CLOSED` rule (M); cancel fields (O) | TEST-F-01 … 05 unchanged and still green with no query; TEST-J-*, K-02, M-03, O-02 |
| Feature-G, E-09 | Draft → 404; deadline → closed; cancelled → closed | TEST-G-01 … 06 still green, except TEST-G-04's draft case, which now expects `404 EVENT_NOT_FOUND` (v0.7, Sprint 1 STS v1.16); TEST-K-02, M-03, O-02 |
| Feature-H / I, E-08, E-10, E-11 | `cancelledAt`, `canCancel` | TEST-H-*, I-* still green; TEST-N-01, M-04 |
| SR-01, AC-SR1-02 | The seed has 9 events (§0.4) | TEST-SR1-02 is updated in S2-01, and the change is recorded in Sprint 1 STS §8 |
| SR-02, TEST-SR2-03 / 04 | Route table + new codes | rows added |
| Feature-C, AC-C-01 … 06; SR-05, AC-SR5-01 | Theme values and fonts change (D-38, §12) | TEST-C-01 … 06 and TEST-SR5-01 still green; TEST-C-07, C-08 |

Nothing in Sprint 1 is weakened. A Sprint 1 test that has to change is changed in its own commit, with the reason,
and recorded in both STS version tables.

## 9. Journeys (E2E, run on the release candidate)

| ID | Journey | Covers |
|---|---|---|
| JRN-03 | Quantum Cards saves a draft → Nok cannot find it → Quantum Cards publishes it → Nok registers → Quantum Cards raises capacity and sets a deadline → Nok cancels → Nok registers again → Quantum Cards cancels the event with a reason → Nok sees **Event cancelled** with the reason | K, L, M, N, O, SR-08 |
| JRN-04 | A visitor searches "quantum", filters Constructed, pages, opens a result, signs in from SIGN IN TO REGISTER and registers | J + Sprint 1 FR-26 |
| JRN-01, JRN-02 | The Sprint 1 journeys, unchanged | Sprint 1 continuity (Deliverable 2 Part A) |

## 10. AC summary

| Item | ACs | Count |
|---|---|---|
| SR-08 | AC-SR8-01 … 04 | 4 |
| Feature-K | AC-K-01 … 05 | 5 |
| Feature-L | AC-L-01 … 06 | 6 |
| Feature-M | AC-M-01 … 04 | 4 |
| Feature-N | AC-N-01 … 06 | 6 |
| Feature-O | AC-O-01 … 06 | 6 |
| Feature-J | AC-J-01 … 06 | 6 |
| Feature-U *(CH-11, §11.1)* | AC-U-01 … 05 | 5 |
| Feature-C theme *(D-38, §12)* | AC-C-07, AC-C-08 | 2 |
| **Total** | | **44** |

Requirements established in Sprint 2 ([`../plan.md`](../plan.md) §5): FR-08, FR-09, FR-10, FR-13, FR-14, FR-19,
FR-20, FR-28 · BR-08, BR-09, BR-11, BR-12, BR-15 (13). CH-11 adds FR-29 and the games part of FR-30 (15 in total).
Each one is linked to at least one AC above. Feature-V's 7 ACs are Sprint 3 work, in the Sprint 3
contracts §6, and are not counted here.

## 11. Scope change CH-11: game per event, store logo and event banner

The team added this request on 21 Nov 2026, after the baseline. On the same day the team decided the sprint for
each part (D-24):
- **Feature-U** (game) is in **Sprint 2**. Its 3 ACs are counted in §10 and tested in `sts.md` §2.8.
- **Feature-V** (logo and banner upload) is in **Sprint 3**. Its contract is in the Sprint 3 contracts §6
  (see §11.2).

The change is final once the contracts PR is reviewed. Visual prototype: the canvas "TCG Event Hub — Store
Branding" (event detail, Find an Event, store profile and banner upload, phone).

**New requirements (SRS v0.6 if approved)**
- **FR-29** An organizer chooses the **game** an event is for, from a fixed list: Pokémon TCG, Magic: The
  Gathering, One Piece Card Game, Yu-Gi-Oh!, Digimon Card Game, Lorcana, Other. Players can filter the list by game.
- **FR-30** An organizer keeps a **store profile** with the games the store runs, and an optional **store logo**.
  The logo and games are shown on the store's events and in search results.
- **FR-31** An organizer can add an optional **banner image** to each event. Without one, the event page shows a
  neutral playmat pattern with no game or publisher name.
- **NFR-17** Image uploads are safe:
  - only PNG, JPEG or WebP, checked from the file bytes, never from the file name or the browser's type;
  - a size limit (logo 2 MB, banner 5 MB) enforced before the whole file is read;
  - a pixel limit;
  - every image is re-encoded on the server, so metadata (EXIF, GPS) and anything hidden in the file are
    removed;
  - stored under a random name;
  - served with `X-Content-Type-Options: nosniff`.
- Game names are shown as **text only**. No publisher logos or artwork are used (D-02).

| ID | Feature | Requirements | Depends on | Sprint (D-24) |
|---|---|---|---|---|
| **Feature-U** | Game per Event and Store Profile (games, contact) | FR-29, FR-30 (games, contact) | D, J, L, SR-01 | **2**: Issue S2-09 |
| **Feature-V** | Store Logo and Event Banner | FR-30 (logo), FR-31, NFR-17 | U, SR-04 | **3** |

### 11.1 Feature-U — Game per Event and Store Profile (games, contact)

**Links:** FR-29, FR-30 (games, contact); NFR-02, NFR-15 · Re-verifies: FR-06, FR-13 (Feature-D, J) · Issue S2-09 ·
Decision D-37 (contact added in v0.4)

**Behaviour**
1. `Event.game` (enum `POKEMON | MAGIC | ONE_PIECE | YUGIOH | DIGIMON | LORCANA | OTHER`) is set on create (E-06)
   and on edit (E-13). In the API it is optional and defaults to `OTHER`, so Sprint 1 bodies and tests stay valid.
   In the UI it is required.
2. `User.games` (an array of the same enum, organizers only) is set on `/organizer/store` through
   `PATCH /api/organizer/store` (E-23). The create and edit forms offer the store's games first and an "Other
   games" group after them. The server does **not** reject a game that is missing from the profile.
3. `EventSummary` gains `game` and `store: { displayName, logoUrl }`. `EventDetail` gains `store.games`.
4. E-04 gains `game` (one enum value), combined with the other filters by AND (Feature-J).
5. **Store contact (D-37).** The store profile also holds four optional, public contact fields: `contactPhone`,
   `contactEmail`, `contactWebsite` and `contactLine`, set through the same E-23. `EventDetail.store` gains
   `contact: { phone, email, website, line }`, with `null` for each empty field. The detail page's host section
   shows them as follows:
   - the phone as a `tel:` link;
   - the email as a `mailto:` link;
   - the website as a link that shows only its host name (`quantumcards.example`), opens in a new tab with
     `rel="noopener noreferrer nofollow"`;
   - the LINE ID as plain text.

   When the event's own `contact` field is set, it is shown first as **Contact for this event**. The create
   form's hint for that field reads "Leave empty to use your store's contact details." If the event and the
   store have no contact details at all, the section is not shown.
6. UI (as in the prototype):
   - **Game** dropdown in the search bar, and a **neutral** game chip (white with a card icon) on event cards
     and the detail page. Teal stays reserved for seats and "registered". A list filtered to one game hides the
     chip and names the game in the list heading;
   - a required **Game** radio group on the create and edit forms;
   - `/organizer/store` with "Games played here" toggle chips (`aria-pressed`), a **Contact** card (Phone, Email,
     Website, LINE ID, each with a visible label and an example hint) and **SAVE PROFILE**, linked from the
     organizer menu;
   - a host section on the detail page with the store's games and its contact details.
   The logo and banner parts of the prototype wait for Feature-V. Until then, the initials and the playmat pattern
   are shown.

**Permissions:** E-23 is for organizers only, and an organizer can change only their own profile (the identity
comes from the session, BR-17). Participant 403, visitor 401, foreign Origin 403. `GET /api/organizer/store`
returns the caller's own `{ displayName, games, contact }`. The contact details are public on events (D-37).

**Contact validation** (E-23; every field optional; `""` or `null` clears it; values are trimmed; all failing fields
are reported together):

| Field | Rule | Error message |
|---|---|---|
| `contactPhone` | 9–20 characters of digits, spaces, `+`, `-`, `(`, `)`; at least 9 digits | "Enter a phone number, for example 02 555 0101." |
| `contactEmail` | a valid email address, at most 254 characters; stored lower-case | "Enter an email address, for example hello@store.example." |
| `contactWebsite` | an absolute URL starting with `https://` or `http://`, at most 200 characters | "Enter a web address starting with https://." (so `javascript:`, `data:` and `ftp:` are rejected) |
| `contactLine` | an optional leading `@`, then 1–39 of `A–Z a–z 0–9 . _ -` | "Enter a LINE ID, for example @quantumcards." |

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-23 | `GET /api/organizer/store` · `PATCH /api/organizer/store` body `{ "games"?: Game[], "contactPhone"?, "contactEmail"?, "contactWebsite"?, "contactLine"? }` (at least one key; games unique, at most 7) | `200 { displayName, games, contact }` | 400 · 401 · 403 · 415 |
| E-04, E-05, E-06, E-07, E-13 | *(changed)* `game` in bodies and shapes; `game` filter on E-04; `store` on summaries; `store.contact` on E-05 | — | — |

| AC | Given | When | Then |
|---|---|---|---|
| **AC-U-01** | Quantum Cards signed in | E-06 with `game: "POKEMON"`; E-06 with no `game`; E-06 with `game: "CHESS"`; E-13 `game: "MAGIC"`; UI: create an event without choosing a game | `201` with `game POKEMON`; `201` with `OTHER`; `400` on `game`; `200` and a `details` change row naming `game`; the form shows "Choose a game." and sends nothing |
| **AC-U-02** | events with different games | E-04 `game=POKEMON`, with `q`, and `game=chess`; UI: choose Pokémon TCG in the search bar | only Pokémon events; the AND of both filters; `400` on `game`; the URL holds `game=POKEMON`, a "Game: Pokémon TCG" chip is shown, and every card shows the Pokémon TCG chip |
| **AC-U-03** | Quantum Cards | E-23 `{ games: ["POKEMON","MAGIC"] }`, then `{ games: [] }`, `{ games: ["POKEMON","POKEMON"] }`, `{ games: ["X"] }`; E-23 by Mint and by a visitor | `200` and E-05 of a Quantum Cards event shows both games; `200` with none; `400` (duplicate); `400`; `403`; `401` |
| **AC-U-04** | Quantum Cards owns event A (its own `contact` empty) and event B (`contact` "Ask for Ken at the counter") | E-23 with phone `02 555 0101`, email ` Hello@QuantumCards.example `, website `https://quantumcards.example/events`, LINE `@quantumcards`; E-05 A and B as a visitor; then E-23 `{ contactLine: "" }`; UI: open A and B | `200`; the email is stored trimmed and lower-case; E-05 A and B carry the same `store.contact`; after clearing, `line` is `null`; A's page shows the phone as a `tel:` link, the email as a `mailto:` link and the website as "quantumcards.example"; B's page shows "Contact for this event: Ask for Ken at the counter" above them; the organizer's sign-in email appears in neither response |
| **AC-U-05** | Quantum Cards | E-23 with phone `abc`, email `hello@`, website `javascript:alert(1)`, website `ftp://store.example`, a 201-character website, LINE `my line id`, and `{}`; UI: the website link and a contact containing `<b>bold</b>` | `400` listing **every** failing field with the table's messages, and nothing stored; `{}` is `400` "Change at least one field."; the link has `target="_blank"` and `rel="noopener noreferrer nofollow"`; `<b>bold</b>` is shown as text (NFR-15) |

### 11.2 Feature-V — Store Logo and Event Banner (moved to Sprint 3)

By D-24, Feature-V is built in Sprint 3. Its full contract is in
[`../sprint-3/feature-contracts.md`](../sprint-3/feature-contracts.md) §6, with AC-V-01 … AC-V-07 and the
endpoints E-24 and E-25. In v0.1 and v0.2 of this document the draft was kept here. It was moved, not
rewritten, so its history stays in Git. Sprint 2 leaves room for it in two ways: S2-01's migration adds no media
columns, and the Sprint 2 UI shows store initials and the playmat pattern wherever the logo and banner will go.

### 11.3 What this changes in the other documents

| Document | Change |
|---|---|
| SRS v0.6 | FR-29 … FR-31, NFR-17, CH-11, D-24, D-25 |
| Features v0.4 | Feature-U (Sprint 2) and Feature-V (Sprint 3) |
| Plan | Sprint 2 gains U; Sprint 3 gains V |
| Traceability | the new rows |
| SDS | E-23 … E-25, the media exception to §6.1, the `MEDIA_*` variables |
| This contract | v0.2: Feature-U in §10 |
| STS | v0.2: TEST-U-01 … 03 |
| Seed | the games in §0.4 |
| Sprint 3 contracts | Feature-V's ACs, then TEST-V-* |

## 12. Feature-C — Deep Lagoon theme and type (D-38)

**Links:** NFR-08, NFR-10 (contrast part), FR-05, FR-27 · Re-verifies: AC-C-01 … 06, AC-SR5-01 · Depends on: Feature-C
(Sprint 1) · Issue S2-10 · Design: [`../../ui/design-direction.md`](../../ui/design-direction.md) v0.6 §2 ·
Prototype: the "Palette trials" and "Font trials" pages of the store-branding canvas

**Behaviour**
1. `client/src/theme/theme.css` takes the Deep Lagoon values of design-direction v0.6 §2. **Token names do not
   change**, so components keep working; only the values, the link colour (`--primary-hover`) and the font stacks
   change. A new token, `--font-figures`, is added.
2. `client/src/main.tsx` imports `@fontsource/inter` 400/600/700 and `@fontsource/manrope` 600/700/800 instead of
   `@fontsource/chakra-petch`. `@fontsource/ibm-plex-sans-thai` stays (400/600/700) for Thai letters. Fonts stay
   self-hosted: no request goes to an outside font server.
3. Elements whose main content is a figure use `--font-figures` with tabular digits: seat counts, the date badge,
   times in the facts row, fee chips and paging text. Sprint 3 adds the report, summary and standings numbers.
4. Seats and "registered" move from teal to green (`--accent #1F6F43`), because teal becomes the brand colour. The
   rule "one colour is reserved for seats" stays.
5. Screens, layout, copy and behaviour do not change.

**Rules:** every text colour pair in design-direction §2 must be ≥ 4.5:1 and every control border ≥ 3:1. A pair
that fails blocks the merge. Nothing in Sprint 1's AC-C-01 … 06 or AC-SR5-01 may regress.

**Permissions · API · Data:** *No change in these layers.*

| AC | Given | When | Then |
|---|---|---|---|
| **AC-C-07** | the built client | `theme.css` is read; the app is opened on `/events`, an event detail and My Events; the network log is read | every `:root` token equals the design-direction v0.6 §2 value; the computed `font-family` of body text starts with "Inter"; a seat count and the date badge compute to "Manrope" with `tabular-nums`; the Thai event title uses IBM Plex Sans Thai (`document.fonts` reports it loaded); no stylesheet or font is requested from `fonts.googleapis.com`; `@fontsource/chakra-petch` is no longer a dependency |
| **AC-C-08** | the token table and the running app with the seed | a contrast script checks every listed pair; an axe scan with the `color-contrast` rule runs on Find an Event, event detail (open and registered), sign-in, My Events, the dashboard, create and edit event, and the store profile; the Sprint 1 three-width check (TEST-SR5-01) runs again | every text pair ≥ 4.5:1 and every control border ≥ 3:1; **0** `color-contrast` violations; 21 / 21 Sprint 1 width checks still pass; the PLAYER badge, seat chip and REGISTERED button are green, and the primary button and date badge are teal |

**Planned tests:** TEST-C-07, TEST-C-08 (U, E2E).

## 13. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 21 Nov 2026 | First draft: SR-08, Feature-K, L, M, N, O, J; shared shape changes, viewer action and openness rule, seed EV-7 … EV-9, error codes, decisions D-16 … D-23 proposed, 37 ACs, re-verification table, JRN-03 and JRN-04; AC-SR1-02 revised to 9 seeded events. §11: proposed scope change CH-11 (game per event, store logo, event banner with GCS upload), Feature-U and Feature-V with 9 proposed ACs, not yet approved | Team (AI-assisted) |
| v0.2 | 21 Nov 2026 | D-24: Feature-U moves into Sprint 2 (Issue S2-09; UI, permissions and E-23 added; AC-U-01 and AC-U-02 gain UI checks; §10 total 37 → 40); Feature-V is allocated to Sprint 3. D-25 game default. Seed games in §0.4 | Team (AI-assisted) |
| v0.3 | 21 Nov 2026 | §11.2 Feature-V moved to the Sprint 3 contracts (§6 there, with AC-V-07 added); endpoint numbers E-23 (store profile), E-24 (logo), E-25 (banner) match SDS v0.10; inputs SRS v0.6 and features v0.4; §0.6 decisions recorded in SRS §10.1 | Team (AI-assisted) |
| v0.4 | 21 Nov 2026 | D-37: store contact details (phone, email, website, LINE) on the Feature-U store profile, shown on every event, with the event's own `contact` kept as "Contact for this event"; validation table; AC-U-04, AC-U-05; seed contacts; §10 total 40 → 42 | Team (AI-assisted) |
| v0.5 | 21 Nov 2026 | D-38: §12 Feature-C Deep Lagoon theme and type (Inter text, Manrope figures, Thai fallback), AC-C-07 and AC-C-08; re-verification row; version history becomes §13; 44 ACs | Team (AI-assisted) |
| v0.6 | 25 Nov 2026 | Lab 7 change CH-13 (Issue #77): D-21, E-14 check order and the E-13 time rule use the 60-minute lead time (only when the body sets `startAt`); AC-K-04 and AC-L-04 gain the boundary cases | Team (AI-assisted) |
| v0.7 | 25 Nov 2026 | S2-02 (team decision 25 Nov): SAVE DRAFT lands on the draft's own page, which shows the owner's banner and PUBLISH EVENT, because the edit page is built in S2-04; the dashboard **Edit** button moves to S2-04 too (Behaviour 2, UI, AC-K-01). §8: TEST-G-04's draft case changes to 404, which the Feature-G row had missed | Team (AI-assisted) |
| v0.8 | 26 Nov 2026 | S2-03 (review of PR #94): D-39 records the `include=cancelled` rule (cancelled events that have not started; `past` adds started ones), `seatsAvailable=false` and the literal `%` and `_` in `q`; AC-J-04 expected sets say so | Team (AI-assisted) |
| v0.9 | 26 Nov 2026 | S2-04: a new draft now lands on its edit page, which has the draft banner and PUBLISH EVENT; the dashboard gets **Edit** (Feature-K Behaviour 2, UI, AC-K-01); Feature-L Behaviour 3 notes that the Cancel event section comes with S2-05, and Behaviour 4 the 409 `details`; AC-L-04's 60-minute case sends its own end, because the resulting-end rule refuses a 51-hour event | Team (AI-assisted) |
| #110 | 26 Nov 2026 | D-39 was used twice: the SRS's D-39 is CH-13 (Lab 7), so the `include=cancelled` decision of S2-03 becomes **D-40** (§0.6, AC-J-04) and is added to SRS §10.1. Nothing else changes | Team (AI-assisted) |
| S2-06 | 26 Nov 2026 | §4: TEST-M-04 runs with Feature-N in S2-07, because `canCancel` and E-16 are built there (decision 26 Nov). §1 (review of #111): a `deadline` row is written only for an explicit, different deadline; a deadline sent again unchanged is not checked again | Team (AI-assisted) |
