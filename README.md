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

## Server setup (Sprint 1, so far)

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
