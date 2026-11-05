# TCG Event Hub — Event Registration and Attendance System

CPE 334 group project (Theme 3: Event Registration and Attendance System), Semester 1/2026.

A full-stack application where trading-card-game (TCG) stores and organizers publish events with limited seats,
players find and register for them, and organizers record attendance.

Engineering documents live in [`docs/`](docs/): start with the [SRS](docs/srs.md), the
[System-Level SDS](docs/system-sds.md) and the [Sprint 1 package](docs/sprints/sprint-1/README.md).

## Prerequisites

- Node.js 22 or later, npm 10 or later
- PostgreSQL 16, with **two** databases: one for development and one for tests

## Server setup (Sprint 1, so far)

```bash
cd server
npm install
cp .env.example .env
```

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

## Tests

Prepare the test database (applies migrations only, never deletes data), then run the suite:

```bash
npm run db:migrate:test
npm test
```

To rebuild the test database from scratch, run `npm run db:reset:test` (this **deletes all data in the test
database**). Both commands refuse to run when `DATABASE_URL_TEST` is missing or equal to `DATABASE_URL`.

Type check: `npm run typecheck`.
