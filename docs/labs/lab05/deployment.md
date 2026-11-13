# Lab 5 deployment: TCG Event Hub on Google Cloud

Version v0.2 (L5-2 [#31](https://github.com/GGital/My-little-pony/issues/31), L5-3 [#32](https://github.com/GGital/My-little-pony/issues/32)). Each later Lab 5 Issue fills in its
own section: Docker (#32), CI (#33), GCP resources (#34), sign-in from GitHub and the merge gate (#35), release
procedure (#36), persistence and rollback (#37). The rest is finished in #38. Sections marked *planned* describe
the design and are not built yet.

## 1. Stack and changes from the reference kit

The reference stack is the Lab 5 Starter Kit (TokTickIT): Artifact Registry, Cloud Run, Cloud SQL for PostgreSQL,
Secret Manager and GitHub Actions with Workload Identity Federation. We keep it, with these changes:

| Change from the kit | Reason |
|---|---|
| **One container** serves `/api` and the built React app (`client/dist`), with `index.html` for client-side routes. The kit's `client/Dockerfile` and nginx image are not used | SD-01: same origin, so no CORS and no cross-site cookie settings |
| The server runs TypeScript with `tsx`; there is no `dist/` build. `prisma` and `tsx` are runtime dependencies | The Sprint 1 server has `noEmit` and starts with `tsx`; the migration job needs the Prisma CLI and the `tsx` seed in the same image |
| `GET /api/ready` answers `{"status":"ready","db":"connected"}` or 503 | The kit's smoke test reads that shape; `/api/health` keeps the Sprint 1 shape (E-12) |
| `APP_ORIGIN` may list several origins, comma-separated | Cloud Run answers on two URLs (the deterministic `…-<project number>.<region>.run.app` one and `status.url`); the origin check must accept both |
| One seed secret (`SEED_PASSWORD`) instead of the kit's admin and demo passwords | Our seed always creates the six Sprint 1 demo accounts (2 organizers, 4 participants), which Lab 6 UAT needs; there is no admin account |
| npm scripts use `--env-file-if-exists=.env` | The container and CI have no `.env`; real environment variables are used there |
| SIGTERM finishes open requests, then closes the database pool | Cloud Run sends SIGTERM before it stops an instance |
| Node 24 (Alpine in the image), PostgreSQL 16 on Cloud SQL | Node 24 is what development and the kit use; PostgreSQL 16 as in SDS §3 (local development runs 17) |

## 2. Environment variables

Every variable is listed in [`server/.env.example`](../../../server/.env.example) with placeholder values only; a
test (TEST-SR4-01) checks that `.env.example`, SDS §9.1 and `config.ts` name the same eight. The client reads none.

| Variable | Purpose | Secret? | Local (`server/.env`) | CI (planned, #33) | Cloud Run (planned, #34) |
|---|---|---|---|---|---|
| `NODE_ENV` | `production` turns on `Secure` cookies | no | `development` | `test` (set by Vitest) | `production` (env var) |
| `PORT` | Port the server listens on | no | `3000` | — | set by Cloud Run (3000) |
| `DATABASE_URL` | PostgreSQL connection for the app, migrations and seed | **yes** | your local database | throwaway CI database | Secret Manager `tcg-event-hub-database-url` (Cloud SQL socket) |
| `APP_ORIGIN` | Origins allowed to send POST/PATCH/DELETE | no | `http://localhost:5173` | test value in the tests | both service URLs, comma-separated (env var) |
| `LOG_LEVEL` | Log detail | no | `info` | `silent` in tests | `info` (env var) |
| `TRUST_PROXY` | Proxies in front of Express | no | `0` | — | `1` (env var) |
| `DATABASE_URL_TEST` | Test database; the tests truncate it | **yes** | your local test database | throwaway CI database | not used |
| `SEED_PASSWORD` | Password of every seeded demo account (≥ 12 characters) | **yes** | your own local value | throwaway CI value | Secret Manager `tcg-event-hub-seed-password`, given to the migration job only |

No real value of a secret is in the repository, the image, the logs or this document. `server/.env` is git-ignored.

## 3. Commands

Run from the repository root unless a folder is named. `npm ci` in `server/` needs `npm run db:generate` afterwards,
because npm 11 blocks Prisma's install script.

| What | Command |
|---|---|
| Install | `npm --prefix server ci && npm --prefix server run db:generate && npm --prefix client ci` |
| Migrate | `npm --prefix server run db:deploy` (development database: `db:migrate`) |
| Seed | `npm --prefix server run db:seed` (needs `SEED_PASSWORD`; safe to run again) |
| Test (server) | `npm --prefix server run db:migrate:test && npm --prefix server test` |
| Test (client) | `npm --prefix client test` |
| Build (client) | `npm --prefix client run build` (writes `client/dist`, which the server then serves) |
| Run (development) | `npm --prefix server run dev` and `npm --prefix client run dev`, then open `http://localhost:5173` |
| Run (one container, without Docker) | build the client, then `npm --prefix server run dev` and open `http://localhost:3000` (set `APP_ORIGIN=http://localhost:3000`) |
| Docker: build | `docker build -t tcg-event-hub .` (the same image runs the service and the migration job) |
| Docker: run with a database | `cp server/.env.example server/.env`, set `SEED_PASSWORD`, then `docker compose up --build -d`; open `http://localhost:8080` (if 8080 is taken: `APP_PORT=3100 docker compose up -d`; `APP_ORIGIN` follows) |
| Docker: check | `docker compose ps -a` (`migrate` must show `exited (0)`), `curl --fail http://localhost:8080/api/health` and `/api/ready` |
| Docker: stop | `docker compose down` keeps the data in volume `tcg_db`; `docker compose down -v` deletes it |

## 3.1 Docker files

| File | What it does |
|---|---|
| `Dockerfile` | Three stages on `node:24-alpine`: build the client; install server packages, `prisma generate` for Alpine, prune dev packages; runtime as user `node` with `client/dist` beside `server/`. `CMD node --import tsx src/index.ts` |
| `.dockerignore` | The kit's list plus `.claude`, `docs`, `e2e`, root `scripts`, `server/tests`; every `.env` except `.env.example` |
| `server/docker-entrypoint.sh` | `exec "$@"`, so Node is PID 1 and receives SIGTERM |
| `docker-compose.yml` | `db` (PostgreSQL 16, volume `tcg_db`, no host port), `migrate` (migrations + seed, runs once), `app` (host port `APP_PORT`, default 8080, to container 3000). `SEED_PASSWORD` comes from `server/.env`; the database password is a local-only fallback |
| `.gitattributes` | `*.sh` keep LF, so a Windows checkout still builds a working entrypoint |

Checked in #32: [`evidence/L5-03-compose.txt`](evidence/L5-03-compose.txt) (health, ready, page, a registration that survives `down`/`up`, SIGTERM exit 0, no secret in the image) and [`evidence/L5-03-fresh-clone.txt`](evidence/L5-03-fresh-clone.txt) (C-03: fresh clone, `server/.env` = `.env.example` except `SEED_PASSWORD`, `--no-cache` build, migrate exit 0, health, ready, sign-in).

## 4. GCP project and resources (planned, #34)

| Resource | Name |
|---|---|
| Project ID / region | *filled in by #34* / `asia-southeast1` |
| Cloud Run service / migration job | `tcg-event-hub` / `tcg-event-hub-migrate` |
| Artifact Registry repository and image | `tcg-event-hub/tcg-event-hub`, tagged with the full commit SHA |
| Cloud SQL instance / database / user | `tcg-event-hub-pg` (PostgreSQL 16, `db-f1-micro`) / `tcg_event_hub` / `tcg_event_hub` |
| Secrets | `tcg-event-hub-database-url`, `tcg-event-hub-seed-password` |
| Service accounts | `tcg-event-hub-runner` (runtime), `tcg-event-hub-deployer` (GitHub Actions, no key) |
| GitHub environment | `demo` (deploys from `main` only) |

## 5. Release procedure (planned, #36)

Feature branch → PR into `sprint-1-staging` (teammate review, `test-and-docker` green) → release PR into `main` →
**Deploy demo** builds the image tagged with the merge commit SHA, runs the migration job, updates Cloud Run and
smoke-tests the URL. The running commit is the image tag in the run summary and on the Cloud Run revision.
