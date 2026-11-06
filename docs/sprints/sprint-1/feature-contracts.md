# Sprint 1 Feature Engineering Contracts

Project: **TCG Event Hub** · Sprint 1 (4–8 Nov 2026) · Document version: v1.8 (v1.0 reviewed in PR 2; changes in §15)
Inputs: [`../../srs.md`](../../srs.md) v0.5 · [`../../features.md`](../../features.md) v0.2 ·
[`../../traceability.md`](../../traceability.md) v0.2 · [`../../system-sds.md`](../../system-sds.md) v0.2 ·
[`../plan.md`](../plan.md) v0.1 · [`../../ui/design-direction.md`](../../ui/design-direction.md) v0.2 ·
Tests: [`sts.md`](sts.md) · Issues and Definition of Done: [`README.md`](README.md)

This is step 6 of the course design process: one **engineering contract** per Sprint 1 feature, written and
reviewed **before** any implementation. Each contract gives the feature-level design, the UI/API/data
specification (or says that a layer does not change), and the acceptance criteria. The Software Test
Specification ([`sts.md`](sts.md)) then turns every AC into planned tests, and the tests are written first (TDD,
README §3).

The contracts inherit everything in the System-Level SDS: check order (SDS §2.3), error shape and codes (§6.1,
§6.2), permission matrix (§7), session design (§8). They repeat it only where a feature needs a precise value.
Acceptance criteria keep the IDs planned in the traceability matrix (`AC-<feature>-nn`), and each has a test with
the same number in the STS (`TEST-<feature>-nn`).

---

## 0. Shared definitions for all Sprint 1 contracts

### 0.1 Resource shapes

All times are ISO 8601 UTC strings. All counts are integers. Optional text that is empty after trimming is `null`.

```jsonc
// AuthUser — the signed-in user (never contains passwordHash)
{ "id": 7, "displayName": "Mint", "email": "mint@player.example", "role": "PARTICIPANT" }

// EventSummary — one card in a list
{
  "id": 12, "title": "Friday Night Constructed", "type": "CASUAL", "format": "CONSTRUCTED",
  "venueName": "Quantum Cards", "city": "Bangkok",
  "startAt": "2026-11-05T10:00:00.000Z", "endAt": "2026-11-05T14:00:00.000Z",
  "feeLabel": "THB 250", "capacity": 24, "registeredCount": 3, "seatsRemaining": 21, "status": "PUBLISHED"
}

// EventDetail — EventSummary plus the full public fields and the viewer's action
{
  "...EventSummary fields": "…",
  "venueAddress": "1631 Kanchanaphisek Rd, Bang Khae, Bangkok 10160",
  "structureNote": "4 rounds · Best of 1", "contact": "hello@quantumcards.example",
  "description": "Bring a legal constructed deck…",
  "organizer": { "displayName": "Quantum Cards" },
  "hasStarted": false,
  "viewer": { "action": "REGISTER", "registrationId": null }
}

// ParticipantRegistration — a participant's own registration
{ "id": 31, "status": "REGISTERED", "createdAt": "2026-11-04T12:00:00.000Z", "event": { "...EventSummary": "…" } }

// OrganizerRegistrationRow — one line in the owner's registration list (display name only, D-14)
{ "id": 31, "participant": { "displayName": "Mint" }, "status": "REGISTERED", "createdAt": "2026-11-04T12:00:00.000Z" }
```

`registeredCount` = active registrations (`REGISTERED` or `CHECKED_IN`); `seatsRemaining` = `capacity −
registeredCount`. Both are computed by the server on every read.

### 0.2 The viewer action (`viewer.action`), decided by the server

| Condition, checked top to bottom | `action` | Button (design-direction §4.4) |
|---|---|---|
| Viewer is the event's owner | `MANAGE` | MANAGE EVENT |
| Viewer is any other organizer | `ORGANIZER_CANNOT_REGISTER` | no button, note |
| Viewer is a participant with an active registration | `REGISTERED` (+ `registrationId`) | ✓ REGISTERED |
| Event has started or is not `PUBLISHED` | `CLOSED` | REGISTRATION CLOSED |
| `seatsRemaining = 0` | `FULL` | FULL |
| Viewer is signed out | `SIGN_IN_TO_REGISTER` | SIGN IN TO REGISTER |
| Otherwise (participant, open, seats left) | `REGISTER` | REGISTER |

### 0.3 Seed data used by the contracts (SR-01)

Seed times are **relative to the moment the seed runs**, so upcoming events stay upcoming. "S" = seed run time.

| Key | Account / event | Details |
|---|---|---|
| U-O1 | Organizer **Quantum Cards** | `quantum@organizer.example` |
| U-O2 | Organizer **Dragon's Den** | `dragon@organizer.example` |
| U-P1 … U-P3 | Participants **Mint, Ploy, Boss** | `mint@ / ploy@ / boss@player.example` |
| U-P4 | Participant **Nok** (no registrations) | `nok@player.example`, for empty states |
| EV-1 | Friday Night Constructed, U-O1 | S + 2 days, capacity 24, registered: Mint, Ploy, Boss (3) |
| EV-2 | Last Seat Sealed, U-O1 | S + 3 days, capacity 4, registered: Mint, Ploy, Boss (1 seat left) |
| EV-3 | Store Championship Qualifier, U-O2 | S + 4 days, capacity 2, registered: Ploy, Boss (**full**) |
| EV-4 | Live Now Casual, U-O2 | started S − 1 h, ends S + 3 h, capacity 8, registered: Mint (**started**) |
| EV-5 | Dragon Draft Night, U-O2 | S + 5 days, capacity 16, no registrations |
| EV-6 | Release Weekend Sealed · เปิดกล่องสุดสัปดาห์, U-O1 | S + 7 days, capacity 32, no registrations (Thai title) |

All seeded accounts use the password in the `SEED_PASSWORD` environment variable (SDS §4.5). No password is
written in this document or in Git.

### 0.4 Contract template

Each feature section below has the same parts: **Links** · **Behaviour** · **Rules, validation, boundaries** ·
**Permissions** · **UI** · **API** · **Data** · **Acceptance criteria** · **Planned tests**. A part that does not
apply says *No change in this layer*.

---

## 1. SR-01 — Persistence, migrations and seed data

**Links:** NFR-06; backs BR-01, BR-02, BR-05, BR-06 · Depends on: — · Issue I-01

**Behaviour**
1. `server/prisma/schema.prisma` defines `User`, `Session`, `Event`, `Registration` and the enums `Role`,
   `EventType`, `EventFormat`, `EventStatus`, `RegistrationStatus` exactly as SDS §4.1 (Sprint 1 fields only).
2. Migration `0001_init` creates the tables (generated by Prisma). Migration `0002_rule_constraints` then adds in
   raw SQL: `event_capacity_range`, `event_time_window` and the partial unique index `registration_one_active`
   (SDS §4.3). They are separate so the history shows the rules arriving after their failing tests (v1.1).
3. `npm --prefix server run db:seed` upserts the accounts and events in §0.3. Users are matched by email and events
   by a fixed `seedKey` (a nullable unique column used only by the seed), so a second run changes nothing.
4. `npm --prefix server run db:migrate:test` applies new migrations to `DATABASE_URL_TEST` and never deletes data.
   `db:reset:test` drops and rebuilds the test database; it is for people, not AI agents (Prisma blocks agents
   from running it without explicit consent). Both refuse to run if `DATABASE_URL_TEST` is missing or equals
   `DATABASE_URL`. Integration tests truncate all tables (`RESTART IDENTITY CASCADE`) before each test file.

**Rules and boundaries:** the seed refuses to run if `SEED_PASSWORD` is missing or shorter than 12 characters. It
never deletes rows it did not create.

**Permissions · UI · API:** *No change in these layers.*

**Data:** as above. `Event.seedKey varchar(40) unique null` is the only field not in SDS §4.1. It is added here
and recorded in SDS v0.2.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-SR1-01** | an event and a registration saved through the API | they are read back through a **new** Prisma client, and again after the server process restarts | both are returned with identical field values |
| **AC-SR1-02** | an empty database | the seed runs twice | there are exactly 6 users (2 organizers, 4 participants) and 6 events, with the registrations in §0.3, and no duplicates |

**Planned tests:** TEST-SR1-01 (I, M), TEST-SR1-02 (I), plus the constraint tests TEST-SR1-03 … 05 (I) that
support BR-01, BR-02 and BR-06 at database level.

---

## 2. SR-02 — API conventions, input validation and safe errors

**Links:** NFR-07, NFR-15, NFR-02 (check order), FR-16 (reasons) · Depends on: — · Issue I-02

**Behaviour**
1. `sendError(res, code, details?)` is the only way to send an error. The code fixes the status (SDS §6.2), and the
   body is always `{ "error": { "code", "message", "details?" } }`.
2. `validate(schema)` middleware parses `req.body`, `req.query` or `req.params` with a zod `.strict()` schema.
   Failure returns `400 VALIDATION_FAILED` with `details: [{ "field", "message" }]` for **every** failing field.
3. Requests with a body must be `application/json`, else `415 UNSUPPORTED_MEDIA_TYPE`. Bodies over 100 kB give
   `413 PAYLOAD_TOO_LARGE` (added to SDS §6.2 in SDS v0.4). A `POST` with no body (E-09) is not a 415.
4. `requireOrigin` (on POST/PATCH/DELETE, after `requireAuth`, SDS §6.1): `Origin` must equal `APP_ORIGIN`, else
   `403 FORBIDDEN`. Sign-in (E-01) runs it too.
5. Unknown routes under `/api` → `404 NOT_FOUND`. A `GET` route never writes.
6. The final error handler logs the real error (without the body, cookies or headers) and answers
   `500 INTERNAL_ERROR` "Something went wrong. Please try again."

**Permissions · UI · Data:** *No change in these layers.* The UI-side display of errors is Feature-C.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-SR2-01** | requests that cause 400, 401, 403, 404, 409 and a forced 500 | each response is read | every body matches `{error:{code,message,details?}}`; no response contains a stack trace, SQL text, file path or another user's data |
| **AC-SR2-02** | a valid organizer session | `POST /api/events` is sent with `capacity: "ten"`, `title: 7`, `startAt: "tomorrow"` and an extra field `organizerId: 99` | `400 VALIDATION_FAILED` with one `details` entry for each of the four fields; nothing stored |
| **AC-SR2-03** | the full Sprint 1 route table | every route is called with `GET` and the database is compared before and after | no `GET` changes any row; `GET` on a POST-only path answers `404 NOT_FOUND` |

**Planned tests:** TEST-SR2-01 … 03 (I), TEST-SR2-04 (U, error mapper), TEST-SR2-05 (I, 415 / 413 / origin).

**How I-02 proves SR-02 before the endpoints exist (v1.2).** E-06 and E-09 are built in I-07 and I-08, so in I-02
the tests drive the real shared pipeline through **probe routes** that exist only in the tests (mounted with
`createApp({ extraRoutes })`, never in the production app): `POST /api/__test/echo` (origin check + a `.strict()`
schema with the E-06 field names `title`, `capacity`, `startAt`), `GET /api/__test/error/:code` (sends a catalogue
error, for the 401 and 409 shapes) and `GET /api/__test/boom` (the forced 500). The Issues that add the real
endpoints add their cases to the same tests: I-04 adds the participant and organizer sessions to TEST-SR2-03;
I-07 adds the real E-06 case to TEST-SR2-02; I-08 adds the E-09 cases to TEST-SR2-05; I-12 adds real 401 and 409
cases to TEST-SR2-01 and checks that TEST-SR2-03's route table lists all twelve Sprint 1 routes.

---

## 3. SR-03 — Time handling

**Links:** NFR-11; time boundaries of BR-02 and BR-04 · Depends on: — · Issue I-02

**Behaviour**
1. `server/src/clock.ts` exports `now(): Date`. In `NODE_ENV=test`, `setNow(date)` and `resetNow()` fix it. All
   rule code calls `now()`, never `new Date()` or `Date.now()` (enforced by a source check in TEST-SR3-01 over `server/src/domain/`).
2. Times are stored as `timestamptz` and returned as UTC ISO strings.
3. The client formats every time with `formatEventTime(iso)` (Asia/Bangkok, `en-GB`), for example
   `Thu 5 Nov 2026 · 17:00`.
4. "Upcoming" = `startAt > now()`. "Started" = `startAt ≤ now()`, so a start exactly at `now()` counts as started.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-SR3-01** | the clock fixed at T and events starting at T + 1 min, T, and T − 1 min | the event list is read and registration is attempted on each | only the T + 1 min event is listed and accepts registration; the T and T − 1 min events are absent from the list and reject with `409 REGISTRATION_CLOSED`. API times end in `Z`; the client shows `2026-11-05T10:00:00Z` as `Thu 5 Nov 2026 · 17:00` on a machine set to any time zone |

**Planned tests:** TEST-SR3-01 (I, boundaries), TEST-SR3-02 (U, client formatter in two machine time zones).

**Split of TEST-SR3-01 (v1.2).** I-02 proves the rule itself: `domain/time.ts` (`hasStarted`, `upcomingWhere`)
against real PostgreSQL rows at T + 1 min, T and T − 1 min with the clock fixed at T, plus the UTC `Z` round trip.
I-05 adds the E-04 list case and I-08 the E-09 `409 REGISTRATION_CLOSED` case, both through these same helpers.

---

## 4. Feature-A — User Authentication and Session

**Links:** FR-01, FR-02, FR-03, FR-04; NFR-01, NFR-03, NFR-04 · Depends on: SR-01, SR-02 · Issue I-04 ·
Diagram: D2 ([`../../diagrams/seq-auth.png`](../../diagrams/seq-auth.png))

**Behaviour**
1. **Sign in** `POST /api/auth/login {email, password}`: normalise the email (trim, lower-case), find the user, and
   verify the password with scrypt (`password.ts` from TokTickIT). An unknown email is verified against a dummy hash.
2. On success, create a session (SDS §8): 32 random bytes → base64url token; store `SHA-256(token)` with
   `expiresAt = now() + 8 h`; delete that user's expired sessions; set the cookie
   `tcg.sid=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` (+ `Secure` in production). Respond `200` with
   `AuthUser`.
3. **Who am I** `GET /api/auth/me` returns `AuthUser` for a valid session, else 401.
4. **Sign out** `POST /api/auth/logout` deletes the session row and sends an expired cookie, then responds `204`.

**Rules, validation, boundaries**

| Field | Rule | Error |
|---|---|---|
| `email` | string, 3–254 chars after trim, contains `@` | 400 `VALIDATION_FAILED` "Enter your email address." |
| `password` | string, 1–128 chars, **not trimmed** | 400 "Enter your password." |
| other keys | forbidden (`.strict()`) | 400 "This value cannot be set." |

- Unknown email and wrong password both answer `401 INVALID_CREDENTIALS` "Email or password is incorrect." The
  response time differs by less than 50 ms on average over 20 tries (dummy hash).
- A cookie value that is not 43 base64url characters is treated as signed out, without a database lookup.
- The session expires **8 h after sign-in** (absolute). The test at 7 h 59 min passes; at 8 h 00 min it gets 401.

**Permissions:** E-01 is public. E-02 and E-03 need a session (401 otherwise).

**UI** (`/login`, design-direction §4.2)
- Email and password fields with visible labels; **SIGN IN** button disabled with a spinner while sending.
- On 401: the alert "Email or password is incorrect." Fields keep their values, except the password, which is
  cleared. Focus returns to the password field.
- On success: go to `returnTo` if it is an internal path (starts with `/`, not `//`); otherwise `/events` for a
  participant or `/organizer` for an organizer (FR-26, Feature-C).
- Sign out is in the header menu (Feature-C). After it: go to `/events` with "You are signed out."

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-01 | `POST /api/auth/login` body `{ "email", "password" }` | `200` `AuthUser`, `Set-Cookie` | 400 `VALIDATION_FAILED` · 401 `INVALID_CREDENTIALS` · 403 `FORBIDDEN` (bad Origin) · 415 |
| E-02 | `POST /api/auth/logout` (no body) | `204`, expired `Set-Cookie` | 401 `UNAUTHENTICATED` · 403 (bad Origin) |
| E-03 | `GET /api/auth/me` | `200` `AuthUser` | 401 `UNAUTHENTICATED` |

**Data:** uses `User` and `Session` from SR-01. *No new fields.*

| AC | Given | When | Then |
|---|---|---|---|
| **AC-A-01** | seeded participant Mint | E-01 with the right email (in mixed case and with spaces) and password | `200` with `{id, displayName:"Mint", email:"mint@player.example", role:"PARTICIPANT"}`; a `tcg.sid` cookie; E-03 with that cookie returns the same user; one `Session` row exists whose id is **not** the cookie value |
| **AC-A-02** | the seeded users | E-01 with a wrong password, and separately with an unknown email | both `401 INVALID_CREDENTIALS` with the identical message; no `Session` row and no cookie created |
| **AC-A-03** | a valid session and no session | E-03 is called with each | `200 AuthUser` with the session; `401 UNAUTHENTICATED` without one, or with a malformed or unknown cookie |
| **AC-A-04** | a signed-in participant | E-02, then the **old** cookie is sent to E-03, E-09 and E-10 | E-02 `204` and the session row is gone; every later call `401 UNAUTHENTICATED`; in the UI, pressing Back after sign-out shows no private data |
| **AC-A-05** | the seeded database | `passwordHash` is read for every user, and all Sprint 1 responses are scanned | every hash matches `^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$`; no response body contains `password`, `passwordHash` or the seed password |
| **AC-A-06** | a successful sign-in at fixed time T | the cookie is read, then E-03 is called at T + 7 h 59 min and at T + 8 h | cookie has `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28800`; first call `200`, second `401` |

**Planned tests:** TEST-A-01 … 06 (U, I, E). See STS §3.1.

**How I-04 proves Feature-A before E-09 and E-10 exist (v1.3).** AC-A-04 sends the old cookie to E-09 and E-10,
which arrive in I-08 and I-10. In I-04 the old cookie goes to E-03, E-02 and a test-only `GET /api/__test/protected`
that runs the real `requireAuth` (mounted with `createApp({ extraRoutes })`, never in the production app); I-08 and
I-10 add their E-09 and E-10 rows to TEST-A-04. The E2E half of TEST-A-04 (sign out, press Back) moves to I-12 with
the other Playwright journeys; in I-04 the Back case is covered by the route guards (TEST-C-02, `AppRoutes`) and was
checked by hand in the browser. AC-A-05's scan checks that no response has a `password` or `passwordHash` **key**,
a scrypt hash or the seed password: the 400 for a bad password legitimately names the field `password`.

---

## 5. Feature-B — Role and Ownership Access Control

**Links:** BR-10 (role part), BR-13, BR-14, BR-16, BR-17; NFR-01, NFR-02 · Depends on: Feature-A · Issue I-06

**Behaviour**
1. `loadSession` (every request) sets `req.actor = { id, role, displayName }` or `undefined`.
2. `requireAuth` → 401 if no actor. `requireRole('ORGANIZER' | 'PARTICIPANT')` → 403 if the role differs.
3. Domain services receive `actor` as their first argument, never `req` (SD-10). Every query for owned data puts the
   owner in the `where` clause (`organizerId: actor.id`, `participantId: actor.id`). A miss is `404`, not `403`,
   so another user's record is never confirmed to exist (D-08).
4. Request schemas for create/register operations are `.strict()`, so `userId`, `role`, `organizerId`,
   `participantId` and `ownerId` in a body are rejected with 400 (AC-SR2-02), never used.

**Permissions:** the Sprint 1 slice of SDS §7.1 (endpoints E-01 … E-12) is the binding matrix for this feature.

**UI:** route guards are Feature-C. **Data:** *No change.*

| AC | Given | When | Then |
|---|---|---|---|
| **AC-B-01** | a signed-in participant Mint and organizer Quantum Cards | Mint registers with body `{}` and the database is read; Quantum Cards creates an event and the database is read; then both are sent again with `participantId` / `organizerId` of another user in the body | the registration's `participantId` is Mint's id; the event's `organizerId` is Quantum Cards' id; the requests carrying another user's id are rejected `400` and store nothing |
| **AC-B-02** | no session | every protected Sprint 1 endpoint (E-02, E-03, E-06 … E-11) is called | each answers `401 UNAUTHENTICATED`, and the body has only the `error` object |
| **AC-B-03** | one session each for Visitor, Mint (participant), Quantum Cards (owner of EV-1, EV-2, EV-6), Dragon's Den (other organizer) | every cell of the Sprint 1 permission matrix (SDS §7.1, E-01 … E-11) is exercised, including one request that fails role **and** ownership | every cell returns the status in the matrix; a request that is both wrong role and not owner returns 403 (role is checked first); a 404 body is identical whether the record exists or not |

**Planned tests:** TEST-B-01 … 03 (I). TEST-B-03 is a table-driven test with one row per matrix cell.

**How I-06 proves Feature-B before E-06 … E-11 exist (v1.5).** I-06 builds the shared pieces: `requireAuth` and
`requireRole` in `http/guards.ts`, and the owner-in-where helpers `ownedEventWhere` / `ownRegistrationWhere` in
`domain/actor.ts`. E-06 … E-11 arrive in I-07 … I-11, so their matrix cells run against test-only probes
(`accessProbes`, mounted with `createApp({ extraRoutes })`, never in the production app) that use the same guard
order (`requireAuth` → `requireRole` → origin → validation → ownership) and the same helpers. Each of those Issues
replaces its rows' probe path with the real endpoint in TEST-B-01 … 03 and adds the "stored id = caller" half of
AC-B-01 (I-07: E-06, I-08: E-09). I-12 checks that no probe path is left.

---

## 6. Feature-C — Application Shell and Role Navigation

**Links:** FR-05, FR-26, FR-27; NFR-08, NFR-09, NFR-15 · Depends on: Feature-A, Feature-B · Issue I-03 (shell)
and I-04 (sign-in wiring)

**Behaviour**
1. `AuthProvider` calls E-03 on load and keeps `{status: 'loading' | 'signedOut' | 'signedIn', user}`.
2. The header (design-direction §4.1) shows **Sign in** when signed out. Signed in, it shows the display name, a role
   badge (`PLAYER` / `ORGANIZER`) and a menu with **Sign out**. The links depend on the role:

   | Role | Links |
   |---|---|
   | Visitor | Events |
   | Participant | Events · My Events |
   | Organizer | Events · Dashboard · + Create event |

3. Route guards: a protected route opened while signed out → `/login?returnTo=<path>`. A wrong-role route → the
   **Not available** page. An unknown route → the **Not found** page.
4. The `api` module turns error bodies into `ApiError {status, code, message, details}`. Any 401 from a protected
   call clears the user and redirects to sign-in with `returnTo`.
5. Shared states: `<Loading>` skeletons, `<EmptyState title action>`, `<ErrorState message onRetry>`, and form field
   errors from `details[]`. Submit buttons are disabled with `aria-busy` while saving.
6. All user text is rendered as React text. `dangerouslySetInnerHTML` fails lint.

**API · Data:** *No change in these layers* (uses E-01 … E-03).

**UI:** as above, in the Arcane Ink theme: Chakra Petch and IBM Plex Sans Thai, drawn icon set, focus ring,
`--accent-ink` for teal text.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-C-01** | the app signed out, as Mint, and as Quantum Cards | the header is rendered | links exactly as the table in Behaviour 2 for each role |
| **AC-C-02** | signed out; then signed in as Mint | `/me/registrations` is opened signed out; `/organizer` is opened as Mint | the first goes to `/login?returnTo=%2Fme%2Fregistrations`; the second shows "This page isn't available for your account" and calls no organizer endpoint |
| **AC-C-03** | signed out on the EV-1 detail page | **SIGN IN TO REGISTER** is clicked and Mint signs in | the browser returns to EV-1's detail page, whose button now reads **REGISTER**; a `returnTo` of `https://evil.example` or `//evil.example` goes to `/events` instead |
| **AC-C-04** | signed out, then signed in as Mint | the header is read | signed out: a **Sign in** link; signed in: "Mint", badge `PLAYER`, and a menu containing **Sign out**, which signs out (E-02) and shows "You are signed out." |
| **AC-C-05** | the event list, My Events, dashboard and registration list with a slow, an empty and a failing API; the create-event form with a 400 response | each screen is rendered | a loading state appears first; the empty state has its named next action; the error state shows the server message and **Try again**, which retries; form errors appear under the matching fields and the submit button is disabled while sending |
| **AC-C-06** | EV-1 with the description `<script>alert(1)</script><b>bold</b>` | the detail page is rendered | the text appears literally, no script runs, and no `<b>` element is created |

**Planned tests:** TEST-C-01 … 06 (E: component and Playwright).

---

## 7. Feature-D — Event Creation and Publication

**Links:** FR-06; BR-01, BR-02, BR-03, BR-13; NFR-07, NFR-11 · Depends on: Feature-B, SR-01, SR-03 · Issue I-07

**Behaviour**
1. An organizer opens `/organizer/events/new`, fills in the form and presses **PUBLISH EVENT**.
2. `POST /api/events` validates the shape (zod), then the time rules (domain). It saves the event with
   `status = PUBLISHED`, `publishedAt = now()`, `organizerId = actor.id` (D-06, BR-17) and responds `201` with
   `EventDetail` (viewer action `MANAGE`).
3. The UI goes to the new event's detail page with the toast "Your event is live."

**Rules, validation, boundaries** (all reported together)

| Field | Type | Required | Rule (after trimming) | Error message |
|---|---|---|---|---|
| `title` | string | yes | 3–100 chars | "Use 3 to 100 characters for the title." |
| `type` | enum | yes | `CASUAL` · `TOURNAMENT` · `RELEASE` | "Choose an event type." |
| `format` | enum | yes | `CONSTRUCTED` · `SEALED` · `DRAFT` | "Choose a format." |
| `venueName` | string | yes | 1–80 | "Enter the venue name." |
| `venueAddress` | string | yes | 1–200 | "Enter the venue address." |
| `city` | string | yes | 1–60 | "Enter the city." |
| `startAt`, `endAt` | string | yes | ISO 8601 **with offset** | "Enter a start date and time." / "Enter an end date and time." |
| `capacity` | integer | yes | 1–256, whole number (BR-01) | "Capacity must be a whole number from 1 to 256." |
| `feeLabel` | string | no | 0–40 | "Use up to 40 characters." |
| `structureNote` | string | no | 0–80 | "Use up to 80 characters." |
| `contact` | string | no | 0–120 | "Use up to 120 characters." |
| `description` | string | no | 0–2000 | "Use up to 2,000 characters." |
| any other key | — | forbidden | includes `organizerId`, `status`, `publishedAt` | "This value cannot be set." |

Time rules (BR-02), checked after the shape passes, answer `422 EVENT_TIME_INVALID` with details:
- `startAt ≤ now()` → `startAt`: "The start must be in the future."
- `endAt ≤ startAt` → `endAt`: "The end must be after the start."
- `endAt > startAt + 24 h` → `endAt`: "An event can last at most 24 hours."
- Boundaries: `endAt = startAt + 24 h` is accepted; `+ 24 h + 1 min` is rejected.

**Permissions:** organizer only (participant 403, visitor 401). Any organizer may create, and becomes the owner.

**UI** (`/organizer/events/new`)
- Fields in this order: title · type and format (radio cards) · venue name, address, city · start and end date-time
  (shown and entered in Bangkok time, sent with `+07:00`) · capacity (number, 1–256) · fee label · structure note ·
  contact · description (character counter).
- Client checks mirror the table, for speed only. Server errors map to the same fields.
- **PUBLISH EVENT** shows "Publishing…" while sending. On error, the input is kept.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-06 | `POST /api/events` body as the table | `201` `EventDetail` | 400 · 401 · 403 (role or Origin) · 415 · 422 `EVENT_TIME_INVALID` |

**Data:** `Event` from SR-01. *No new fields.*

| AC | Given | When | Then |
|---|---|---|---|
| **AC-D-01** | Quantum Cards signed in; clock fixed | a valid event starting tomorrow with capacity 24 is posted | `201`; the stored row has `status PUBLISHED`, `organizerId` = Quantum Cards, `publishedAt` = now; E-04 now lists it with `registeredCount 0, seatsRemaining 24`; the UI lands on its detail page with "Your event is live." |
| **AC-D-02** | Quantum Cards signed in | capacity is sent as 0, −1, 1.5, 257, `"24"` and `null`, then as 1 and 256 | the first six give `400` on `capacity` with "Capacity must be a whole number from 1 to 256." and store nothing; 1 and 256 give `201` |
| **AC-D-03** | Quantum Cards signed in; clock fixed at T | start = T, start = T − 1 min, end = start, end = start + 24 h 1 min, and end = start + 24 h | the first four give `422 EVENT_TIME_INVALID` naming the right field and store nothing; the last gives `201` |
| **AC-D-04** | Quantum Cards signed in | a body with no title, a 2-char title, a 101-char title, a 2,001-char description, and all required fields missing | `400` with a `details` entry for **every** failing field in one response; whitespace-only text counts as missing; nothing stored |
| **AC-D-05** | Mint signed in; then no session | E-06 with a valid body | Mint: `403 FORBIDDEN`; signed out: `401 UNAUTHENTICATED`; no event stored in either case |

**Planned tests:** TEST-D-01 … 05 (U, I, C, E). Playwright E2E spec for TEST-D-01 is deferred to I-12 (contracts v1.7).

---

## 8. Feature-E — Organizer Event Dashboard

**Links:** FR-07; BR-14; NFR-02 · Depends on: Feature-D · Issue I-09

**Behaviour:** `/organizer` lists the signed-in organizer's own events, earliest start first (all of them: upcoming
and started). Each row shows title, date and time, status, `registeredCount / capacity`, seats left, and the links
**Registrations** (Feature-I) and **View** (event detail). It is empty for a new organizer: "Create your first
event" plus a **+ Create event** button.

**Permissions:** organizer only; the query is `where organizerId = actor.id`.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-07 | `GET /api/organizer/events` | `200 { "items": EventSummary[] }`, sorted `startAt` asc, then `id` asc | 401 · 403 |

**Data:** *No change.*

| AC | Given | When | Then |
|---|---|---|---|
| **AC-E-01** | Quantum Cards owns EV-1, EV-2, EV-6 | E-07 is called and `/organizer` is rendered | exactly those three, in start order, each with `registeredCount` and `seatsRemaining` equal to an independent count of active registrations in the database |
| **AC-E-02** | Dragon's Den owns EV-3, EV-4, EV-5 | each organizer calls E-07 | no response contains an event owned by the other organizer; a participant gets `403` |

**Planned tests:** TEST-E-01, 02 (I, E).

---

## 9. Feature-F — Event Discovery List and Detail

**Links:** FR-11, FR-12; BR-04, BR-16; NFR-08, NFR-11 · Depends on: SR-01, SR-03 · Issue I-05

**Behaviour**
1. `/events` (public) shows upcoming published events as cards (design-direction §5.1), earliest first. The search
   bar is shown but **inactive**, with the note "Search and filters arrive in Sprint 2."
2. `/events/:id` (public) shows the detail page (design-direction §5.2) with the button chosen by `viewer.action`
   (§0.2). Started events can still be opened by link: the list hides them, the detail shows **REGISTRATION CLOSED**.
3. The seats chip is teal; amber when `seatsRemaining ≤ 20 %` of capacity (rounded down, minimum 1); red **FULL**
   at 0.
4. Known limitations in I-05: **MANAGE** links to `/organizer/events/:id/registrations` (unimplemented until I-11);
   **REGISTER** renders without `onRegister` handler until registration flow in I-08; Playwright E2E spec is deferred
   to I-12 (following PR #18 pattern).

**Rules:** list = `status = PUBLISHED AND startAt > now()`. Detail = any `PUBLISHED` event (Sprint 1 has no other
status). A missing id → 404. A non-numeric id → 400. Responses never include registrations, participant names or
emails (BR-16).

**Permissions:** public. A session is read only to set `viewer.action`.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-04 | `GET /api/events` | `200 { "items": EventSummary[] }`, `startAt` asc, `id` asc | — |
| E-05 | `GET /api/events/:id` | `200 EventDetail` | 400 `INVALID_PATH_PARAMETER` · 404 `EVENT_NOT_FOUND` |

**Data:** *No change.* Index `(status, startAt)` from SR-01 serves E-04.

| AC | Given | When | Then |
|---|---|---|---|
| **AC-F-01** | the seed; signed out | E-04 is called and `/events` is rendered | EV-1, EV-2, EV-3, EV-5, EV-6 in start order (EV-4 has started); each card shows weekday · time, title, type · format, venue · city, fee chip and `registeredCount / capacity` (EV-3 shows **FULL 2 / 2**); the same list is returned with a session |
| **AC-F-02** | EV-1 | E-05 is called as visitor, as Nok, as Mint (registered), as Dragon's Den, as Quantum Cards (owner), and EV-3 as Nok | `viewer.action` = `SIGN_IN_TO_REGISTER`, `REGISTER`, `REGISTERED` (with Mint's `registrationId`), `ORGANIZER_CANNOT_REGISTER`, `MANAGE`, and `FULL`; all public fields are present and the page shows the matching button |
| **AC-F-03** | no event with id 999999 | E-05 `/999999` and `/abc` are called, and `/events/999999` is opened | `404 EVENT_NOT_FOUND`, `400 INVALID_PATH_PARAMETER`, and the "Not found" page |
| **AC-F-04** | EV-4 has started | E-04, E-05 for EV-4 (as Nok), and the EV-4 page | EV-4 is absent from E-04; E-05 returns it with `hasStarted: true` and `viewer.action CLOSED`; the page shows a disabled **REGISTRATION CLOSED** |
| **AC-F-05** | registrations exist on EV-1 | E-04 and E-05 are called as visitor and as Nok, and each response is searched | no response contains a participant id, display name or email, or the key `registrations` |

**Planned tests:** TEST-F-01 … 05 (I, E).

---

## 10. Feature-G — Event Registration

**Links:** FR-15, FR-16; BR-04, BR-05, BR-06, BR-07, BR-10; NFR-05, NFR-07 · Depends on: Feature-B, Feature-F,
SR-01 · Issue I-08 · Diagrams: D1 (last-seat race), D3 (activity)

**Behaviour**
1. On the event detail, a participant presses **REGISTER**. The button shows **HOLDING YOUR SEAT…** with
   `aria-busy`, and extra presses are ignored.
2. `POST /api/events/:id/registrations` runs the transaction in SDS §4.4: lock the event row → check open → check
   duplicate → count active → insert `REGISTERED`.
3. On `201` the "seat secured" moment plays (design-direction §7): the Seats card flips to "You're in.", counts
   update, the button becomes **✓ REGISTERED**, and the screen reader hears the announcement.
4. On `409` no flip: a red alert with the server's message, and the seat count refreshes (E-05 is called again).

**Order of checks:** 401 → 403 (not a participant) → 403 (Origin) → 400 (path id, body must be `{}` or empty) →
404 `EVENT_NOT_FOUND` → 409 `REGISTRATION_CLOSED` → 409 `ALREADY_REGISTERED` → 409 `EVENT_FULL` → 201.

| Condition | Status · code | Message shown |
|---|---|---|
| Event missing | 404 `EVENT_NOT_FOUND` | "This event could not be found." |
| Started, or not `PUBLISHED` | 409 `REGISTRATION_CLOSED` | "Registration for this event has closed." |
| Caller already holds an active registration | 409 `ALREADY_REGISTERED` | "You're already registered for this event." |
| `registeredCount ≥ capacity` | 409 `EVENT_FULL` | "This event filled up a moment ago, so no registration was made." |
| Unique-index violation in the race (same participant) | 409 `ALREADY_REGISTERED` | as above |

**Permissions:** participant only. Organizers get 403, including on their own events (BR-10).

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-09 | `POST /api/events/:id/registrations`, body `{}` or none | `201 ParticipantRegistration` (with updated `event.registeredCount` and `seatsRemaining`) | 400 · 401 · 403 · 404 · 409 (three codes) · 415 |

**Data:** `Registration` from SR-01. The partial unique index is the safety net for BR-06. *No new fields.*

| AC | Given | When | Then |
|---|---|---|---|
| **AC-G-01** | Nok signed in; EV-1 has 3 / 24 | E-09 for EV-1, then E-05 and the UI flow | `201` with `status REGISTERED` and `event.registeredCount 4, seatsRemaining 20`; one new row with `participantId` = Nok; E-05 now gives `viewer.action REGISTERED`; the UI shows "You're in." and **✓ REGISTERED** |
| **AC-G-02** | EV-3 is full (2 / 2); Nok signed in | E-09 for EV-3 | `409 EVENT_FULL`; still 2 active rows; the UI shows the full-event message without the flip, and the seat count still reads 2 / 2 |
| **AC-G-03** | Mint already registered for EV-1 | E-09 for EV-1 by Mint, sequentially, then twice at the same time | every response `409 ALREADY_REGISTERED`; exactly one active row for (EV-1, Mint) |
| **AC-G-04** | EV-4 has started; clock fixed | E-09 for EV-4 by Nok | `409 REGISTRATION_CLOSED`; no row stored |
| **AC-G-05** | Quantum Cards and Dragon's Den signed in | each calls E-09 for EV-1 (one is the owner) | both `403 FORBIDDEN`; no row stored |
| **AC-G-06** | an event with capacity 5 and 4 active registrations; 20 other signed-in participants; separately, an open event and one participant | 20 E-09 calls run at the same time (`Promise.all`); then 5 calls by the single participant run at the same time | exactly one `201` and nineteen `409 EVENT_FULL`; active count = 5 = capacity; the single participant gets one `201` and four `409 ALREADY_REGISTERED`, with one row. The whole test passes 20 runs in a row |

**Planned tests:** TEST-G-01 … 06 (U, I, E). TEST-G-06 is the concurrency test (STS §2.4).

**What I-08 adds and moves (v1.6).** The E2E halves of TEST-G-01 and TEST-G-02 move to I-12 with the other
Playwright journeys. In I-08 the same UI behaviour is checked at component level (`Registration.test.tsx`):
HOLDING YOUR SEAT… with `aria-busy` and ignored presses, the flip to "You're in.", the new counts, the live-region
sentence, focus on "You're in.", and on a 409 the alert plus a refreshed seat count. I-08 also adds the E-09 cases
that earlier Issues reserved for it: TEST-SR2-05 (415, origin, no body), TEST-SR3-01 (E-09 at T), TEST-A-04 (old
cookie) and TEST-B-01 … 03 (real path instead of the I-06 probe, plus "stored `participantId` = caller").

---

## 11. Feature-H — My Events (participant registrations)

**Links:** FR-17; BR-16; NFR-02, NFR-09 · Depends on: Feature-G · Issue I-10

**Behaviour:** `/me/registrations` ("My Events" tab) lists the participant's registrations as event cards with a
status chip (`REGISTERED`), soonest event first. Each card links to the event detail page (FR-17). Empty: "You
haven't registered for any events yet" plus **Find an Event**.

**Permissions:** participant only; the query is `where participantId = actor.id`. Another participant's
registration id answers 404.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-10 | `GET /api/me/registrations` | `200 { "items": ParticipantRegistration[] }`, `event.startAt` asc, `id` asc | 401 · 403 |
| E-11 | `GET /api/me/registrations/:id` | `200 ParticipantRegistration` | 400 · 401 · 403 · 404 `REGISTRATION_NOT_FOUND` |

**Data:** *No change.*

| AC | Given | When | Then |
|---|---|---|---|
| **AC-H-01** | Mint is registered for EV-1, EV-2, EV-4; Nok for none | E-10 as Mint and as Nok, and `/me/registrations` for each | Mint: exactly those three, in event start order, each linking to its event; Nok: `items: []` and the empty state with **Find an Event** |
| **AC-H-02** | Ploy's registration id for EV-3 | Mint calls E-11 with that id, and with an id that does not exist | both `404 REGISTRATION_NOT_FOUND` with identical bodies; no field of Ploy's registration appears; an organizer calling E-10 gets `403` |

**Planned tests:** TEST-H-01, 02 (I, E).

**What I-10 adds and moves (v1.8).** The E2E half of TEST-H-01 moves to I-12 with the other Playwright journeys; in
I-10 the page is checked at component level (`MyEvents.test.tsx`: cards in order with links and the REGISTERED
chip, the empty state with **Find an Event**, loading and error with **Try again**). E-10 and E-11 replace the I-06
probes in TEST-B-01 … 03 and the I-04 protected probe in TEST-A-04; both probes are removed.

---

## 12. Feature-I — Event Registration List

**Links:** FR-18; BR-14, BR-16; NFR-02 · Depends on: Feature-E, Feature-G · Issue I-11

**Behaviour:** from the dashboard or the **MANAGE EVENT** button, the owner opens
`/organizer/events/:id/registrations`. It shows the event title, the chip `registeredCount / capacity · N seats
left`, and a table: #, player (display name), registered at (Bangkok time), status. Oldest first. Empty:
"No registrations yet."

**Permissions:** organizer **and** owner. Another organizer → 404; a participant → 403; a visitor → 401.

**API**

| # | Request | Success | Failures |
|---|---|---|---|
| E-08 | `GET /api/organizer/events/:id/registrations` | `200 { "event": {id,title,capacity,registeredCount,seatsRemaining}, "items": OrganizerRegistrationRow[] }`, `createdAt` asc, `id` asc | 400 · 401 · 403 · 404 `EVENT_NOT_FOUND` |

**Data:** *No change.*

| AC | Given | When | Then |
|---|---|---|---|
| **AC-I-01** | Quantum Cards owns EV-1 with Mint, Ploy, Boss | E-08 for EV-1 and the page | three rows in registration order with display names, times and `REGISTERED`; `event.registeredCount 3, capacity 24, seatsRemaining 21`; EV-6 shows "No registrations yet." |
| **AC-I-02** | Dragon's Den does not own EV-1 | Dragon's Den calls E-08 for EV-1 and for a non-existent id | both `404 EVENT_NOT_FOUND` with identical bodies |
| **AC-I-03** | Mint signed in; Quantum Cards' E-08 response for EV-1 | Mint calls E-08; the owner's response is searched | Mint `403 FORBIDDEN`; the owner's response contains no email address and no participant id |

**Planned tests:** TEST-I-01 … 03 (I, E).

---

## 13. SR-04, SR-05 and SR-07 at Sprint 1 level

| ID | Sprint 1 scope | AC | Given | When | Then |
|---|---|---|---|---|---|
| SR-04 | `.env.example`, start-up config check, `GET /api/health`, secret scan | **AC-SR4-01** | the repository and a running server | `.env.example` is compared with `config.ts`; the server starts without `DATABASE_URL`; E-12 is called with the database up and down; the secret scan runs | every variable in SDS §9.1 is in `.env.example`; start-up fails with a message naming the variable; E-12 `200 {status:"ok"}` / `503 {status:"unavailable"}`; the scan reports 0 findings |
| SR-05 | Sprint 1 screens at three widths | **AC-SR5-01** | the seeded app | Playwright opens `/events`, `/events/:id` (EV-1), `/login`, `/me/registrations`, `/organizer`, `/organizer/events/new`, `/organizer/events/:id/registrations` at 390, 768 and 1440 px | `document.documentElement.scrollWidth ≤ innerWidth` on every page and width; screenshots saved for the PDF |
| SR-07 | Traceability at release | **AC-SR7-01** | the release candidate on `sprint-1-staging` | the STS results table is filled from the real test run | every AC in this document has ≥ 1 test with a recorded result; every Sprint 1 BR has a rejection test; failed or skipped tests are listed, not hidden |

---

## 14. AC summary

47 acceptance criteria, all planned in `traceability.md` §3. They are counted by a script in the STS.

| Contract | ACs | Count |
|---|---|---|
| SR-01 | AC-SR1-01, 02 | 2 |
| SR-02 | AC-SR2-01 … 03 | 3 |
| SR-03 | AC-SR3-01 | 1 |
| Feature-A | AC-A-01 … 06 | 6 |
| Feature-B | AC-B-01 … 03 | 3 |
| Feature-C | AC-C-01 … 06 | 6 |
| Feature-D | AC-D-01 … 05 | 5 |
| Feature-E | AC-E-01, 02 | 2 |
| Feature-F | AC-F-01 … 05 | 5 |
| Feature-G | AC-G-01 … 06 | 6 |
| Feature-H | AC-H-01, 02 | 2 |
| Feature-I | AC-I-01 … 03 | 3 |
| SR-04, SR-05, SR-07 | AC-SR4-01, AC-SR5-01, AC-SR7-01 | 3 |
| **Total** | | **47** |

## 15. Version history

Contracts are versioned. A change after PR 2 is merged needs a new row here, the reason, and the updated tests in
the same Pull Request, so the history stays visible (Deliverable 1 §3.5).

| Version | Date | Change | Reason | Author |
|---|---|---|---|---|
| v1.0 | 4 Nov 2026 | First contracts for SR-01 … SR-03, Feature-A … I, SR-04, SR-05, SR-07; 47 ACs | Sprint 1 baseline before implementation | Team (AI-assisted) |
| v1.1 | 4 Nov 2026 | §1 SR-01: constraints moved to migration `0002_rule_constraints`; `db:migrate:test` (non-destructive) added beside `db:reset:test`; in I-01, AC-SR1-01 is checked through the data layer, and through the API plus a real restart in I-12 | Found while implementing #3 (I-01): no API exists yet in I-01, and Prisma blocks agents from running `migrate reset` | Team (AI-assisted) |
| v1.2 | 5 Nov 2026 | §2 SR-02: 413 is `PAYLOAD_TOO_LARGE`; body-less POST is not a 415; I-02 proves the pipeline through test-only probe routes, and I-04, I-07, I-08, I-12 add their real-endpoint cases to TEST-SR2-01 … 05. §3 SR-03: the no-`Date.now()` rule is a source check in TEST-SR3-01, not a lint rule; TEST-SR3-01 split between I-02 (rule + database) and I-05 / I-08 (E-04 / E-09) | Found while implementing #4 (I-02): E-04, E-06 and E-09 are built in later Issues, and the catalogue had no code for 413 | Team (AI-assisted) |
| v1.3 | 6 Nov 2026 | §4 Feature-A: TEST-A-04 uses a test-only protected probe until E-09 / E-10 exist, and its E2E half moves to I-12; AC-A-05's response scan is defined as keys, hashes and the seed password; the server error texts now match this section (`INVALID_CREDENTIALS` "Email or password is incorrect.", unknown keys "This value cannot be set.") | Found while implementing #6 (I-04): E-09 and E-10 are built in I-08 / I-10, Playwright is set up in I-12, and `errors.ts` / `validate.ts` (I-02) used different words from this contract | Team (AI-assisted) |
| v1.4 | 6 Nov 2026 | §9 Feature-F: Playwright E2E spec deferred to I-12 (following PR #18 pattern); documented known limitations (MANAGE links to I-11, REGISTER onRegister handler in I-08, inactive search controls until Sprint 2); path id integer range validation handled via parseId | Found during review of #19 (I-05) | Team (AI-assisted) |
| v1.5 | 6 Nov 2026 | §5 Feature-B: E-06 … E-11 cells of TEST-B-01 … 03 run against test-only probes with the real guards until I-07 … I-11; the "stored id = caller" half of AC-B-01 moves to I-07 / I-08 | Found while implementing #8 (I-06): the guards are needed before the endpoints that use them, and those are built in later Issues | Team (AI-assisted) |
| v1.6 | 6 Nov 2026 | §10 Feature-G: E2E halves of TEST-G-01 / G-02 move to I-12; the UI behaviour is checked at component level in I-08; E-09 cases added to TEST-SR2-05, TEST-SR3-01, TEST-A-04 and TEST-B-01 … 03 | Found while implementing #10 (I-08): Playwright is set up in I-12 | Team (AI-assisted) |
| v1.7 | 6 Nov 2026 | §7 Feature-D: Playwright E2E half of TEST-D-01 moves to I-12 (following PR #18 pattern); UI behaviour checked at component level (CreateEvent.test.tsx); E-06 replaces probe in TEST-B-01 … 03 and adds case to TEST-SR2-02 | Found while implementing #9 (I-07): Playwright is set up in I-12 | Praewa (MeldyRose) |
| v1.8 | 6 Nov 2026 | §11 Feature-H: E2E half of TEST-H-01 moves to I-12; the page is checked at component level in I-10; E-10 / E-11 replace their probes in TEST-A-04 and TEST-B-01 … 03 | Found while implementing #12 (I-10): Playwright is set up in I-12 | Team (AI-assisted) |
