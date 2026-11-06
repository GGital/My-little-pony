# Sprint 1 Software Test Specification (STS)

Project: **TCG Event Hub** · Sprint 1 · Document version: v1.7 (v1.0 reviewed in PR 2; changes in §8)
Contracts: [`feature-contracts.md`](feature-contracts.md) v1.6 · Issues and Definition of Done: [`README.md`](README.md)

This document turns every Sprint 1 acceptance criterion into planned tests, **before** the code exists. It
follows the method we used in TokTickIT: **Spec DD → Test DD → TDD**. A Pull Request that adds behaviour without
its planned tests is not reviewable, and every result in this document comes from real test output.

---

## 1. Test strategy

### 1.1 Rules

1. **Tests first.** For each Issue, the planned tests are committed **first**, run, and shown to fail (red). Only
   then is the behaviour implemented until they pass (green). Both runs are recorded in §5 (Deliverable 1 §3.5).
2. **The server is the authority.** Every rule and every permission is proven with a direct API call against the
   real database. A UI test that a button is hidden only covers feedback, never authorization.
3. **Counts are checked independently.** Any `registeredCount` or `seatsRemaining` in a response is compared with
   a separate Prisma count written in the test, not with the code under test.
4. **No mocked persistence.** Integration tests use a real PostgreSQL test database (SDS SD-09).
5. **Nothing is weakened to pass.** No `.skip`, `.only`, commented-out or assertion-free tests on the release
   commit. A failing or skipped test is reported in §6, not hidden.

### 1.2 Levels and tooling

| Level | Code | Tooling | Location |
|---|---|---|---|
| Unit | U | Vitest | `server/tests/sprint-1/unit/`, `client/tests/sprint-1/unit/` |
| API + database integration | I | Vitest + Supertest, real PostgreSQL (`DATABASE_URL_TEST`) | `server/tests/sprint-1/*.api.test.ts` |
| UI component | C | Vitest + Testing Library + jsdom | `client/tests/sprint-1/` |
| End-to-end | E2E | Playwright against the running app and seed, at 390 / 768 / 1440 px | `e2e/sprint-1/` |
| Manual, with recorded evidence | M | Checklist + screenshot | `docs/sprints/sprint-1/evidence/` |

### 1.3 Test data

- **E2E and manual checks** start from the idempotent seed (contracts §0.3): 2 organizers, 4 participants, EV-1 …
  EV-6, including the full EV-3, the started EV-4 and the last-seat EV-2.
- **Integration tests build their own data** with small factories (`makeOrganizer()`, `makeParticipant()`,
  `makeEvent({ capacity, startAt })`, `register(user, event)`), after truncating all tables before each file. They
  do not depend on the seed, except TEST-SR1-02, which tests the seed itself.
- **Time** is fixed with `clock.setNow()` in every file that touches "upcoming", "started" or session expiry.
  Boundaries are tested exactly at, one minute before, and one minute after.
- **Sign-in in tests** uses a `signIn(agent, user)` helper that calls the real E-01, so tests carry a real cookie.
  Test users get a generated password that is never committed.
- State-changing test requests send `Origin: <APP_ORIGIN>`. TEST-SR2-05 checks what happens without it.

### 1.4 Failure and concurrency simulation

| Situation | How it is produced |
|---|---|
| **Last-seat race (TEST-G-06)** | An event with capacity 5 and 4 active registrations; 20 participants each with their own signed-in Supertest agent; `await Promise.all(agents.map(a => a.post(url)))`. The test runs inside `for (let i = 0; i < 20; i++)` so the release shows 20 passing rounds |
| Same participant double-click | 5 simultaneous E-09 calls from one agent |
| Database down (health) | A second Prisma client pointed at an unreachable URL is injected into the health handler in the test |
| Forced 500 | A probe route `/api/__test/boom` that throws. It lives in `tests/helpers/probes.ts` and is mounted with `createApp({ extraRoutes })`, so the production app never has it |
| Slow, empty and failing API in the UI | `fetch` stubs in component tests; `page.route('**/api/**')` in Playwright |
| Server restart (TEST-SR1-01) | Integration: a new Prisma client. Manual: stop and start the server, then reload the page |

### 1.5 Definition of a passing Sprint 1 suite

Every planned row in §2 is implemented and green on the release commit; every AC appears in §3; the BR table in §4
has a passing rejection test for each Sprint 1 BR; the commands in §7 pass from a clean clone; and §6 records the
commit, command, counts and any exceptions.

---

## 2. Planned tests

Legend for **Result**: `Pending` = planned, not yet run. Changed to `Pass` or `Fail` **only from real output**, with
the commit id in §6.

### 2.1 SR-01 — persistence, migrations, seed

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-SR1-01 | I, M | AC-SR1-01, NFR-06 | (I-01) organizer, participant, event and registration written through the data layer; (I-12) the same through the API | Read both with a **new** Prisma client; (M, I-12) restart the server and reload `/me/registrations` | Identical field values; the registration still shows after restart | `server/tests/sprint-1/persistence.api.test.ts` | Pending |
| TEST-SR1-02 | I | AC-SR1-02, NFR-06 | Empty test database, `SEED_PASSWORD` set | Run the seed twice | 6 users (2 organizers, 4 participants), 6 events, the §0.3 registrations; second run adds 0 rows | `server/tests/sprint-1/seed.api.test.ts` | Pending |
| TEST-SR1-03 | I | BR-01 | Direct SQL insert with capacity 0 and 257 | Insert, bypassing the API | Rejected by `event_capacity_range` | `server/tests/sprint-1/constraints.api.test.ts` | Pending |
| TEST-SR1-04 | I | BR-02 | Direct SQL insert with end ≤ start, and end = start + 24 h 1 min | Insert, bypassing the API | Rejected by `event_time_window` | `server/tests/sprint-1/constraints.api.test.ts` | Pending |
| TEST-SR1-05 | I | BR-06 | One active registration exists for (event, participant) | Insert a second active row by SQL; then mark the first `CANCELLED` and insert again | `registration_one_active` is a UNIQUE index on (`eventId`, `participantId`) limited to `REGISTERED`/`CHECKED_IN`; the second active insert (and a `CHECKED_IN` one) fails with SQLSTATE 23505 on those columns; after the cancel, the insert succeeds | `server/tests/sprint-1/constraints.api.test.ts` | Pending |

### 2.2 SR-02, SR-03 — conventions, validation, errors, time

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-SR2-01 | I | AC-SR2-01, NFR-07 | (I-02) probe routes: invalid body → 400, catalogue 401 and 409, foreign Origin → 403, unknown route → 404, `/api/__test/boom` → 500; a cookie on every request. (I-12) adds real 401 (E-03 signed out) and 409 (E-09 on a full event) | Send each; inspect body text and the server log | Every body is exactly `{error:{code,message,details?}}`; no `stack`, `at `, `SELECT`, `prisma`, file path, other user's email or cookie in any body; the 500 is logged once with only method, path and the real error | `server/tests/sprint-1/errors.api.test.ts` | Pending |
| TEST-SR2-02 | I | AC-SR2-02, NFR-15 | (I-02) `POST /api/__test/echo` with a `.strict()` schema using the E-06 field names. (I-07) organizer session, real E-06 | Send `capacity:"ten"`, `title:7`, `startAt:"tomorrow"`, `organizerId:99` | `400 VALIDATION_FAILED`; `details` has exactly those 4 fields; 0 rows stored (table counts unchanged) | `server/tests/sprint-1/validation.api.test.ts` | Pending |
| TEST-SR2-03 | I | AC-SR2-03, NFR-15 | Seeded test DB; row counts of all tables recorded; route table `tests/helpers/routes.ts` (each Issue adds its endpoints; I-04 added participant and organizer sessions (done); I-12 checks all 12 routes are listed) | Call every listed route with GET | Row counts unchanged; GET on POST-only paths → `404 NOT_FOUND` | `server/tests/sprint-1/validation.api.test.ts` | Pending |
| TEST-SR2-04 | U | NFR-07 | — | `sendError` for every code in SDS §6.2 (21 codes, incl. `PAYLOAD_TOO_LARGE`); the TypeScript compiler on `sendError(res, 'NOT_A_CODE')` | Each code gets its status from the catalogue; the 500 wording is fixed; an unknown code is a compile error and also throws at run time | `server/tests/sprint-1/unit/errors.unit.test.ts` | Pending |
| TEST-SR2-05 | I | NFR-15 | (I-02) `POST /api/__test/echo`. (I-08) participant session, real E-09 | `text/plain` body; 101 kB body; `Origin: https://evil.example`; no Origin; malformed JSON; no body | `415`; `413 PAYLOAD_TOO_LARGE`; `403 FORBIDDEN`; `403 FORBIDDEN`; `400 VALIDATION_FAILED`; no body is not a 415; nothing stored | `server/tests/sprint-1/validation.api.test.ts` | Pending |
| TEST-SR3-01 | I | AC-SR3-01, NFR-11 | Clock at T; events start T + 1 min, T, T − 1 min. (I-02) rule helpers against the database. (I-05) E-04. (I-08) E-09 with a participant session | (I-02) `upcomingWhere()` query, `hasStarted()`, read back; (I-05) E-04; (I-08) E-09 on each | Only T + 1 min is upcoming / listed and accepted (201); T and T − 1 min have started, are absent and get `409 REGISTRATION_CLOSED`; times keep milliseconds and end in `Z`; `setNow` refuses outside tests; no `Date.now()` / `new Date()` in `src/domain` | `server/tests/sprint-1/time.api.test.ts` | Pending |
| TEST-SR3-02 | U | AC-SR3-01, NFR-11 | `TZ=UTC` and `TZ=America/New_York` | `formatEventTime('2026-11-05T10:00:00Z')` | `Thu 5 Nov 2026 · 17:00` in both | `client/tests/sprint-1/unit/formatEventTime.unit.test.ts` | Pending |

### 2.3 Feature-A — authentication and session

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-A-01 | I, C | AC-A-01, FR-01, FR-03 | Participant `mint@player.example` | E-01 with `"  MINT@player.example "` and the right password; then E-03 with the cookie | `200` AuthUser (lower-case email, role PARTICIPANT); `Set-Cookie: tcg.sid`; E-03 same user; 1 Session row whose id = SHA-256(cookie) ≠ cookie. (C) the sign-in page posts E-01 and goes to a safe `returnTo`, else `/events` (participant) or `/organizer` (organizer); `https://…`, `//…` and `/\…` are ignored | `server/tests/sprint-1/auth.api.test.ts`, `client/tests/sprint-1/SignInPage.test.tsx` | Pending |
| TEST-A-02 | I, C | AC-A-02, FR-02 | Same user | E-01 with wrong password; E-01 with `ghost@player.example` | Both `401 INVALID_CREDENTIALS`, identical bodies; no Session row; no `Set-Cookie`; mean time difference < 50 ms over 20 tries; contract §4 field rules → 400 with the contract messages; foreign Origin → 403. (C) alert "Email or password is incorrect.", email kept, password cleared and focused; SIGN IN disabled with `aria-busy` while sending | `server/tests/sprint-1/auth.api.test.ts`, `client/tests/sprint-1/SignInPage.test.tsx` | Pending |
| TEST-A-03 | I | AC-A-03, FR-03 | A valid cookie; no cookie; `tcg.sid=abc`; a well-formed unknown token | E-03 with each | `200`; `401`; `401`; `401` | `server/tests/sprint-1/auth.api.test.ts` | Pending |
| TEST-A-04 | I, E2E | AC-A-04, FR-04, NFR-04 | Signed-in participant | E-02; then the old cookie on E-03, E-02 and the test-only `GET /api/__test/protected` (real `requireAuth`, standing in for E-09 and E-10 until I-08 / I-10 add their rows); E-02 without a cookie; E-02 with a foreign Origin. (E2E) sign out in the header, press Back | `204`, Session row deleted; then `401` ×3; no cookie → 401 before the origin check; foreign Origin → 403 and the session survives. (E2E, in I-12) (E2E) the previous page shows no registration data and asks to sign in | `server/tests/sprint-1/auth.api.test.ts`, `e2e/sprint-1/auth.spec.ts` | Pending |
| TEST-A-05 | U, I | AC-A-05, NFR-03 | Seeded DB | (U) `hashPassword` → format and `verifyPassword` round trip, wrong password false; (I) read all `passwordHash`; scan the bodies of every Sprint 1 response | (U) `scrypt$32768$8$1$…$…`, true / false; (I) every hash matches the pattern; no body contains `password`, `passwordHash` or the seed password | `server/tests/sprint-1/unit/password.unit.test.ts`, `server/tests/sprint-1/auth.api.test.ts` | Pending |
| TEST-A-06 | I | AC-A-06, NFR-04 | Clock at T; sign in | Parse `Set-Cookie`; E-03 at T + 7 h 59 min and at T + 8 h | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28800`; `200` then `401` | `server/tests/sprint-1/auth.api.test.ts` | Pending |

### 2.4 Feature-B — role and ownership

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-B-01 | I | AC-B-01, BR-17 | Seed; Mint (participant), Quantum Cards (organizer) signed in through E-01 | Mint: E-09 with `{participantId: Ploy}`; Quantum Cards: E-06 with `organizerId: Dragon's Den`. In I-06 through the probes (contracts v1.5 §5); I-07 / I-08 add the real E-06 / E-09 and the "stored id = caller" half (`{}` → stored `participantId` = Mint, valid body → `organizerId` = Quantum Cards) | Stored `participantId` = P, `organizerId` = O1; the two id-carrying requests `400` and store nothing | `server/tests/sprint-1/authorization.api.test.ts` | Pending |
| TEST-B-02 | I | AC-B-02, NFR-01 | No cookie | Call E-02, E-03 (real) and E-06 … E-11 (I-06 probes until their Issues land) | Each `401 UNAUTHENTICATED`; body keys = `["error"]` only | `server/tests/sprint-1/authorization.api.test.ts` | Pending |
| TEST-B-03 | I | AC-B-03, NFR-02, BR-10, BR-13, BR-14, BR-16 | Visitor, participant P, owner O1, other organizer O2; data owned by O1 and P | Table-driven: one row per cell of SDS §7.1 for E-01 … E-11 (E-06 … E-11 through the I-06 probes until I-07 … I-11), Quantum Cards calling E-09 (wrong role **and** not the owner of EV-5), a malformed id on E-08 (401 signed out, 400 signed in), E-02 per caller with its own session | Every status equals the matrix; the double failure gives `403`; 404 bodies for "exists but not yours" and "does not exist" are byte-identical | `server/tests/sprint-1/authorization.api.test.ts` | Pending |

### 2.5 Feature-C — shell, navigation, shared states

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-C-01 | C | AC-C-01, FR-05 | `AuthProvider` stubbed as signed out, participant, organizer | Render `<AppShell>` | Links exactly: Events · / Events, My Events · / Events, Dashboard, + Create event | `client/tests/sprint-1/AppShell.test.tsx` | Pending |
| TEST-C-02 | C, E2E | AC-C-02, FR-05 | Signed out; participant | Navigate to `/me/registrations`; as participant to `/organizer` | Redirect to `/login?returnTo=%2Fme%2Fregistrations`; "This page isn't available for your account" and **no** request to `/api/organizer/*` | `client/tests/sprint-1/RouteGuards.test.tsx`, `e2e/sprint-1/navigation.spec.ts` | Pending |
| TEST-C-03 | E2E | AC-C-03, FR-26 | Seed; signed out on EV-1 | Click SIGN IN TO REGISTER → sign in as Nok; then open `/login?returnTo=https://evil.example` and `//evil.example`, sign in | Back on EV-1 with **REGISTER**; the unsafe `returnTo` values land on `/events` | `e2e/sprint-1/navigation.spec.ts` | Pending |
| TEST-C-04 | C | AC-C-04, FR-27 | Signed out; signed in as Mint | Render header; open the menu; click Sign out (E-02 stubbed 204) | "Sign in" link; "Mint" + `PLAYER` + Sign out; after click, signed-out header and "You are signed out."; E-03 on load decides the header; signing out on a guarded route (`/me/registrations` with `AppRoutes`) lands on `/events`, not the sign-in redirect | `client/tests/sprint-1/AppShell.test.tsx` | Pending |
| TEST-C-05 | C | AC-C-05, NFR-09 | Stubs: delayed 300 ms, `items: []`, 500; create form with a 400 `details` response | Render list, My Events, dashboard, registration list; submit the form | Loading first; named empty state with action; error with message + Try again (retry calls again); field errors under the right inputs; submit disabled with `aria-busy` while pending | `client/tests/sprint-1/States.test.tsx` | Pending |
| TEST-C-06 | C, E2E | AC-C-06, NFR-15 | Event description `<script>alert(1)</script><b>bold</b>` | Render detail; (E2E) open the page with a `dialog` listener | Text shown literally; no `<b>` element; no dialog fires. Lint check: `dangerouslySetInnerHTML` count = 0 | `client/tests/sprint-1/EventDetail.test.tsx`, `e2e/sprint-1/events.spec.ts` | Pending |

### 2.6 Feature-D — create and publish

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-D-01 | I, C, E2E | AC-D-01, FR-06 | Organizer O1; clock fixed | E-06 valid body (capacity 24, start tomorrow); then E-04. (C) CreateEvent form submit. (E2E, in I-12) fill the form and publish | `201`; row `PUBLISHED`, `organizerId` O1, `publishedAt` = now; listed with 0 / 24 and 24 left. (C) fields sent with +07:00 Bangkok offset, redirects to /events/:id with toast. (E2E) detail page with "Your event is live." | `server/tests/sprint-1/events.create.api.test.ts`, `client/tests/sprint-1/CreateEvent.test.tsx`, `e2e/sprint-1/organizer.spec.ts` (I-12) | Pending |
| TEST-D-02 | U, I | AC-D-02, BR-01 | O1 | Capacity 0, −1, 1.5, 257, `"24"`, `null`; then 1, 256 | First six `400` on `capacity` with the exact message, 0 rows; 1 and 256 `201` | `server/tests/sprint-1/unit/event-input.unit.test.ts`, `server/tests/sprint-1/events.create.api.test.ts` | Pending |
| TEST-D-03 | U, I | AC-D-03, BR-02 | O1; clock at T | start = T; start = T − 1 min; end = start; end = start + 24 h 1 min; end = start + 24 h | First four `422 EVENT_TIME_INVALID` naming `startAt` / `startAt` / `endAt` / `endAt`, 0 rows; last `201` | `server/tests/sprint-1/unit/event-rules.unit.test.ts`, `server/tests/sprint-1/events.create.api.test.ts` | Pending |
| TEST-D-04 | U, I | AC-D-04, BR-03 | O1 | Body missing all required fields; title `"ab"`, 101 chars, `"   "`; description 2,001 chars; then 3- and 100-char titles | One `400` listing **every** failing field; 0 rows; the 3- and 100-char titles accepted | `server/tests/sprint-1/unit/event-input.unit.test.ts`, `server/tests/sprint-1/events.create.api.test.ts` | Pending |
| TEST-D-05 | I | AC-D-05, BR-13 | Participant P; no session | E-06 valid body | P `403 FORBIDDEN`; visitor `401`; 0 rows | `server/tests/sprint-1/events.create.api.test.ts` | Pending |

### 2.7 Feature-E — organizer dashboard

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-E-01 | I, E2E | AC-E-01, FR-07 | O1 owns three events with 0, 3 and full registrations; O2 owns two | O1 calls E-07. (E2E) open `/organizer` as Quantum Cards | Exactly O1's three, `startAt` order; each count equals an independent Prisma count | `server/tests/sprint-1/organizer.api.test.ts`, `e2e/sprint-1/organizer.spec.ts` | Pending |
| TEST-E-02 | I | AC-E-02, BR-14 | Same data; participant P | O2 calls E-07; P calls E-07 | O2 sees none of O1's ids; P `403` | `server/tests/sprint-1/organizer.api.test.ts` | Pending |

### 2.8 Feature-F — discovery list and detail

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-F-01 | I, E2E | AC-F-01, FR-11 | Clock fixed; 4 upcoming events (one full), 1 started; no session, then a session | E-04 both ways. (E2E) `/events` on the seed | Upcoming only, `startAt` then `id` order, counts correct; same with a session. (E2E) EV-1, 2, 3, 5, 6 in order; EV-3 chip **FULL 2 / 2** | `server/tests/sprint-1/events.read.api.test.ts`, `e2e/sprint-1/events.spec.ts` | Pending |
| TEST-F-02 | I, C | AC-F-02, FR-12 | Event X with one registration by P1; a full event Y | E-05 X as visitor, P2, P1, O2, O1 (owner); E-05 Y as P2. (C) render the button for each `action` | `SIGN_IN_TO_REGISTER`, `REGISTER`, `REGISTERED`+id, `ORGANIZER_CANNOT_REGISTER`, `MANAGE`, `FULL`; all public fields present. (C) correct label and enabled state per action | `server/tests/sprint-1/events.read.api.test.ts`, `client/tests/sprint-1/ActionButton.test.tsx` | Pending |
| TEST-F-03 | I, E2E | AC-F-03, FR-12 | — | E-05 `/999999`, `/abc`, `/0`, `/-1`. (E2E) open `/events/999999` | `404 EVENT_NOT_FOUND`; `400` ×3. (E2E) Not found page | `server/tests/sprint-1/events.read.api.test.ts`, `e2e/sprint-1/events.spec.ts` | Pending |
| TEST-F-04 | I, E2E | AC-F-04, BR-04 | Clock fixed; event started 1 h ago | E-04; E-05 as participant. (E2E) EV-4 page | Absent from E-04; E-05 `hasStarted: true`, `action: CLOSED`. (E2E) disabled REGISTRATION CLOSED | `server/tests/sprint-1/events.read.api.test.ts`, `e2e/sprint-1/events.spec.ts` | Pending |
| TEST-F-05 | I | AC-F-05, BR-16 | Event with 3 registrations (known names and emails) | E-04 and E-05 as visitor and as another participant; stringify bodies | No participant id, display name, email, or `registrations` key | `server/tests/sprint-1/events.read.api.test.ts` | Pending |

### 2.9 Feature-G — registration

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-G-01 | I, C, E2E | AC-G-01, FR-15 | Event capacity 24 with 3 active; participant P not registered | E-09; then E-05 as P. (C) render the detail page and press REGISTER with E-09 stubbed. (E2E, in I-12) Nok on EV-1 clicks REGISTER | `201`, `REGISTERED`, counts 4 / 20 (checked by Prisma); `viewer.action REGISTERED`. (E2E) "You're in." card, **✓ REGISTERED**, live-region text | `server/tests/sprint-1/registrations.api.test.ts`, `client/tests/sprint-1/Registration.test.tsx`, `e2e/sprint-1/register.spec.ts` (I-12) | Pending |
| TEST-G-02 | U, I, C, E2E | AC-G-02, BR-05, FR-16 | Full event (2 / 2) | (U) `decideRegistration({capacity:2, active:2})`; (I) E-09; (C) E-09 stubbed 409 `EVENT_FULL`; (E2E, in I-12) Nok on EV-3 | (U) `EVENT_FULL`; (I) `409 EVENT_FULL`, still 2 rows; (E2E) red alert with the full message, no flip, chip still 2 / 2 | `server/tests/sprint-1/unit/registration-rules.unit.test.ts`, `server/tests/sprint-1/registrations.api.test.ts`, `client/tests/sprint-1/Registration.test.tsx`, `e2e/sprint-1/register.spec.ts` (I-12) | Pending |
| TEST-G-03 | I | AC-G-03, BR-06 | P has an active registration on X | E-09 again; then two at once | Every response `409 ALREADY_REGISTERED`; 1 active row | `server/tests/sprint-1/registrations.api.test.ts` | Pending |
| TEST-G-04 | U, I | AC-G-04, BR-04 | Clock fixed; event started 1 min ago; and one starting exactly now | (U) `decideRegistration` with `startAt ≤ now`; (I) E-09 on both | `REGISTRATION_CLOSED`; `409 REGISTRATION_CLOSED` ×2, 0 rows | `server/tests/sprint-1/unit/registration-rules.unit.test.ts`, `server/tests/sprint-1/registrations.api.test.ts` | Pending |
| TEST-G-05 | I | AC-G-05, BR-10 | Organizers O1 (owner of X) and O2 | Each calls E-09 on X | Both `403 FORBIDDEN`; 0 rows | `server/tests/sprint-1/registrations.api.test.ts` | Pending |
| TEST-G-06 | I | AC-G-06, BR-07, NFR-05 | Event capacity 5 with 4 active; 20 participant agents; separately an open event and 1 participant | `Promise.all` of 20 E-09 calls; then `Promise.all` of 5 calls by the single participant; whole test repeated 20 times | Each round: exactly one `201` and 19 × `409 EVENT_FULL`; active = 5; single participant: one `201` + four `409 ALREADY_REGISTERED`, one row | `server/tests/sprint-1/registrations.concurrency.api.test.ts` | Pending |

### 2.10 Feature-H — My Events

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-H-01 | I, E2E | AC-H-01, FR-17 | P1 registered for three events with different starts; P2 for none | E-10 as P1 and P2. (E2E) `/me/registrations` as Mint and as Nok | P1: three, soonest first, each with its event; P2: `items: []`. (E2E) cards link to event pages; Nok sees the empty state with Find an Event | `server/tests/sprint-1/me.api.test.ts`, `e2e/sprint-1/my-events.spec.ts` | Pending |
| TEST-H-02 | I | AC-H-02, BR-16 | P2's registration id; a non-existent id; organizer O1 | P1 calls E-11 with each id; O1 calls E-10 | Both `404 REGISTRATION_NOT_FOUND`, byte-identical bodies; no P2 field; O1 `403` | `server/tests/sprint-1/me.api.test.ts` | Pending |

### 2.11 Feature-I — registration list

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-I-01 | I, E2E | AC-I-01, FR-18 | O1's event with 3 registrations at known times; O1's event with none | E-08 for both. (E2E) Quantum Cards opens EV-1 and EV-6 lists | Rows in `createdAt` order with display names, times, status; counts 3 / 24 / 21; empty list `items: []`. (E2E) table and "No registrations yet." | `server/tests/sprint-1/organizer.api.test.ts`, `e2e/sprint-1/organizer.spec.ts` | Pending |
| TEST-I-02 | I | AC-I-02, BR-14 | O2; O1's event; a non-existent id | O2 calls E-08 for both | Both `404 EVENT_NOT_FOUND`, byte-identical | `server/tests/sprint-1/organizer.api.test.ts` | Pending |
| TEST-I-03 | I | AC-I-03, BR-16 | Participant P; O1's response for its event | P calls E-08; scan O1's body | P `403`; O1's body has no `@` email and no `participantId` / `email` keys | `server/tests/sprint-1/organizer.api.test.ts` | Pending |

### 2.12 SR-04, SR-05, SR-07 and journeys

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-SR4-01 | U, I, M | AC-SR4-01, NFR-13 | Repository; running server | (U) compare `.env.example` keys with `config.ts` schema; start config without `DATABASE_URL`. (I) E-12 with DB up and with the unreachable client. (M) secret scan | Same key set; start-up throws naming `DATABASE_URL`; `200 {status:"ok"}` / `503 {status:"unavailable"}`; scan 0 findings (screenshot) | `server/tests/sprint-1/unit/config.unit.test.ts`, `server/tests/sprint-1/health.api.test.ts`, evidence | Pending |
| TEST-SR5-01 | E2E | AC-SR5-01, NFR-08 | Seed | Open the 7 Sprint 1 screens at 390, 768, 1440 px | `scrollWidth ≤ innerWidth` on all 21; screenshots saved | `e2e/sprint-1/responsive.spec.ts` | Pending |
| TEST-SR7-01 | M | AC-SR7-01, NFR-14 | Release candidate | Run the coverage script (§3) on this file and the contracts; fill §6 from real output | 47 / 47 ACs with a result; §4 complete; exceptions listed | this file §3, §4, §6 | Pending |
| JRN-01 | E2E | FR-06, FR-15, FR-17, FR-18 (journey) | Seed | Quantum Cards publishes an event → signs out → Nok signs in, registers → My Events → Quantum Cards opens its registrations | Each step visible; Nok appears in the list with `REGISTERED` | `e2e/sprint-1/journey.spec.ts` | Pending |
| JRN-02 | E2E | BR-05, BR-07 (journey) | Seed; EV-2 has 1 seat left; two browser contexts (Nok, and a second participant created for the test) | Both open EV-2; both click REGISTER as close together as possible | One sees "You're in.", the other the full message; EV-2 shows 4 / 4 FULL | `e2e/sprint-1/journey.spec.ts` | Pending |

**Totals:** **53 planned test rows**: 47 that carry an AC's number (`TEST-<x>-nn` for `AC-<x>-nn`) and 6 supporting
tests (TEST-SR1-03 … 05, TEST-SR2-04, 05, TEST-SR3-02). Plus **2 end-to-end journeys** (JRN-01, JRN-02). One row
may run at several levels (for example I + E2E). The counts are checked by a script against the contracts and the
README Issue plan.

---

## 3. Acceptance criterion → tests

Every AC has at least one automated test. No authorization AC is proven by a UI test alone.

| AC | Tests | AC | Tests | AC | Tests |
|---|---|---|---|---|---|
| AC-SR1-01 | TEST-SR1-01 | AC-C-01 | TEST-C-01 | AC-F-03 | TEST-F-03 |
| AC-SR1-02 | TEST-SR1-02 | AC-C-02 | TEST-C-02 | AC-F-04 | TEST-F-04 |
| AC-SR2-01 | TEST-SR2-01, SR2-04 | AC-C-03 | TEST-C-03 | AC-F-05 | TEST-F-05 |
| AC-SR2-02 | TEST-SR2-02 | AC-C-04 | TEST-C-04 | AC-G-01 | TEST-G-01, JRN-01 |
| AC-SR2-03 | TEST-SR2-03, SR2-05 | AC-C-05 | TEST-C-05 | AC-G-02 | TEST-G-02 |
| AC-SR3-01 | TEST-SR3-01, SR3-02 | AC-C-06 | TEST-C-06 | AC-G-03 | TEST-G-03 |
| AC-A-01 | TEST-A-01 | AC-D-01 | TEST-D-01, JRN-01 | AC-G-04 | TEST-G-04 |
| AC-A-02 | TEST-A-02 | AC-D-02 | TEST-D-02, SR1-03 | AC-G-05 | TEST-G-05 |
| AC-A-03 | TEST-A-03 | AC-D-03 | TEST-D-03, SR1-04 | AC-G-06 | TEST-G-06, JRN-02 |
| AC-A-04 | TEST-A-04 | AC-D-04 | TEST-D-04 | AC-H-01 | TEST-H-01, JRN-01 |
| AC-A-05 | TEST-A-05 | AC-D-05 | TEST-D-05 | AC-H-02 | TEST-H-02 |
| AC-A-06 | TEST-A-06 | AC-E-01 | TEST-E-01 | AC-I-01 | TEST-I-01, JRN-01 |
| AC-B-01 | TEST-B-01 | AC-E-02 | TEST-E-02 | AC-I-02 | TEST-I-02 |
| AC-B-02 | TEST-B-02 | AC-F-01 | TEST-F-01 | AC-I-03 | TEST-I-03 |
| AC-B-03 | TEST-B-03 | AC-F-02 | TEST-F-02 | AC-SR4-01 | TEST-SR4-01 |
| | | | | AC-SR5-01 | TEST-SR5-01 |
| | | | | AC-SR7-01 | TEST-SR7-01 |

## 4. Business rules with rejection (negative) tests

NFR-14 requires a negative test for every BR. Sprint 1 BRs:

| BR | Rejection tested by | What is rejected |
|---|---|---|
| BR-01 | TEST-D-02, TEST-SR1-03 | Capacity 0, −1, 1.5, 257 (API and database) |
| BR-02 | TEST-D-03, TEST-SR1-04, TEST-SR3-01 | Past or now start; end not after start; over 24 h |
| BR-03 | TEST-D-04 | Missing, too short, too long, whitespace-only fields |
| BR-04 | TEST-F-04, TEST-G-04, TEST-SR3-01 | Started events hidden from the list and not registrable |
| BR-05 | TEST-G-02 | Registration on a full event |
| BR-06 | TEST-G-03, TEST-SR1-05 | Second active registration (API, race and database) |
| BR-07 | TEST-G-06, JRN-02 | 19 of 20 simultaneous requests for the last seat |
| BR-10 | TEST-G-05, TEST-B-03 | Organizers registering, including the owner |
| BR-13 | TEST-D-05, TEST-B-03 | Participants and visitors creating events |
| BR-14 | TEST-E-02, TEST-I-02, TEST-B-03 | Other organizers' dashboards and lists |
| BR-16 | TEST-F-05, TEST-H-02, TEST-I-03 | Names and emails in public responses; other participants' registrations |
| BR-17 | TEST-B-01, TEST-SR2-02 | Client-sent `participantId` / `organizerId` |

12 / 12 Sprint 1 BRs have a rejection test.

---

## 5. TDD record

Every Issue follows the same two-step history (README §3). Fill this table from the real runs; the commit ids are
the evidence the TA checks (Deliverable 1 §4.2).

| Issue | Tests written first | Red commit | Red run (failed / total) | Green commit | Green run (passed / total) |
|---|---|---|---|---|---|
| I-01 SR-01 data foundation | TEST-SR1-01 … 05 | `4725528` | **10 failed / 17** (all on assertions: constraints accepted bad rows; seed created nothing) — `evidence/I-01-red.txt` | `3486e31` (implementation, 16 / 17), then `47bba2c` (explained test correction) | **18 passed / 18** — `evidence/I-01-green-2.txt` |
| I-02 SR-02, SR-03 API foundation | TEST-SR2-01 … 05, TEST-SR3-01, TEST-SR4-01 (U, I) | `7895809` | **55 failed / 78** (all AssertionError: empty app answers 404 HTML, empty catalogue, unfixable clock, no config check; the 18 I-01 tests and 5 guard checks pass) — `evidence/I-02-red.txt` | `d8971df` (implementation, 77 / 78), then `c53184e` (explained test correction) | **78 passed / 78** — `evidence/I-02-green-2.txt` |
| I-03 Client shell | TEST-C-01, C-02, C-05, TEST-SR3-02 | `5c01c99`, `5e9f4aa` | **7 failed / 11** (TEST-C-01, C-02, SR3-02 on assertions; TEST-C-05 4 tests passed: components were committed with the tests; M1/M2 red commit `5e9f4aa` 2 failed / 18; AppRoutes test added in review; passes on first run; red shown by mutating the guard) — `evidence/I-03-red.txt` | `7401930`, `96ae073`, `ca5f9a9` (+ review fixes) | **24 passed / 24** — `evidence/I-03-green.txt` |
| I-04 Feature-A | TEST-A-01 … 06, TEST-C-04 (+ TEST-SR2-03 sessions) | `925d20e`; `9f205c1` (sign-out defect) | **Server 20 failed / 103** (all AssertionError: E-01 … E-03 answer 404; 3 new cases pass at red: the seeded-hash format case and the 2 `password.unit.test.ts` cases, because `password.ts` and the seed came with I-01; the 2 TEST-SR2-03 session cases were added with the docs and passed on their first run, since GET routes already wrote nothing) — `evidence/I-04-red-server.txt`; **client 11 failed / 35** (sign-in form and Sign out call missing) — `evidence/I-04-red-client.txt`; **client 1 failed / 36** at `9f205c1` (received `/login?returnTo=%2Fme%2Fregistrations`) — `evidence/I-04-red-client-2.txt` | `855ee27` (implementation); `6c99a5b` (sign-out fix) | **Server 105 passed / 105** (103 at `855ee27` + 2 TEST-SR2-03 session cases) — `evidence/I-04-green-server.txt`; **client 36 passed / 36** — `evidence/I-04-green-client-2.txt` |
| I-05 Feature-F | TEST-F-01 … 05, TEST-C-06 (+ TEST-SR3-01 E-04 boundary) | `10be7df` | **9 failed / 87** server, **8 failed / 33** client (all on assertions: E-04/E-05 404, ActionButton/EventDetail stubs) — `evidence/I-05-red.txt` | `9adc237` (+ review fixes) | **117 passed / 117** server, **46 passed / 46** client — `evidence/I-05-green.txt` |
| I-06 Feature-B | TEST-B-01 … 03 | `863cb94` | **12 failed / 175** (all AssertionError: a wrong role gets 200 / 201 instead of 403; another owner's event and registration give 200 instead of 404; the 404 bodies differ). The other new cells pass at red, because they rest on earlier Issues: every 401 (`requireAuth`, I-04), the public E-01 / E-04 / E-05 cells, and TEST-B-01's 400s (`.strict()` schemas, I-02) — `evidence/I-06-red.txt` | `d8c973b` | **175 passed / 175** (twice) — `evidence/I-06-green.txt`; client unchanged, 46 / 46 |
| I-07 Feature-D | TEST-D-01 … 05 | `5db1262` | **Server 41 failed / 218** (all on assertions: E-06 answers 404; time rules stub returns valid; input schema rejects extra fields/valid fields; access control tests: visitor 404 instead of 401, participant 404 instead of 403; earlier 177 tests all pass) — `evidence/I-07-red.txt`. Client tests (`CreateEvent.test.tsx`, 4) were written with the page in `bf5daf8` and have no red run. | `bf5daf8` | **Server 220 passed / 220, client 50 passed / 50** — `evidence/I-07-green.txt` |
| I-08 Feature-G | TEST-G-01 … 06 (+ E-09 cases in TEST-SR2-05, TEST-SR3-01, TEST-A-04, TEST-B-01 … 03) | `ea05646` | **Server 33 failed / 203** (all AssertionError: E-09 answers 404; `decideRegistration` stub says OK; the race gets 20 × 404) — `evidence/I-08-red-server.txt`; **client 2 failed / 48** (no HOLDING YOUR SEAT…, no alert) — `evidence/I-08-red-client.txt` | `9f72800` (implementation: server 203 / 203, client 47 / 48), then `115a722` (explained test correction: an ambiguous query in the new client test) | **Server 203 passed / 203**, three runs, TEST-G-06 20 rounds each — `evidence/I-08-green-server.txt`; **client 48 passed / 48** — `evidence/I-08-green-client-2.txt`. Mutation: without `FOR UPDATE` the race sells the seat many times (round 1 fails) |
| I-09 Feature-E | TEST-E-01, 02 | `913ccb4` | **Server 9 failed / 253** (all on assertions: E-07 answers 404; TEST-E-01, 02 fail; authorization E-07 rows fail) — `evidence/I-09-red-server.txt`; **client 3 failed / 56** (Dashboard stubs) — `evidence/I-09-red-client.txt` | Pending | **Server 253 passed / 253** — `evidence/I-09-green-server.txt`; **client 56 passed / 56** — `evidence/I-09-green-client.txt` |
| I-10 Feature-H | TEST-H-01, 02 | Pending | Pending | Pending | Pending |
| I-11 Feature-I | TEST-I-01 … 03 | Pending | Pending | Pending | Pending |
| I-12 Integration and release | TEST-C-03, TEST-SR5-01, TEST-SR7-01, JRN-01, JRN-02 | Pending | Pending | Pending | Pending |

**What counts as red:** the new tests compile and run, and fail **on their assertions** (for example, expected
`409` received `404`, because the route does not exist yet), not on a syntax error. For the two excerpts in the PDF
(one domain rule: TEST-G-06 or TEST-G-02; one access rule: TEST-B-03 or TEST-I-02), save both the red and the green
output.

---

## 6. Results (filled at release)

| Item | Value |
|---|---|
| Release commit / tag | Pending (`v0.1.0`) |
| Server: `npm --prefix server test` | Pending: passed / failed / skipped |
| Client: `npm --prefix client test` | Pending |
| E2E: `npx playwright test e2e/sprint-1` | Pending |
| Build: `npm --prefix server run build && npm --prefix client run build` | Pending |
| Concurrency: TEST-G-06, 20 rounds | Pending |
| Manual checks: TEST-SR1-01 (restart), TEST-SR4-01 (secret scan) | Pending, with screenshots in `evidence/` |
| Failed / skipped tests and known limitations | Pending (I-03: the `dangerouslySetInnerHTML` lint rule (Behaviour 6) and TEST-C-06 come with I-05. I-08: the E2E halves of TEST-G-01 / G-02 are in I-12; E-09 rows of TEST-B-01 … 03 now use the real endpoint. I-06: E-06 … E-11 cells of TEST-B-01 … 03 run against test-only probes until I-07 … I-11 point them at the real endpoints; I-12 checks no probe rows remain. I-04: the E2E half of TEST-A-04 is in I-12 with the other Playwright tests; the E-09 / E-10 old-cookie rows of TEST-A-04 come with I-08 / I-10; the AuthProvider stub noted for I-03 is resolved) |

The AC → test → actual file/name → result table for the PDF (Deliverable 1 §4.2) is produced from §2 and this
section.

## 7. Test commands

Prerequisites: PostgreSQL 16 running; `server/.env` and the test variables from `.env.example`; migrations applied
to both databases.

```bash
npm --prefix server run db:reset:test
```

```bash
npm --prefix server test
```

```bash
npm --prefix client test
```

```bash
npm --prefix server run db:seed && npx playwright test e2e/sprint-1
```

## 8. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v1.0 | 4 Nov 2026 | First STS: 53 planned test rows + 2 journeys for 47 ACs, BR rejection map, TDD record, commands | Team (AI-assisted) |
| v1.1 | 4 Nov 2026 | I-01 TDD record filled from real runs; TEST-SR1-01 split between I-01 (data layer) and I-12 (API, restart); TEST-SR1-05 expected result states the index shape and SQLSTATE 23505 | Team (AI-assisted) |
| v1.2 | 5 Nov 2026 | I-02 TDD record filled from real runs; TEST-SR2-01 … 05 and TEST-SR3-01 describe the I-02 probe-route form and which Issue adds each real-endpoint case (contracts v1.2); 413 is `PAYLOAD_TOO_LARGE`; forced 500 route moved into the test helpers | Team (AI-assisted) |
| v1.3 | 5 Nov 2026 | I-03 TDD record filled from real runs; TEST-SR3-02 multi-timezone verification, AppRoutes suite, route guard role protection on /me/registrations, and session expiry 401 handling | Team (AI-assisted) |
| v1.4 | 6 Nov 2026 | I-04 TDD record filled from real runs. TEST-A-01 / A-02 gain a component level for the sign-in page (contracts §4 UI); TEST-A-02 also covers the timing, field and origin rules of contracts §4; TEST-A-04 uses a test-only protected probe until E-09 / E-10 exist and moves its E2E half to I-12 (contracts v1.3); TEST-C-04 adds sign-out on a guarded route (defect found in the browser, red `9f205c1` → green `6c99a5b`); TEST-SR2-03 sessions added | Team (AI-assisted) |
| v1.5 | 6 Nov 2026 | I-05 TDD record filled from real runs; TEST-F-01 … 05 server tests and TEST-C-06 client tests; TEST-SR3-01 boundary test with fixed clock; Playwright E2E spec deferred to I-12 | Team (AI-assisted) |
| v1.6 | 6 Nov 2026 | I-06 TDD record filled from real runs; TEST-B-01 … 03 rows describe the probe form for E-06 … E-11 and which Issue adds each real-endpoint case (contracts v1.5) | Team (AI-assisted) |
| v1.7 | 6 Nov 2026 | I-08 TDD record filled from real runs; TEST-G-01 / G-02 gain a component level (`Registration.test.tsx`) and move their E2E halves to I-12 (contracts v1.6) | Team (AI-assisted) |
| v1.8 | 6 Nov 2026 | I-07 TDD record filled from real runs; TEST-D-01 gains a component level (CreateEvent.test.tsx) and moves its E2E half to I-12 (contracts v1.7); real E-06 replaces probe in TEST-B-01 … 03; TEST-SR2-02 real E-06 case added | Praewa (MeldyRose) |
