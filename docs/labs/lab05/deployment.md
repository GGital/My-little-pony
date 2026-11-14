# Lab 5 deployment: TCG Event Hub on Google Cloud

Version v1.0 (Lab 5 Issues [#30](https://github.com/GGital/My-little-pony/issues/30) to [#38](https://github.com/GGital/My-little-pony/issues/38)). One section per part of the work: Docker (#32),
CI (#33), GCP resources (#34), sign-in from GitHub and the merge gate (#35), release procedure (#36), persistence and
rollback (#37), pause, resume and teardown, and the evidence index (#38).

Live URL: https://tcg-event-hub-932557875237.asia-southeast1.run.app (also `https://tcg-event-hub-kwdr2zue6a-as.a.run.app`). The running commit is in the page
footer and at `/api/version` (section 5).

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
test (TEST-SR4-01) checks that `.env.example`, SDS §9.1 and `config.ts` name the same nine. The client reads none.

| Variable | Purpose | Secret? | Local (`server/.env`) | CI (#33, `ci-docker.yml`) | Cloud Run (#34) |
|---|---|---|---|---|---|
| `NODE_ENV` | `production` turns on `Secure` cookies | no | `development` | `test` (set by Vitest) | `production` (env var) |
| `PORT` | Port the server listens on | no | `3000` | — | set by Cloud Run (3000) |
| `DATABASE_URL` | PostgreSQL connection for the app, migrations and seed | **yes** | your local database | throw-away PostgreSQL service in the runner | Secret Manager `tcg-event-hub-database-url` (Cloud SQL socket) |
| `APP_ORIGIN` | Origins allowed to send POST/PATCH/DELETE | no | `http://localhost:5173` | test value in the tests | both service URLs, comma-separated (env var) |
| `LOG_LEVEL` | Log detail | no | `info` | `silent` in tests | `info` (env var) |
| `TRUST_PROXY` | Proxies in front of Express | no | `0` | — | `1` (env var) |
| `GIT_SHA` | Commit the image was built from: `GET /api/version` and the page footer (R-08) | no | `local` | `local` | full commit SHA, baked in by `docker build --build-arg GIT_SHA` in `deploy.yml` |
| `DATABASE_URL_TEST` | Test database; the tests truncate it | **yes** | your local test database | second database in the same runner service | not used |
| `SEED_PASSWORD` | Password of every seeded demo account (≥ 12 characters) | **yes** | your own local value | random per run (`openssl rand -hex 16` in the workflow) | Secret Manager `tcg-event-hub-seed-password`, given to the migration job only |

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

## 3.2 CI and deploy scripts (#33)

`.github/workflows/ci-docker.yml` (**CI & Docker Build**) runs on every Pull Request into `main` or `sprint-*-staging`, by hand (`workflow_dispatch`), and inside `deploy.yml` before each release (`workflow_call`). One job, **`test-and-docker`** (the required check, #35), read-only permissions, actions pinned to commit SHAs, no Google sign-in:

| Step | What it proves |
|---|---|
| Deploy scripts: `bash -n`, `deploy/tests/test_deploy_stub.sh`, `test_release_stub.sh`, `test_smoke.py` | The deploy scripts behave (fake `gcloud`, no cloud, no cost): resources reused on rerun, migration failure stops the release, no project-wide secret access, no secret in the output, dry run calls nothing |
| `npm run secret:scan`, `npm run sts:check` | No secret shapes in the repository; every Sprint 1 AC has a recorded test |
| Server: `npm ci`, `db:generate`, `db:deploy`, `db:seed`, `db:migrate:test`, `typecheck`, `npm test` | Migrations and seed apply to an empty PostgreSQL 16; all server tests on a real database, including the 20-racer last-seat test |
| Client: `npm ci`, `npm test`, `npm run build` | Component tests and the production build |
| End-to-end: `npx playwright test` (Chromium) | The Sprint 1 journeys and the three-width check through the real API and client |
| `docker build -t tcg-event-hub:ci .` | The production image still builds (not pushed) |

`.github/dependabot.yml` proposes updates to the pinned actions every week.

Before the first push, the whole job was replayed on a fresh clone with no `.env` against a throw-away PostgreSQL 16: [`evidence/L5-04-ci-replay.txt`](evidence/L5-04-ci-replay.txt) (all steps pass: server 285, client 64, E2E 40, image builds). The GitHub run on the PR is the evidence for C-01.

The `deploy/` scripts come from the kit with these changes: names `tcg-event-hub*`; one generated seed secret (`tcg-event-hub-seed-password`) given only to the migration job; the job runs `npx prisma migrate deploy && npm run db:seed`; the service gets `NODE_ENV`, `TZ`, `TRUST_PROXY=1`, `LOG_LEVEL` and `APP_ORIGIN` (deterministic URL first, then both URLs, set with gcloud's `^;^` delimiter because the list contains a comma); the smoke test checks `/api/events` and signs in with our `tcg.sid` cookie. Preview with `DRY_RUN=1 PROJECT_ID=... bash deploy/deploy.sh`.

## 4. GCP project and resources (#34)

| Resource | Name |
|---|---|
| Project ID / region | `cpe334-en007` / `asia-southeast1` |
| Cloud Run service / migration job | `tcg-event-hub` / `tcg-event-hub-migrate` |
| Artifact Registry repository and image | `tcg-event-hub/tcg-event-hub`, tagged with the full commit SHA |
| Cloud SQL instance / database / user | `tcg-event-hub-pg` (PostgreSQL 16, `db-f1-micro`) / `tcg_event_hub` / `tcg_event_hub` |
| Secrets | `tcg-event-hub-database-url`, `tcg-event-hub-seed-password` |
| Service accounts | `tcg-event-hub-runner` (runtime), `tcg-event-hub-deployer` (GitHub Actions, no key) |
| Service URLs | `https://tcg-event-hub-932557875237.asia-southeast1.run.app` and `https://tcg-event-hub-kwdr2zue6a-as.a.run.app` (both in `APP_ORIGIN`) |
| Workload Identity Federation | pool `github-actions`, provider `github-main`; the condition pins this repository, `main`, `deploy.yml` and environment `demo` (#35) |
| GitHub environment | `demo` (deploys from `main` only), variables `GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`; no secrets |
| Merge gate | ruleset `protect-main` (Active, no bypass) on the default branch `main`: PR with 1 approval, required status check `test-and-docker`, no force push or deletion (#35). "Up to date before merging" is not switched on. PRs into `sprint-1-staging` run the same check and get a teammate review, but no ruleset enforces it there |

The project number is left out on purpose; it only appears inside the deterministic service URL.

## 5. Release procedure (#36)

Nobody types a deploy command. Every release takes the same path:

1. Issue → branch from `sprint-1-staging` (`git checkout --no-track -b <type>/<issue>-<slug> origin/sprint-1-staging`).
2. PR into `sprint-1-staging`, label `lab5`; `test-and-docker` must pass and the teammate approves with a specific
   check, question or finding; merge.
3. Release PR `sprint-1-staging` → `main`; the same check runs again; teammate approval; merge.
4. The merge into `main` starts **Deploy demo** (`.github/workflows/deploy.yml`, environment `demo`):
   `test` (reuses `ci-docker.yml`) → keyless sign-in (Workload Identity Federation) → `docker build --build-arg
   GIT_SHA=<sha>` and push `tcg-event-hub:<full sha>` → `deploy/release.sh` (resolve the digest, run the migration
   job `tcg-event-hub-migrate`, point the service at the digest with 100% traffic) → `deploy/smoke_test.py`
   (health, ready, page, events, and `/api/version` = the released SHA) → run summary.

**Which commit is running** (R-08), four ways that must agree:

| Where | What to read |
|---|---|
| The live page | footer `Build <first 7 characters>` |
| `GET <URL>/api/version` | `{"commit":"<full SHA>"}` |
| Actions → Deploy demo → run → Summary | Commit image tag, Digest, URL |
| Cloud Run → `tcg-event-hub` → Revisions | the 100% revision's image digest equals the summary's digest |

**Rollback** (Episode 8): Actions → Deploy demo → Run workflow on `main` with `image_tag` = the full 40-character
SHA of an earlier release (copy it from that run's summary). Test, build and migration are skipped; the service is
pointed back at that image, and the smoke test checks `/api/version` reports that SHA. Roll forward the same way
with the newer SHA. The database is never rolled back, so migrations stay additive.

**Persistence check** (#37, C-05): `python3 deploy/persistence_check.py <URL> <event id> "<title>" [<SHA>]` reads
only public endpoints and fails unless the event still has that title and, when a SHA is given, `/api/version`
reports it. Tested on 14 Nov with event 7 "L5-8 persistence check" (created on the live URL by an organizer):

| Step | How | Running release | Event 7 | Still signed in |
|---|---|---|---|---|
| Before | — | B `267f1e5` | present | yes |
| Restart | `gcloud run services update … --update-labels=l5-8-restart=1` (revision `00011-4ml`) | B | present | yes |
| Rollback | Deploy demo [run #7](https://github.com/GGital/My-little-pony/actions/runs/43610598970), `image_tag` = A; test skipped (revision `00012-q5p`) | A `906158e` | present | yes |
| Roll forward | Deploy demo [run #8](https://github.com/GGital/My-little-pony/actions/runs/43611074299), `image_tag` = B; test skipped (revision `00013-n29`) | B | present | yes |

Under A the line under Find an Event disappeared and the footer read `Build 906158e`; after the roll forward the line
came back. A browser tab opened before a release keeps the old page until it is reloaded (Ctrl+F5). Log:
`docs/labs/lab05/evidence/L5-08-red-green.txt`.

**Do not merge into `main` while the app is paused** (Episode 9): the migration and the smoke test would fail.
Resume first, then re-run the failed run.

The first deployment (#34) was made by hand with `deploy/deploy.sh` (Cloud Build, tag `latest`), so it reports
`commit: local`; every pipeline release after it reports its SHA.

## 6. Pause, resume and teardown (Episodes 9 and 10)

**Keep the service running until grading ends and through Lab 6 UAT.** Pause only after that. Pausing deletes
nothing; Cloud Run already scales to zero, so stopping Cloud SQL is what saves money. In Cloud Shell:

```bash
export PROJECT_ID=cpe334-en007 REGION=asia-southeast1
# Pause: close public access, then stop the database
gcloud run services remove-iam-policy-binding tcg-event-hub --member=allUsers --role=roles/run.invoker --region $REGION --project $PROJECT_ID
gcloud run services update tcg-event-hub --invoker-iam-check --region $REGION --project $PROJECT_ID
gcloud sql instances patch tcg-event-hub-pg --activation-policy=NEVER --project $PROJECT_ID
# Resume: start the database, open public access, wait 1-3 minutes, then check /api/ready
gcloud sql instances patch tcg-event-hub-pg --activation-policy=ALWAYS --project $PROJECT_ID
gcloud run services add-iam-policy-binding tcg-event-hub --member=allUsers --role=roles/run.invoker --region $REGION --project $PROJECT_ID
```

While paused, do not merge into `main` (Deploy demo would fail); resume first, then re-run the failed run.

**Teardown** (end of term, after grading only; it deletes the database and cannot be undone): save the evidence
first, preview with `DRY_RUN=1 ./deploy/teardown.sh`, then run `./deploy/teardown.sh` and type the project ID to
confirm. It deletes the service, the migration job, Cloud SQL, the Artifact Registry repository, both secrets and the
runtime service account. Afterwards delete the deployer service account and the WIF pool, and remove the `demo`
environment (or `deploy.yml`) so pushes to `main` stop trying to deploy.

## 7. Evidence index

One row per check (handout §8). Screenshots are on the Issue comments and in the PDF; secrets and personal details
are hidden.

| Rubric part | Check | Requirement | Evidence | Result |
|---|---|---|---|---|
| 1. CI and quality gate | C-01 | R-05 | [`ci-docker.yml`](https://github.com/GGital/My-little-pony/blob/main/.github/workflows/ci-docker.yml); passing PR [#46](https://github.com/GGital/My-little-pony/pull/46), [run 43588358773](https://github.com/GGital/My-little-pony/actions/runs/43588358773) | `test-and-docker` green: server, client, E2E, image build |
| 1. CI and quality gate | C-02 | R-06 | Ruleset `protect-main`; PR [#43](https://github.com/GGital/My-little-pony/pull/43) from `test/l5-prove-gate`, [failing run](https://github.com/GGital/My-little-pony/actions/runs/43467550906); screenshots on [#35](https://github.com/GGital/My-little-pony/issues/35) | Required check failed, merging blocked; PR closed unmerged |
| 2. Docker and configuration | C-03 | R-01, R-02 | [`Dockerfile`](https://github.com/GGital/My-little-pony/blob/main/Dockerfile), [`.dockerignore`](https://github.com/GGital/My-little-pony/blob/main/.dockerignore), [`server/.env.example`](https://github.com/GGital/My-little-pony/blob/main/server/.env.example), section 2; [`L5-03-fresh-clone.txt`](evidence/L5-03-fresh-clone.txt) | Fresh clone with only `.env.example` values (plus `SEED_PASSWORD`) builds, migrates and serves |
| 3. GCP deployment and persistence | C-04 | R-03 | https://tcg-event-hub-932557875237.asia-southeast1.run.app; Playwright captures of sign-in, registration, My Events, a FULL event and a restricted page (`scripts/c04-live-capture.mjs`) on [#38](https://github.com/GGital/My-little-pony/issues/38) | Domain workflow works on the live URL |
| 3. GCP deployment and persistence | — | R-03 | GCP service, database, secrets and `/api/ready` screenshots on [#34](https://github.com/GGital/My-little-pony/issues/34) | Cloud Run + Cloud SQL connected |
| 3. GCP deployment and persistence | C-05 | R-04 | Section 5 persistence table; [`L5-08-red-green.txt`](evidence/L5-08-red-green.txt); screenshots on [#37](https://github.com/GGital/My-little-pony/issues/37) | Event 7 present after restart, rollback to A and roll forward to B |
| 4. Repeatable release pipeline | C-06 | R-07 to R-10 | [#36](https://github.com/GGital/My-little-pony/issues/36) → [#46](https://github.com/GGital/My-little-pony/pull/46) (Praewa's review) → release [#47](https://github.com/GGital/My-little-pony/pull/47) → [Deploy demo run 43604904531](https://github.com/GGital/My-little-pony/actions/runs/43604904531); screenshots on #36 | Image tag `267f1e5` = merge commit; revision digest matches; `/api/version` reports it |
| 4. Repeatable release pipeline | — | R-08 | Section 5 "Which commit is running" | Footer, `/api/version`, run summary and revision agree |
