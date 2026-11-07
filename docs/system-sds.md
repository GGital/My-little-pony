# System-Level Software Design Specification (SDS)

Project: **TCG Event Hub** · Document version: v0.5 (v0.2 reviewed in PR 2; changes in §14)
Inputs: [`srs.md`](srs.md) v0.5 · [`features.md`](features.md) v0.2 · [`traceability.md`](traceability.md) v0.2 ·
[`ui/design-direction.md`](ui/design-direction.md) v0.3 · [`diagrams/`](diagrams/README.md)

This is step 4 of the course design process. It fixes the decisions that **every** feature shares: the stack, how
the parts talk, the data model, the UI and API conventions, who may do what, how sign-in works, and how the app is
configured and deployed. Each Sprint feature contract (step 6) then adds only that feature's screens, endpoints,
fields and tests. Where a contract needs to break a rule here, this document changes first.

Design decisions are numbered `SD-nn`. Requirement IDs (FR, BR, NFR) and system responsibilities (SR) come from
the SRS and the feature inventory.

---

## 1. Design goals

| Goal | Why it matters here | Requirements |
|---|---|---|
| **Rules hold even when the screen is bypassed** | Hidden buttons are not security; capacity and duplicates must survive simultaneous requests | BR-05–BR-07, BR-17, NFR-01, NFR-02, NFR-05 |
| **One small, familiar stack** | Two students, four days to Sprint 1; reuse what worked in TokTickIT | C-01 |
| **Easy to ship in Lab 5** | One container, configuration only through environment variables | NFR-13, C-03 |
| **Every rule is testable on a real database** | Course requires API/database integration tests, not mocks | NFR-14, SR-07 |
| **Time is never ambiguous** | Start, deadline and check-in decisions are all time boundaries | NFR-11, SR-03 |

---

## 2. Architecture

![System architecture: browser, one container with API and services, PostgreSQL](diagrams/arch-system.png)

Source: [`diagrams/arch-system.html`](diagrams/arch-system.html)

TCG Event Hub is a **modular monolith in one container** (SD-01). The browser loads the built React app and then
calls the JSON API **on the same origin**. Inside the container, Express routes each request through a fixed chain
of guards. Domain services apply the business rules inside database transactions, and Prisma talks to PostgreSQL.

### 2.1 Components and responsibilities

| Component | Responsibility | Never does |
|---|---|---|
| **React app** (`client/`) | Screens, navigation per role, forms, loading/empty/error states, showing the server's decisions | Decide permissions, count seats, compare times for rules, store secrets |
| **Static file server** (Express, production only) | Serves the built React files; any unknown non-API path returns `index.html` so client routing works | Serve anything under `/api` |
| **API router + guards** (`server/src/http/`) | Parse JSON, load the session, check role and ownership, validate input with zod, map errors to the error shape | Contain business rules |
| **Domain services** (`server/src/domain/`) | Business rules (BR-01 … BR-20), transactions, seat locking, state changes, recording who did what | Read request objects or cookies; they receive a typed `actor` and typed input |
| **Clock** (`server/src/clock.ts`) | The single source of "now" (UTC). Tests replace it with a fixed clock | — |
| **Prisma client and migrations** (`server/prisma/`) | Schema, versioned migrations, queries, seed | — |
| **PostgreSQL 16** | Durable storage; **constraints that back the rules** (§4.3) | — |

### 2.2 How they communicate

| From → to | How | Notes |
|---|---|---|
| Browser → container | HTTPS (HTTP locally), same origin; `fetch` with `credentials: 'same-origin'` | The session cookie travels automatically; no tokens in JavaScript |
| Local development | Vite dev server on `:5173` proxies `/api` to Express on `:3000` | Same-origin behaviour preserved in development (as in TokTickIT) |
| API → services | Direct TypeScript function calls | One request = one service call = at most one transaction |
| Services → database | Prisma; `prisma.$transaction` for multi-step writes; one raw SQL statement for the seat lock | Parameterised queries only |

### 2.3 Request lifecycle and check order

Every protected request passes the same steps in the same order. This is how NFR-02's fixed check order
(401 → 403 → 404 → 409/422) is guaranteed:

```
 request ─► 1 parse JSON (≤ 100 kB) ─► 2 load session ─► 3 requireAuth ─► 4 requireRole ─► 5 validate (zod)
                                         (cookie → user)      401 UNAUTHENTICATED   403 FORBIDDEN   400 VALIDATION_FAILED
        ─► 6 service: find record + ownership ─► 7 service: business rules ─► 8 write in a transaction ─► response
                     404 …_NOT_FOUND                    409 / 422                     2xx
        any thrown error ─► 9 error handler ─► { "error": { code, message, details? } }   (500 hides internals)
```

Two notes on the order:
- **Public routes** (event list and detail, health) skip steps 3–4. They still load the session at step 2, so the
  detail page can tell a registered participant apart.
- **Path ids are validated before steps 3–4 only for public routes.** On protected routes a malformed id is a
  400 after authentication, so an anonymous caller can't probe the id format.

### 2.4 Where business rules are enforced

| Rule | Client (shows) | zod schema | Domain service | Database |
|---|---|---|---|---|
| BR-01 capacity 1–256 | form hint | `int().min(1).max(256)` | — | `CHECK (capacity BETWEEN 1 AND 256)` |
| BR-02 future start, end after start, ≤ 24 h | form hint | shape only | start > `clock.now()` | `CHECK (end_at > start_at AND end_at <= start_at + interval '24 hours')` |
| BR-03 required fields and lengths | field errors | lengths, required | — | `NOT NULL`, `varchar(n)` |
| BR-04 visibility and openness | button state from server | — | query filters + open check under lock | — |
| BR-05 capacity | seat chip | — | count active under row lock | — (count cannot be a static constraint; the lock serialises it) |
| BR-06 one active registration | "Registered" state | — | pre-check for a friendly 409 | **partial unique index** (§4.3) |
| BR-07 last seat | refresh count on 409 | — | `SELECT … FOR UPDATE` on the event row | — |
| BR-10, BR-13 role | navigation | — | — (step 4 guard) | — |
| BR-14, BR-16 ownership/privacy | — | — | owner filter in every query; display names only | `organizer_id`, `participant_id` foreign keys |
| BR-17 identity from session | never sends ids for self | `.strict()` rejects `userId`, `role`, `organizerId` | `actor` from session only | — |

---

## 3. Technology stack

| Layer | Choice | Version line | Why | Decision |
|---|---|---|---|---|
| Client | React + TypeScript + Vite | React 19, Vite 8, TS 6 | Same as TokTickIT; fast dev server and build | SD-02 |
| UI base | Bootstrap 5 re-themed with Arcane Ink tokens, IBM Plex Sans Thai + Chakra Petch, drawn SVG icon set | Bootstrap 5.3 | Grid, forms and focus basics for free; our tokens give the look | SD-06 |
| Routing | React Router | 7 | As in TokTickIT | — |
| Server | Node.js + Express + TypeScript (`tsx`) | Node 22, Express 5 | Same as TokTickIT; Express 5 forwards async errors | SD-02 |
| Validation | zod | 4.x (4.6.7) | One schema per endpoint: typed input, `.strict()` unknown-field rejection, field details for 400 | SD-05 |
| Database | PostgreSQL | 16 | Transactions, row locks, partial unique indexes, `timestamptz` | SD-04 |
| ORM and migrations | Prisma | 6 | Versioned migrations, typed queries, seed script; raw SQL allowed in migrations for checks and partial index | SD-04 |
| Passwords | scrypt (`node:crypto`) | built in | Reuses reviewed TokTickIT `password.ts`; no native dependency | SD-03 (D-15) |
| Tests | Vitest + Supertest (server), Vitest + Testing Library (client), Playwright (E2E) | Vitest 4.0 (4.0.18; 4.1 cannot be installed by npm 10) | Same as TokTickIT; real PostgreSQL in integration tests | SD-09 |
| Lint/format | oxlint, TypeScript `--noEmit` | — | Fast; already used by the client in TokTickIT | — |
| Container (Lab 5) | Docker multi-stage, `node:22-slim`, non-root user | — | One image for API and static files | SD-01 |

### 3.1 Repository layout

```
my-little-pony/
├─ client/                 React app (Vite)        src/{api,components,pages,routes,theme}
├─ server/                 Express API             src/{http,domain,clock.ts,config.ts,app.ts,index.ts}
│  └─ prisma/              schema.prisma, migrations/, seed.ts
├─ e2e/                    Playwright journeys (sprint-1/…)
├─ docs/                   SRS, features, traceability, this SDS, sprints/, ui/, diagrams/
├─ Dockerfile, .dockerignore          (Lab 5)
└─ README.md               setup, env vars, seed accounts, build and test commands
```

---

## 4. Data model

![Data model: User, Session, Event, Registration, EventChange, LoginAttempt](diagrams/er-data-model.png)

Source: [`diagrams/er-data-model.html`](diagrams/er-data-model.html). Tag on each entity = sprint that adds it.

### 4.1 Entities and fields

All ids are auto-increment integers. Authorization never depends on ids being hard to guess (§6). All times are
`timestamptz` stored in UTC (NFR-11).

**User** *(Sprint 1, seeded only — X-01)*

| Field | Type | Constraints |
|---|---|---|
| `id` | int | PK |
| `email` | varchar(254) | unique; stored lower-case |
| `displayName` | varchar(40) | not null; the only personal field organizers see (D-14) |
| `passwordHash` | text | `scrypt$N$r$p$salt$hash` (SD-03); never selected by API queries |
| `role` | enum `PARTICIPANT` \| `ORGANIZER` | not null (D-05) |
| `createdAt` | timestamptz | default now |

**Session** *(Sprint 1)*

| Field | Type | Constraints |
|---|---|---|
| `id` | char(64) | PK = **SHA-256 of the cookie token** (the token itself is never stored, SD-07) |
| `userId` | int | FK → User, cascade delete; index |
| `createdAt` | timestamptz | default now |
| `expiresAt` | timestamptz | `createdAt + 8 h`, absolute (NFR-04); index |

**Event** *(Sprint 1; extra fields in Sprint 2)*

| Field | Type | Constraints | Sprint |
|---|---|---|---|
| `id` | int | PK | 1 |
| `organizerId` | int | FK → User (must be an organizer); index; **owner** of the event | 1 |
| `title` | varchar(100) | 3–100 chars (BR-03) | 1 |
| `type` | enum `CASUAL` \| `TOURNAMENT` \| `RELEASE` | not null | 1 |
| `format` | enum `CONSTRUCTED` \| `SEALED` \| `DRAFT` | not null | 1 |
| `venueName`, `venueAddress`, `city` | varchar(80), varchar(200), varchar(60) | not null | 1 |
| `startAt`, `endAt` | timestamptz | `CHECK` end > start and ≤ start + 24 h (BR-02) | 1 |
| `capacity` | int | `CHECK` 1–256 (BR-01) | 1 |
| `feeLabel`, `structureNote`, `contact` | varchar(40), varchar(80), varchar(120) | nullable | 1 |
| `description` | varchar(2000) | nullable; displayed as text only (NFR-15) | 1 |
| `status` | enum `DRAFT` \| `PUBLISHED` \| `CANCELLED` | Sprint 1 always writes `PUBLISHED` (D-06) | 1 |
| `publishedAt` | timestamptz | set when published | 1 |
| `registrationDeadline` | timestamptz | nullable = start time; `CHECK` ≤ `startAt` (BR-08) | 2 |
| `cancelledAt`, `cancelledById`, `cancelReason` | timestamptz, int FK, varchar(200) | all null or all set (BR-12, FR-28) | 2 |
| `seedKey` | varchar(40) | unique, nullable; set only by the seed so re-runs find their rows (Sprint 1 contracts §1) | 1 |
| `createdAt`, `updatedAt` | timestamptz | — | 1 |

Index: `(status, startAt)` for the upcoming list (FR-11, NFR-12).

**Registration** *(Sprint 1; extra fields in Sprints 2–3)*

| Field | Type | Constraints | Sprint |
|---|---|---|---|
| `id` | int | PK | 1 |
| `eventId` | int | FK → Event; index | 1 |
| `participantId` | int | FK → User (must be a participant); index | 1 |
| `status` | enum `REGISTERED` \| `CHECKED_IN` \| `CANCELLED` \| `EVENT_CANCELLED` | not null | 1 (all values defined now) |
| `createdAt` | timestamptz | the registration time shown to organizers | 1 |
| `cancelledAt` | timestamptz | set with `CANCELLED` / `EVENT_CANCELLED` | 2 |
| `checkedInAt`, `checkedInById` | timestamptz, int FK | set with `CHECKED_IN`; cleared on undo | 3 |

"Active" means `status IN ('REGISTERED','CHECKED_IN')` (SRS §4). `NO_SHOW` is **not stored**. It is derived in
reports for `REGISTERED` rows of ended events (BR-20).

**EventChange** *(Sprint 2, FR-28)*: `id`, `eventId` FK, `changedById` FK, `field` (`capacity` \| `deadline` \|
`details` \| `status`), `oldValue`, `newValue` (text), `changedAt`. Append-only; never updated or deleted (X-11).

**LoginAttempt** *(Sprint 3, NFR-16)*: `id`, `email` (lower-case, no FK so unknown emails are throttled too),
`succeeded` boolean, `attemptedAt`. Index `(email, attemptedAt)`. Kept in the database (not memory) so throttling
survives restarts and works with more than one Cloud Run instance.

### 4.2 Relationships and ownership

| Relationship | Cardinality | Ownership meaning |
|---|---|---|
| User (organizer) → Event | 1 : N | `Event.organizerId` is the **only** thing that makes an organizer an owner (BR-14) |
| User (participant) → Registration | 1 : N | `Registration.participantId` is the **only** thing that makes a registration "own" (BR-16) |
| Event → Registration | 1 : N | Seats used = count of active registrations of the event |
| User → Session | 1 : N | A user may be signed in on several devices; sign-out deletes one session |
| Event → EventChange | 1 : N | Change history shown to the owner only |

### 4.3 Constraints that back the rules (raw SQL in migrations)

Prisma cannot express these in `schema.prisma`, so migration `0002_rule_constraints` adds them as SQL (SD-04):

```sql
ALTER TABLE "Event" ADD CONSTRAINT event_capacity_range CHECK (capacity BETWEEN 1 AND 256);
ALTER TABLE "Event" ADD CONSTRAINT event_time_window
  CHECK ("endAt" > "startAt" AND "endAt" <= "startAt" + interval '24 hours');
-- BR-06: at most one ACTIVE registration per participant per event; cancelled rows may repeat (FR-20)
CREATE UNIQUE INDEX registration_one_active
  ON "Registration" ("eventId", "participantId")
  WHERE status IN ('REGISTERED', 'CHECKED_IN');
```

### 4.4 Registration transaction (BR-05, BR-06, BR-07, NFR-05)

Registration is the one place where two requests can race. The service runs:

```
BEGIN
  SELECT id, status, "startAt", capacity FROM "Event" WHERE id = $1 FOR UPDATE;   -- one writer per event at a time
  -- missing → 404 EVENT_NOT_FOUND · not PUBLISHED or started → 409 REGISTRATION_CLOSED
  SELECT 1 FROM "Registration" WHERE "eventId" = $1 AND "participantId" = $2 AND status IN (active)
  -- found → 409 ALREADY_REGISTERED
  SELECT count(*) FROM "Registration" WHERE "eventId" = $1 AND status IN (active)
  -- count ≥ capacity → 409 EVENT_FULL
  INSERT INTO "Registration" (...) VALUES (..., 'REGISTERED')
  -- unique violation (same participant racing themselves) → 409 ALREADY_REGISTERED
COMMIT
```

The row lock queues simultaneous registrations **for the same event**, so the count each one sees is exact.
Registrations for different events don't block each other. The partial unique index is the second safety net
for the same participant. Isolation level stays at PostgreSQL's default (READ COMMITTED), because the lock already
gives the ordering we need (SD-08).

### 4.5 Migrations and seed data

| Item | Design |
|---|---|
| Migrations | `prisma migrate dev` locally, `prisma migrate deploy` in CI and Lab 5. Each schema change is one migration committed with the feature that needs it. Migrations are never edited after merge |
| Seed (`server/prisma/seed.ts`) | **Idempotent**: upserts users by email and events by `seedKey`, so running it twice creates nothing new (NFR-06, AC-SR1-02). The exact accounts and events are listed in Sprint 1 contracts §0.3 |
| Seed contents | 2 organizers (Quantum Cards, Dragon's Den), 4 participants (one with no registrations, for empty states), 6 events: open with seats, almost full, full, already started, one per organizer at least, plus a 1-seat event for the concurrency demo |
| Seed password | Read from the `SEED_PASSWORD` environment variable. `.env.example` holds a placeholder only. The README tells testers to choose their own local value. No real password is in Git or the PDF |
| Test database | A separate database (`DATABASE_URL_TEST`). Integration tests run migrations once, then truncate tables before each test file |

---

## 5. UI conventions

The full visual system is in [`ui/design-direction.md`](ui/design-direction.md) v0.3 (Arcane Ink theme, voice,
the "seat secured" moment, icon and browser rules). This section fixes the structure.

### 5.1 Screens and navigation

| Route | Screen | Who | Sprint |
|---|---|---|---|
| `/events` | Find an Event (list) | everyone | 1 (filters 2) |
| `/events/:id` | Event detail with the action button | everyone | 1 |
| `/login` | Sign in (`?returnTo=` internal paths only) | visitors | 1 |
| `/me/registrations` | My Events | participants | 1 |
| `/organizer` | Organizer dashboard (own events) | organizers | 1 |
| `/organizer/events/new` | Create and publish event | organizers | 1 (draft 2) |
| `/organizer/events/:id/registrations` | Registration list | owning organizer | 1 (check-in 3) |
| `/organizer/events/:id/edit` | Edit, capacity, deadline, cancel | owning organizer | 2 |
| `/organizer/events/:id/attendance`, `/organizer/summary`, `/me/history` | Reports and history | owner / participant | 3 |
| `*` | Not found | everyone | 1 |

Route guards (design-direction §4.3) send signed-out users to `/login?returnTo=…` and show "Not available" for the
wrong role. They exist only for convenience. The server repeats every check.

### 5.2 Shared UI behaviour

| Concern | Convention |
|---|---|
| Data loading | One `api` module wraps `fetch`: same-origin credentials, JSON in and out, and it turns the error shape into a typed `ApiError` |
| Loading | Skeleton cards for lists; a spinner and disabled control for actions (`aria-busy`) |
| Empty | Named, with one next action ("You haven't registered for any events yet" → Find an Event) |
| Error | An inline alert with the server's message and **Try again**. A 401 anywhere clears the cached user and goes to sign-in with `returnTo` |
| Forms | Labels always visible; field errors from `error.details` shown under each field; submit disabled while saving; input kept on error |
| Time display | `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok' })` in one `formatEventTime()` helper. The client never compares times to decide rules |
| Text | All user text rendered through React (escaped); `dangerouslySetInnerHTML` is banned by lint (NFR-15) |
| Responsive | Breakpoints 390 / 768 / 1440; no horizontal page scroll (NFR-08) |
| Accessibility | Visible focus ring, keyboard paths, live region for registration result (NFR-10 in Sprint 3; good habits from Sprint 1) |

---

## 6. API conventions

### 6.1 General rules

| Rule | Convention |
|---|---|
| Base path | `/api`; resources are plural nouns; personal resources under `/api/me`, organizer-only under `/api/organizer` |
| Methods | `GET` reads only (never changes data, NFR-15); `POST` creates or performs an action; `PATCH` partial update; `DELETE` removes a check-in only (records are never deleted, X-11) |
| Format | JSON, UTF-8; request bodies ≤ 100 kB; `Content-Type: application/json` required on bodies (else 415) |
| Ids | Positive integers in the path, validated (`400 INVALID_PATH_PARAMETER`) |
| Times | ISO 8601 UTC strings (`2026-11-05T10:00:00.000Z`); the server converts nothing to local time |
| Success shape | A single resource is the object itself. A list is `{ "items": [...], "meta": { "page", "pageSize", "totalItems" } }`. Sprint 1 lists are unpaged but keep `items` |
| Created | `201` with the created resource; `204` for sign-out |
| Validation | zod `.strict()` schemas: wrong types, out-of-range values and **unknown fields** → `400 VALIDATION_FAILED` with `details: [{ field, message }]` |
| Errors | Always `{ "error": { "code", "message", "details?" } }` (NFR-07). The code fixes the status. Messages are safe to show. `500` is always "Something went wrong" with the real error logged server-side only |
| Origin check | State-changing requests (`POST/PATCH/DELETE`) must carry an `Origin` header equal to `APP_ORIGIN`, otherwise `403 FORBIDDEN` (cross-site request defence alongside SameSite=Lax). It runs **right after `requireAuth`** (step 3), so a signed-out caller still gets 401 first (NFR-01). Sign-in (E-01) also checks it. Tests send the header explicitly |
| Viewer-aware fields | Responses that depend on who asks (for example `viewer.action` on event detail) are computed by the server; the client never derives them |

### 6.2 Error code catalogue

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Body or query fails its schema |
| 400 | `INVALID_PATH_PARAMETER` | Path id is not a positive integer |
| 401 | `UNAUTHENTICATED` | No session, expired session, or signed out |
| 401 | `INVALID_CREDENTIALS` | Sign-in failed (one message for unknown email and wrong password, FR-02) |
| 403 | `FORBIDDEN` | Signed in but wrong role, or failed origin check |
| 404 | `EVENT_NOT_FOUND`, `REGISTRATION_NOT_FOUND`, `NOT_FOUND` | Does not exist, **or belongs to someone else** (D-08) |
| 409 | `EVENT_FULL` | No seats left (BR-05) |
| 409 | `ALREADY_REGISTERED` | Active registration exists (BR-06) |
| 409 | `REGISTRATION_CLOSED` | Event started, not published, cancelled, or (Sprint 2) past its deadline (BR-04, BR-08) |
| 409 | `CAPACITY_BELOW_REGISTERED`, `EVENT_STARTED`, `ALREADY_CANCELLED`, `NOT_IN_CHECK_IN_WINDOW`, `ALREADY_CHECKED_IN` | Sprint 2–3 rule conflicts (BR-09, BR-15, BR-12, BR-18, BR-19) |
| 413 | `PAYLOAD_TOO_LARGE` | Request body over 100 kB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Body without JSON content type (a request with no body is not checked) |
| 422 | `EVENT_TIME_INVALID` | Valid shape but impossible times: start not in the future, end too late (BR-02) |
| 429 | `TOO_MANY_ATTEMPTS` | Sign-in throttled (NFR-16, Sprint 3) |
| 500 | `INTERNAL_ERROR` | Anything unexpected |

### 6.3 Endpoint catalogue

The Sprint 1 feature contracts give the exact request and response bodies. This catalogue fixes each endpoint's
path, method, guard and owner feature.

| # | Method and path | Guard | Feature | Sprint |
|---|---|---|---|---|
| E-01 | `POST /api/auth/login` | public | A | 1 |
| E-02 | `POST /api/auth/logout` | signed in | A | 1 |
| E-03 | `GET /api/auth/me` | signed in | A | 1 |
| E-04 | `GET /api/events` | public | F (filters J) | 1 |
| E-05 | `GET /api/events/:id` | public (viewer-aware) | F | 1 |
| E-06 | `POST /api/events` | organizer | D | 1 |
| E-07 | `GET /api/organizer/events` | organizer | E | 1 |
| E-08 | `GET /api/organizer/events/:id/registrations` | organizer + owner | I | 1 |
| E-09 | `POST /api/events/:id/registrations` | participant | G | 1 |
| E-10 | `GET /api/me/registrations` | participant | H | 1 |
| E-11 | `GET /api/me/registrations/:id` | participant + own | H | 1 |
| E-12 | `GET /api/health` | public | SR-04 | 1 |
| E-13 | `PATCH /api/organizer/events/:id` | organizer + owner | K, L, M | 2 |
| E-14 | `POST /api/organizer/events/:id/publish` | organizer + owner | K | 2 |
| E-15 | `POST /api/organizer/events/:id/cancel` | organizer + owner | O | 2 |
| E-16 | `POST /api/me/registrations/:id/cancel` | participant + own | N | 2 |
| E-17 | `GET /api/organizer/events/:id/changes` | organizer + owner | SR-08 | 2 |
| E-18 | `POST /api/organizer/registrations/:id/check-in` | organizer + owner of its event | P | 3 |
| E-19 | `DELETE /api/organizer/registrations/:id/check-in` | organizer + owner of its event | P | 3 |
| E-20 | `GET /api/organizer/events/:id/attendance` | organizer + owner | Q | 3 |
| E-21 | `GET /api/organizer/summary?from&to` | organizer | R | 3 |
| E-22 | `GET /api/me/history` | participant | S | 3 |

---

## 7. Roles, permissions and record access

### 7.1 Role and permission matrix

Rows are operations. Each cell shows the result for that caller. **"own"** = the caller owns the record. Every
cell is enforced by the server and covered by the permission-matrix test (AC-B-03). Hiding a control in the UI is
never the enforcement.

| Operation (endpoint) | Visitor | Participant | Organizer (owner) | Organizer (not owner) |
|---|---|---|---|---|
| Sign in (E-01) | ✓ | ✓ | ✓ | ✓ |
| Sign out, who am I (E-02, E-03) | 401 | ✓ | ✓ | ✓ |
| List / view published or cancelled events (E-04, E-05) | ✓ | ✓ | ✓ | ✓ |
| View a draft event (E-05, Sprint 2) | 404 | 404 | ✓ | 404 |
| Create event (E-06) | 401 | 403 | ✓ | ✓ (becomes owner) |
| Own events dashboard (E-07) | 401 | 403 | ✓ own only | ✓ own only |
| Registration list of an event (E-08) | 401 | 403 | ✓ | 404 |
| Register for an event (E-09) | 401 | ✓ (BR-04–BR-07) | 403 | 403 |
| My registrations (E-10) | 401 | ✓ own only | 403 | 403 |
| One registration (E-11) | 401 | ✓ own · 404 others | 403 | 403 |
| Edit / publish / cancel event (E-13–E-15, Sprint 2) | 401 | 403 | ✓ | 404 |
| Cancel registration (E-16, Sprint 2) | 401 | ✓ own · 404 others | 403 | 403 |
| Change history (E-17, Sprint 2) | 401 | 403 | ✓ | 404 |
| Check in / undo (E-18, E-19, Sprint 3) | 401 | 403 | ✓ | 404 |
| Attendance report (E-20, Sprint 3) | 401 | 403 | ✓ | 404 |
| Organizer summary (E-21, Sprint 3) | 401 | 403 | ✓ own events only | ✓ own events only |
| My history (E-22, Sprint 3) | 401 | ✓ own only | 403 | 403 |

### 7.2 What each role may see in a record

| Data | Visitor / other participants | The participant themself | Owning organizer | Other organizers |
|---|---|---|---|---|
| Event public fields, registered/capacity | ✓ | ✓ | ✓ | ✓ |
| Who registered | ✗ | own registration only | display name, time, status | ✗ |
| Participant email | ✗ | own (in `/auth/me`) | ✗ (D-14) | ✗ |
| Event change history, cancel reason by whom | ✗ (reason text shown publicly on a cancelled event) | ✗ | ✓ | ✗ |
| `passwordHash`, session ids | never returned to anyone | | | |

---

## 8. Authentication and sessions

| Concern | Design |
|---|---|
| Credentials | Email (trimmed, lower-cased) and password over HTTPS (Lab 5) or localhost. Body validated by zod |
| Password storage | scrypt, N = 2^15, r = 8, p = 1, 16-byte random salt, 64-byte key; format `scrypt$N$r$p$salt$hash`; compared with `timingSafeEqual` (reused from TokTickIT `password.ts`, SD-03) |
| Unknown email | Verified against a dummy hash so it takes the same time as a wrong password; same `INVALID_CREDENTIALS` message (FR-02) |
| Session creation | On success: 32 random bytes → base64url token (43 chars). Its SHA-256 is stored as `Session.id` with `expiresAt = now + 8 h`. Expired sessions of that user are deleted at the same time |
| Cookie | `tcg.sid=<token>`; `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28800`, `Secure` when `NODE_ENV=production` |
| Current user | Every request: hash the cookie token, look up an unexpired session, attach `req.actor = { id, role, displayName }`. Bad format, unknown or expired → treated as signed out |
| `GET /api/auth/me` | Returns `{ id, displayName, email, role }`, or 401 |
| Expiry | **Absolute** 8 hours from sign-in, not extended by activity (NFR-04). After expiry, every protected call is 401 and the UI goes to sign-in |
| Sign-out | Deletes the session row and sends an expired cookie; returns 204. The old token then fails every check (AC-A-04) |
| Cross-site requests | SameSite=Lax cookie + Origin check on state-changing methods + no state change by GET (NFR-15) |
| Throttling (Sprint 3) | `LoginAttempt` rows: 5 failures for one email in 10 minutes → 429 for 10 minutes (NFR-16) |
| Session table cleanup | Expired rows removed at sign-in and by the seed/maintenance script. Volume is tiny at our scale |

The full flow is in diagram D2 ([`diagrams/seq-auth.png`](diagrams/seq-auth.png)).

---

## 9. Configuration, secrets and delivery

### 9.1 Environment variables

| Variable | Example (`.env.example`) | Used by | Secret? |
|---|---|---|---|
| `NODE_ENV` | `development` | server | no |
| `PORT` | `3000` (Cloud Run sets it) | server | no |
| `DATABASE_URL` | `postgresql://tcg:CHANGE_ME@localhost:5432/tcg_event_hub` | server, Prisma | **yes** (password) |
| `DATABASE_URL_TEST` | `postgresql://tcg:CHANGE_ME@localhost:5432/tcg_event_hub_test` | tests | yes |
| `APP_ORIGIN` | `http://localhost:5173` | origin check, cookie `Secure` decision | no |
| `SEED_PASSWORD` | `CHANGE_ME_LOCAL_ONLY` | seed script | yes (local only) |
| `LOG_LEVEL` | `info` | server | no |
| `TRUST_PROXY` | `1` on Cloud Run | Express `trust proxy` for correct protocol | no |

Rules:
- `config.ts` reads and validates every server variable at start-up with zod, and **refuses to start** with a
  one-line message naming the variable (never its value) if `DATABASE_URL` or `APP_ORIGIN` is missing or any value
  is malformed. `NODE_ENV`, `PORT`, `LOG_LEVEL` and `TRUST_PROXY` default to the examples above (`TRUST_PROXY` to 0).
  `DATABASE_URL_TEST` and `SEED_PASSWORD` are read by the tests and the seed script only.
- `index.ts` checks the configuration **before** loading Prisma, because `@prisma/client` reads `server/.env` when
  it is imported and would otherwise hide a missing `DATABASE_URL`.
- Real values live only in local `.env` files, which `.gitignore` excludes, and in GCP Secret Manager (Lab 5).
- The client has **no secrets**. Vite only exposes `VITE_*` variables, and we define none in Sprint 1.
- A secret scan of the repository (gitleaks or the GitHub secret scanner) is part of the release checklist
  (AC-SR4-01).

### 9.2 Health check

`GET /api/health` runs `SELECT 1`. It returns `200 { "status": "ok" }`, or `503 { "status": "unavailable" }`
when the database cannot be reached. Lab 5 uses it as the Cloud Run startup and liveness probe.

### 9.3 Planned GCP deployment (built in Lab 5)

```
 GitHub (main) ──► CI: build + test ──► Artifact Registry (image) ──► Cloud Run job: prisma migrate deploy
                                                                  └─► Cloud Run service: tcg-event-hub
 Browser ──HTTPS──► Cloud Run service (Express: /api + static) ──Cloud SQL connector──► Cloud SQL PostgreSQL 16
                                    ▲ secrets from Secret Manager (DATABASE_URL, SEED_PASSWORD)
```

| Part | Plan | Why |
|---|---|---|
| Image | Multi-stage Dockerfile: build client → build server → `node:22-slim` runtime, non-root, only production dependencies | Small and reproducible |
| Runtime | Cloud Run service, 1 container, min instances 0–1, listens on `$PORT` | Simple; same-origin cookie |
| Database | Cloud SQL for PostgreSQL 16 with automated backups | **Durable storage**: data survives restarts and redeploys (NFR-06) |
| Migrations | Run `prisma migrate deploy` as a separate Cloud Run job before routing traffic to a new revision | Never migrate from many instances at once |
| Secrets | Secret Manager mounted as environment variables | Nothing secret in the image or Git |
| Logs | JSON lines to stdout → Cloud Logging; never passwords, tokens or cookies | NFR-03 |
| Pipeline | GitHub Actions: on PR run lint, type-check, unit, integration (Postgres service container) and build; on merge to `main`, build the image and deploy after manual approval | Spec §5.3: failed checks block the release path |

---

## 10. Testing architecture

| Level | Tool | Runs against | Covers |
|---|---|---|---|
| Unit (U) | Vitest | pure functions with a fixed clock | Rule helpers, time boundaries, password hashing, attendance maths |
| API + database integration (I) | Vitest + Supertest | the real Express app + a real PostgreSQL test database | Every endpoint, permission matrix, persistence, constraints, concurrency |
| Component (E) | Vitest + Testing Library | jsdom | Loading/empty/error states, forms, header and route guards |
| End-to-end (E) | Playwright | running app + seeded database, at 390 / 768 / 1440 px | Critical journeys: sign in → register → My Events; organizer publish → registrations; rejection; sign-out |

Design points:
- **Concurrency test (AC-G-06):** create an event with 1 seat left, fire 20 registration requests with
  `Promise.all` from 20 signed-in participants, then assert exactly one `201`, nineteen `409 EVENT_FULL`, and
  active count = capacity.
- **Fixed clock:** `clock.ts` exports `now()`. Tests set it so boundaries (exactly at, 1 minute before or after)
  are exact (AC-SR3-01).
- **No mocks for persistence:** integration tests never mock Prisma (course rule: "mock-only persistence is not
  evidence").
- **Commands** (README): `npm --prefix server test`, `npm --prefix client test`, `npx playwright test`, plus
  `npm run build` for both. Results are recorded with the commit id for Part F.

---

## 11. Design decisions

| ID | Decision | Alternatives considered | Reason | Linked |
|---|---|---|---|---|
| SD-01 | One container: Express serves `/api` and the built React app | Two Cloud Run services | Same origin, so no CORS and no cross-site cookie settings; one image for Lab 5 | NFR-13, C-03 |
| SD-02 | TokTickIT stack (React 19 + Vite, Express 5, Prisma 6, PostgreSQL 16, Vitest, Playwright) | Next.js; NestJS | Both students already know it; patterns reusable | C-01 |
| SD-03 | scrypt via `node:crypto`, reusing TokTickIT code | bcrypt | No native dependency; reviewed parameters | NFR-03, D-15 |
| SD-04 | Rules that can be constraints are constraints, added by raw SQL in migrations | Application checks only | Defence even against bugs or future code paths | BR-01, BR-02, BR-06 |
| SD-05 | zod `.strict()` schema per endpoint, shared types | Hand-written checks | Unknown-field rejection and field details for free | NFR-15, NFR-07 |
| SD-06 | Bootstrap 5 re-themed with Arcane Ink tokens; Chakra Petch + IBM Plex Sans Thai; drawn SVG icons | Plain CSS; another UI kit | Fast, accessible basics; Thai-capable fonts | NFR-08–NFR-10 |
| SD-07 | Server-side sessions in PostgreSQL; only the SHA-256 of the token is stored | JWT in local storage; raw token in the database | Real sign-out (NFR-04); a database leak does not leak live sessions | NFR-04, D-11 |
| SD-08 | Row lock `SELECT … FOR UPDATE` on the event + partial unique index | SERIALIZABLE transactions with retry; a counter column | Exact and simple; per-event queueing only | BR-05–BR-07, NFR-05 |
| SD-09 | Integration tests on a real PostgreSQL test database, truncated per file | Mocked Prisma; SQLite | Course requires real persistence evidence; same SQL features as production | NFR-14 |
| SD-10 | Domain services receive a typed `actor` and never see `req` | Rules inside route handlers | Rules are unit-testable and cannot read client-sent identity | BR-17 |

## 12. SDS → requirement coverage

| SDS section | Satisfies |
|---|---|
| §2 Architecture, §2.3 check order, §2.4 rule placement | NFR-02 (order), BR-17, SR-02 |
| §4 Data model, §4.3 constraints, §4.4 transaction, §4.5 migrations and seed | BR-01–BR-07, NFR-05, NFR-06, SR-01, FR-28 (Sprint 2) |
| §5 UI conventions | FR-05, FR-26, FR-27, NFR-08, NFR-09, NFR-11 (display), NFR-15 (escaping) |
| §6 API conventions and catalogue | NFR-07, NFR-15, FR-01–FR-25 endpoint ownership |
| §7 Permission matrix | BR-10, BR-13, BR-14, BR-16, NFR-01, NFR-02 |
| §8 Authentication | FR-01–FR-04, NFR-03, NFR-04, NFR-16 |
| §9 Configuration and delivery | NFR-13, SR-04, C-03 |
| §10 Testing | NFR-14, SR-07 |

## 13. Open issues

| ID | Issue | Plan |
|---|---|---|
| OI-01 | Exact Lab 5 GCP resources (project, region, access) are given in the Lab 5 handout | Keep §9.3 as the plan; adjust names when the handout arrives |
| OI-02 | Q-01 (public event list) and Q-02 (TCG context) still need the TA's confirmation | No design change expected; if the list must be private, E-04/E-05 gain the "signed in" guard |

## 14. Change log

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 4 Nov 2026 | First draft: architecture, stack, data model with constraints and seat-lock transaction, UI and API conventions, endpoint catalogue E-01 … E-22, permission matrix, session design, configuration and GCP plan, testing architecture, SD-01 … SD-10 | Team (AI-assisted) |
| v0.2 | 4 Nov 2026 | `Event.seedKey` added for the idempotent seed (Sprint 1 contracts §1); seed reference to contracts §0.3 | Team (AI-assisted) |
| v0.3 | 4 Nov 2026 | §4.3 names the migration that holds the constraints (`0002_rule_constraints`, from I-01) | Team (AI-assisted) |
| v0.4 | 5 Nov 2026 | §6.2 adds `413 PAYLOAD_TOO_LARGE`; §3 zod 4.x (zod 3 has advisory GHSA-mrhx-c7xc-m3w5) and Vitest 4.0.18; §9.1 which variables are required, defaults, and config check before Prisma loads (from I-02) | Team (AI-assisted) |
| v0.5 | 7 Nov 2026 | Inputs and §7 point at design-direction v0.3 (built app brought to the UI document, PR #24) | Team (AI-assisted) |
