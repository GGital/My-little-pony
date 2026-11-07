# TCG Event Hub — Event Registration and Attendance System

CPE 334 group project (Theme 3: Event Registration and Attendance System), Semester 1/2026.

A full-stack application where trading-card-game (TCG) stores and organizers publish events with limited seats,
players find and register for them, and organizers record attendance.

Engineering documents live in [`docs/`](docs/): start with the [SRS](docs/srs.md), the
[System-Level SDS](docs/system-sds.md) and the [Sprint 1 package](docs/sprints/sprint-1/README.md). Who did
what is in the [contribution table](docs/contributions.md); AI assistance is in the [AI-use declaration](docs/ai-use.md).

## Prerequisites

- Node.js 22 or later, npm 10 or later
- PostgreSQL 16, with **two** databases: one for development and one for tests

## Server setup

```bash
cd server
npm install
npm run db:generate
cp .env.example .env
```

`npm run db:generate` builds the Prisma client. npm 11 blocks Prisma's install script, so without it the seed
fails with `@prisma/client did not initialize yet`.

Edit `server/.env` with your own values (it is git-ignored). `DATABASE_URL_TEST` must point at a separate test
database: the tests empty every table in it.

Apply the migrations and load the demo data:

```bash
npm run db:deploy
npm run db:seed
```

The seed is safe to run again (it creates nothing the second time). It adds the accounts and events listed in
[Sprint 1 contracts §0.3](docs/sprints/sprint-1/feature-contracts.md). Every demo account uses the password you put
in `SEED_PASSWORD`:

| Role | Emails |
|---|---|
| Organizer | `quantum@organizer.example`, `dragon@organizer.example` |
| Participant | `mint@player.example`, `ploy@player.example`, `boss@player.example`, `nok@player.example` |

## Run the API

```bash
npm run dev
```

The API listens on `http://localhost:3000` (set `PORT` to change it). Check it with
`curl http://localhost:3000/api/health`, which answers `{"status":"ok"}`, or `503 {"status":"unavailable"}` when
the database is down.

The server checks `server/.env` when it starts and stops with a one-line message naming any missing or malformed
variable. Every variable is described in `server/.env.example` and in the
[SDS §9.1](docs/system-sds.md). `DATABASE_URL` and `APP_ORIGIN` are required; the others have defaults.

## Run the app (API + client)

In one terminal, `cd server && npm run dev`. In a second one:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server forwards `/api` to the API on port 3000, so the session cookie
is same-origin. **Sign in** with a demo account above and the `SEED_PASSWORD` you chose. The session lasts 8 hours
from sign-in; **Sign out** in the header menu ends it on the server.

## Tests

Prepare the test database (applies migrations only, never deletes data), then run the suite:

```bash
npm run db:migrate:test
npm test
```

To rebuild the test database from scratch, run `npm run db:reset:test` (this **deletes all data in the test
database**). Both commands refuse to run when `DATABASE_URL_TEST` is missing or equal to `DATABASE_URL`.

Type check: `npm run typecheck`.

Client tests and build: `cd client && npm test && npm run build`.

## End-to-end tests (Playwright)

From the repository root, once:

```bash
npm install
npx playwright install chromium
```

Then run the suite (`server/.env` must be set up as above, and the server suite must not be running at the same
time, because both use the test database):

```bash
npm run e2e
```

It starts its own API on port 3100 and client on port 5174 against the **test** database, loads a fresh demo seed
before each file, and signs in with your `SEED_PASSWORD`. It covers the Sprint 1 journeys, the end-to-end halves of
the feature tests, and the three-width check, which saves screenshots in `docs/sprints/sprint-1/evidence/responsive/`.
Open the report of the last run with `npx playwright show-report`.

## Release checks

```bash
npm run sts:check
```

checks that every Sprint 1 acceptance criterion has a test with a recorded result in the
[STS](docs/sprints/sprint-1/sts.md), and that every business rule has a rejection test.

```bash
npm run secret:scan
```

searches every commit and the evidence files for your local secret values and common key shapes, printing only
where something was found, never the value. The Sprint 1 results are in [STS §6](docs/sprints/sprint-1/sts.md).
