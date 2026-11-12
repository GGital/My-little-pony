# Lab 5 plan: Cloud deployment and CI/CD on GCP (TCG Event Hub)

Due **Sun 15 Nov 2026, 23:59**. Today is Thu 12 Nov, so there are 3.5 days.
Sources: `01_SE_Lab_5_updated.pdf` (handout: R-01…R-12, C-01…C-06, rubric) and `03_Student-Guide-GCP-Deployment-and-CI-CD-V1_1.pdf` (Episodes 0–10).

Who does what in this plan:
- **Claude**: code, kit adaptation, local Docker and test runs, and drafts of Issues, PRs, reviews and docs. Claude never pushes, merges or posts without asking.
- **You (GGital)**: every git push, PR, merge and post; all GCP Console and Cloud Shell work; all GitHub Settings work; screenshots.
- **Praewa (MeldyRose)**: reviews, plus at least one authored piece of work. R-11 rules out permanent roles: each of you has to be able to explain any sampled step.

Hard rules:
- Handout §4.3 and §9: no secret ever goes into the repo, a screenshot, the PDF or this chat.
- Claude reads every gcloud command but runs none against GCP, and never touches billing, IAM or the database.
- Card and billing steps are yours alone.

---

## 0. What the repo has today (checked on v0.1.0 / cb42ae9)

| Lab 5 need | State | Gap |
|---|---|---|
| Settings from env (R-02) | `server/src/config.ts` reads NODE_ENV, PORT, DATABASE_URL, APP_ORIGIN, LOG_LEVEL and TRUST_PROXY with zod. `.env.example` lists them all plus DATABASE_URL_TEST and SEED_PASSWORD | Add the cloud value and the "secret or not" note for each variable to deployment.md |
| Sessions in DB (Ep 2, point 4) | `Session` table (SD-07) | OK |
| No uploads on disk (point 1) | No upload feature | OK |
| Seed is safe (point 2) | Upsert by email or seedKey, so it can be rerun. The password comes from `SEED_PASSWORD`, with a 12-character minimum. Accounts: 2 organizers and 4 participants | OK. These demo accounts serve Lab 6 UAT |
| PORT (point 5) | `config.PORT` | Check that it binds on 0.0.0.0 (the Express default does) |
| `/api/ready` (point 6) | Only `/api/health`, which already runs `SELECT 1` and returns 503 | Add `/api/ready`, which the kit smoke test calls |
| One container: API and React app (SD-01) | **Missing.** `app.ts` has the comment "built client is served from here in I-12", but there is no `express.static` | Serve `client/dist` and add an SPA fallback for non-`/api` GETs |
| Graceful SIGTERM | ponytail note in `index.ts` ("arrives with Lab 5") | Close the server and `prisma.$disconnect()` |
| `tsx` at runtime | `start` uses `tsx`, which is a devDependency | Move `tsx` to dependencies, or the image needs dev deps |
| Docker, CI, deploy files | None. There is no `.github/` folder | Ep 3, 4, 7 |
| Repo public (R-12) | Public | OK |
| Branch protection on `main` | Classic protection with 1 approval, but **no required status check** | Ep 6 ruleset: require `test-and-docker` |
| Staging branch | `sprint-1-staging`, 1 merge commit behind `main` | Sync before Ep 2 |
| `lab5` label | Does not exist | Create it |
| CI note | `npm` scripts use `--env-file=.env`, and Node fails if the file is missing | In CI, run `cp .env.example .env` first. Real env vars win over the file |
| Cloud note | APP_ORIGIN must be the exact `https://…run.app` origin, or every POST is rejected by the origin check | Use the deterministic URL `https://tcg-event-hub-<PROJECT_NUMBER>.asia-southeast1.run.app` and test sign-in on it |

## 0.1 Starter Kit compared with our app

The kit is unzipped at `D:\University works\MylittlePony\lab5-kit\toktickit-lab5-starter`, outside the repo. It is written for TokTickIT: Node 24 on Alpine, a server compiled by `tsc` to `dist/`, an admin user plus optional demo users, and Bearer-token login.

| Kit file | Use | What changes for TCG Event Hub |
|---|---|---|
| `Dockerfile` | Adapt (Step 3) | Keep `node:24-alpine`, the same Node as local (v24.19) and the kit; this updates the SDS row that says `node:22-slim`. Our server has no build step (`noEmit`, run by `tsx`), so drop `npm run build` and `dist/` and use `CMD ["node","--import","tsx","src/index.ts"]`. Move `tsx` and `prisma` into `dependencies`: the migrate job needs the Prisma CLI and the tsx seed. Then `npm prune --omit=dev` keeps the image small, as SDS §9.3 asks |
| `.dockerignore` | Copy, then add `.claude` | `**/.env` already keeps our real `server/.env` out of the image |
| `server/docker-entrypoint.sh` | Copy as-is | `exec "$@"`, so the app is PID 1 and receives SIGTERM |
| `docker-compose.yml` | Rewrite (Step 3) | Three services using the root image: `db`, `migrate` and `app` (one container, SD-01). Leave the db port unpublished, because 5432 is taken by `TCGEventDB`. Map the app as `8080:3000`. `SEED_PASSWORD` comes from your shell (`${SEED_PASSWORD:?}`), never a written default |
| `server/Dockerfile`, `client/Dockerfile`, `client/nginx.conf` | **Skip** | Separate API and nginx images contradict SD-01 (one container) |
| `server/.env.example`, `client/.env.example` | **Skip** | Ours is complete already. The client has no `VITE_API_URL` and calls `/api` on the same origin |
| `.github/workflows/ci-docker.yml` | Adapt (Step 4) | Covered in Step 4 below |
| `.github/dependabot.yml` | Copy | — |
| `deploy/deploy.sh` | Adapt (Step 5) | Covered in Step 5 below |
| `deploy/release.sh`, `.github/workflows/deploy.yml` | Rename only (Step 7) | Image path `tcg-event-hub/tcg-event-hub`, service and job names, summary title. The WIF login, the full-SHA tag, the digest pin and the rollback `if` conditions stay untouched |
| `deploy/smoke_test.py` + `tests/test_smoke.py` | Adapt (Step 7) | `/api/ready` must return `{"db":"connected"}`; Step 2 builds it that way. `/api/categories` becomes `/api/events`. The optional login uses our **cookie** session, not a Bearer token: `http.cookiejar` plus an `Origin` header for logout |
| `deploy/tests/test_deploy_stub.sh`, `test_release_stub.sh` | Adapt with the scripts | The same renames. The `--demo` scenario becomes "the seed-password secret is always created and granted per secret" |
| `deploy/teardown.sh` | Rename (end of term) | Names and secret list |
| `docs/*.md` | Read only | §8 troubleshooting and §9 cost estimate: about USD 0.43 per day for Cloud SQL |

Changes to our app that the kit forces. All of them belong to Step 2:
1. `npm` scripts: `--env-file=.env` becomes `--env-file-if-exists=.env`. The container and CI have no `.env`, and real environment variables are used instead.
2. `GET /api/ready` returns `{"status":"ready","db":"connected"}` or 503.
3. Express serves `../client/dist` with an SPA fallback.
4. SIGTERM shuts the server down cleanly.
5. **APP_ORIGIN as a list.** `requireOrigin` compares against `APP_ORIGIN` exactly. Cloud Run answers on two URLs: the deterministic `https://tcg-event-hub-<PROJECT_NUMBER>.asia-southeast1.run.app` and the `status.url` one, which can be the legacy `-<hash>-as.a.run.app`. POSTs from one of them would be rejected with 403. So `APP_ORIGIN` accepts a comma-separated list, and `deploy.sh` sets both URLs once the service exists.

The seed already fits production. It creates rows only when they are missing and never resets a password, and its event dates are relative to the first run. It always creates the 2 organizer and 4 participant demo accounts, which Lab 6 UAT needs. So the kit's admin and demo secrets become **one** secret, `tcg-event-hub-seed-password`.

## 0.2 Names

Resource names: use the SDS §9.3 name `tcg-event-hub` everywhere instead of the kit's `toktickit`:

| Resource | Name |
|---|---|
| Service and registry | `tcg-event-hub` |
| Database name and user | `tcg_event_hub`. Underscores, because a hyphen would need quoting in the connection URL |
| Migration job | `tcg-event-hub-migrate` |
| Cloud SQL instance | `tcg-event-hub-pg` |
| Runtime service account | `tcg-event-hub-runner` |
| Deployer service account | `tcg-event-hub-deployer` |
| Secrets | `tcg-event-hub-database-url`, `tcg-event-hub-seed-password` |
| GitHub environment | `demo` |
| Region | `asia-southeast1` |

Branches:
- Each branch is cut `--no-track` from `origin/sprint-1-staging`.
- CI and the ruleset target `main` and `sprint-*-staging`, so Sprint 2's staging is covered without a later edit.
- Each Issue PR goes into staging; release PRs go from staging into `main`. The `lab5` label goes on every Issue and PR (R-10).
- As in Sprint 1, every PR updates its row in `docs/ai-use.md` and `docs/contributions.md` and has an "AI use and contributions" section.

---

## Step-by-step

### Step 0: Set-up (Thu 12 Nov, about 20 min)
1. ~~Starter Kit~~: done. It is unzipped at `D:\University works\MylittlePony\lab5-kit` (see §0.1). The gcloud CLI is installed, and you sign in later.
2. **You:** GitHub → Labels → create `lab5`. Settings → Code security → turn on **Secret scanning** and **Push protection**.
3. ~~Issues~~: created on 12 Nov, all labelled `lab5` (label created too).

   | Issue | Step |
   |---|---|
   | #30 | L5-1 Cloud preparation |
   | #31 | L5-2 Cloud-ready app |
   | #32 | L5-3 Docker |
   | #33 | L5-4 CI and deploy scripts |
   | #34 | L5-5 First deploy |
   | #35 | L5-6 WIF and merge gate |
   | #36 | L5-7 Auto deploy, releases A and B |
   | #37 | L5-8 Persistence and rollback |
   | #38 | L5-9 deployment.md and PDF |

   **You:** add them to the project board. The gh token lacks the `project` scope, so either run `gh auth refresh -s project` or do it in the web UI.
4. **Claude, then you:** sync `sprint-1-staging` with `main` through a PR, because the ruleset will require up-to-date branches. Claude prepares it; you push and open it; Praewa approves.
5. Decide who owns the GCP project. It needs an unused personal Gmail and a card that has never had a GCP Free Trial.

### Step 1: L5-1 GCP account and cost control, Ep 1 (you, ideally today; no branch)
1. Free Trial sign-up with a personal Gmail, not @mail.kmutt.ac.th. **Never** click Upgrade or pay a prepayment.
2. Create the project, for example `cpe334-sec<N>-mylittlepony`. Add the teammate with the **Editor** role.
3. Cloud Shell: `gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)'` must print `True`.
4. Create an alerts-only budget, scoped to this project, with no credits counted. Example: USD 30–50 with thresholds near the expected USD 20–27.
5. Close the Issue with screenshots of Credits, the budget and `True`. Done when both of you can open the project.

### Step 2: L5-2 Cloud-ready app, Ep 2 (Claude builds; you push; Praewa reviews)
Branch: `refactor/l5-2-cloud-ready`. Done the TokTickIT way: red tests first, then green, with evidence kept in `docs/labs/lab05/evidence/`.
1. Express serves `client/dist`, and unknown non-`/api` GETs return `index.html`. Tests: `GET /` returns HTML, and `/api/nope` still returns the JSON 404.
2. `GET /api/ready` returns `{"status":"ready","db":"connected"}`, or 503 when the database doesn't answer. Test it with a stub `$queryRaw` that throws.
3. SIGTERM handling: close the server and disconnect Prisma.
4. Move `tsx` and `prisma` to dependencies. Change the scripts to `--env-file-if-exists=.env`.
5. `APP_ORIGIN` accepts a comma-separated list. Tests cover the config check and `requireOrigin` accepting each listed origin and rejecting others.
6. Start `docs/labs/lab05/deployment.md`:
   - stack and the differences from the kit;
   - the env-var table: purpose, secret or not, and where the value comes from locally, in CI and on Cloud Run;
   - build, test, migrate and seed commands.
6. PR body: the six-point checklist from Ep 2.2, ticked, with notes. Run all server and client tests and both builds before the PR.

### Step 3: L5-3 Docker, Ep 3 (Claude builds; Claude runs it locally; you push)
Branch: `build/l5-3-docker`. Use 4 of the kit's 7 files: the root `Dockerfile`, `.dockerignore`, `docker-compose.yml` and `server/docker-entrypoint.sh`. §0.1 has the changes and why we skip the other three. Also fix the SDS §3 container row: Node 24 Alpine instead of `node:22-slim`.

Claude runs `docker compose up --build -d`, `curl /api/health` and `/api/ready`, then `down`, `up`, and checks that a registration is still there. That is C-03, which needs a **fresh clone** run with only `.env.example` values filled in. Claude does that clone in the scratchpad and saves the output as evidence.

### Step 4: L5-4 CI on PRs, Ep 4 (Claude builds; you push; first release to main)
Branch: `ci/l5-4-pr-checks`. File `.github/workflows/ci-docker.yml`:
- Job name **`test-and-docker`**, kept exactly.
- `on: pull_request: branches: [main, 'sprint-*-staging']`, plus `workflow_call` and `workflow_dispatch`.
- `permissions: contents: read`.
- Node 24, and Python 3.14 for the smoke unit tests.
- Postgres 16 service container. CI-only values `DATABASE_URL`, `DATABASE_URL_TEST` and `SEED_PASSWORD`, which are throwaway, as in the kit.
- Deploy-script stub tests: `bash -n`, the two stub tests and `test_smoke.py`.
- Server: `npm ci`, `db:generate` (npm 11 blocks Prisma's postinstall), `db:deploy`, `db:seed`, `db:migrate:test`, `typecheck`, then `npm test` (real-DB integration tests, including the 20-racer seat lock).
- Client: `npm ci`, `npm test`, `npm run build`.
- `npm run secret:scan` and `sts:check`.
- `docker build .`, without a push.
- Pin actions to full SHAs, and add the kit's `dependabot.yml`.
- Copy the kit's `deploy/` folder too: CI runs its offline stub tests.

The order is PR into staging (green, approved, merged), then a **release PR into main** (green, merged). That puts CI and `deploy/` on main. The passing run is **C-01**: link it and note the test counts.

### Step 5: L5-5 First deploy, Ep 5 (Claude adapts the script; you run it in Cloud Shell; costs start here)
1. **Claude:** adapt `deploy/deploy.sh` and put it in the L5-4 PR or a small follow-up:
   - the names above;
   - `DATABASE_URL` over the `/cloudsql/` socket;
   - two secrets, `tcg-event-hub-database-url` and `tcg-event-hub-seed-password`, generated by the script, never typed. The kit's admin, demo and `--demo` pieces go;
   - migrate job `npx prisma migrate deploy && npm run db:seed`, which works once Step 2 adds `--env-file-if-exists`. The job gets both secrets; the service gets only `DATABASE_URL`;
   - `--port 3000`;
   - env vars `NODE_ENV=production`, `TZ=Asia/Bangkok`, `TRUST_PROXY=1`, `LOG_LEVEL=info` and `APP_ORIGIN`. Set `APP_ORIGIN` to the deterministic URL (from `gcloud projects describe --format='value(projectNumber)'`) at the first deploy, then add `status.url` once the service exists;
   - the summary lists the seeded demo emails (they are in the contracts, not secret) and names the secret that holds their password;
   - `--min-instances 0 --max-instances 3`;
   - Cloud SQL `db-f1-micro --edition=enterprise`, PostgreSQL 16.
2. **You (Cloud Shell):**
   1. Clone main and check that the commit matches.
   2. Run `DRY_RUN=1 … bash deploy/deploy.sh`, then paste the plan to Claude for a read-through.
   3. Run it for real (10–20 min).
   4. Run `gcloud sql instances patch tcg-event-hub-pg --no-storage-auto-increase`.
3. **You:** `curl $URL/api/health`, `/api/ready`, then `python3 deploy/smoke_test.py "$URL"`. Sign in on the URL with a seeded account. Read the password privately with `gcloud secrets versions access latest --secret=tcg-event-hub-seed-password` and never show it. Share it with the Lab 6 partner team privately.
4. Console checks from Ep 5.7: the runner SA has only Cloud SQL Client plus the secret accessor; storage auto-increase is off; min 0 and max 3.
5. Close the Issue with the URL and screenshots that show no secret. **C-04** comes from here: sign in, register for an event, then one rejection on the live URL:
   - a second registration (409); or
   - a participant opening the organizer dashboard (403).

### Step 6: L5-6 GitHub to GCP and the merge gate, Ep 6 (you, in the Console and GitHub Settings)
1. `gh api repos/GGital/My-little-pony --jq '.id, .owner.id'` gives REPO_ID and OWNER_ID. Also check `…/actions/oidc/customization/sub`.
2. Enable the IAM Credentials API and the STS API. Create SA `tcg-event-hub-deployer` with these roles:
   - Cloud Run Developer;
   - Artifact Registry Writer on the repository only;
   - Service Account User on the runner SA only.

   **Never** create a key.
3. WIF pool `github-actions` with provider `github-main`. The condition pins the repo ID, owner ID, `refs/heads/main`, `deploy.yml@refs/heads/main` and `environment:demo`. Claude fills in the condition text from your IDs; you read it twice before saving.
4. GitHub environment `demo`: deploy from `main` only, with the 4 variables GCP_PROJECT_ID, GCP_REGION, WIF_PROVIDER and WIF_SERVICE_ACCOUNT.
5. Ruleset `protect-main`, Active, with an empty bypass list. It targets `main` and `sprint-*-staging` and requires:
   - a PR with 1 approval;
   - the `test-and-docker` status check, up to date;
   - no force push or deletion.
6. **C-02:**
   1. Claude prepares the throwaway branch `test/l5-prove-gate` from main with one broken assertion.
   2. You push it and open a PR into main. It must not be a draft.
   3. Wait for the red check, then screenshot the blocked merge box.
   4. Close the PR without merging.
   5. Keep the branch until grading, so the run stays visible (R-10 says keep history). Don't delete the run.

### Step 7: L5-7 Auto deploy and smoke test, Ep 7 (Claude adapts; you merge; nobody types a deploy command)
1. **Claude:** add `.github/workflows/deploy.yml` and adapt `deploy/release.sh` and `deploy/smoke_test.py`:
   - checks: `/api/health`, `/api/ready`, `/`, and `/api/events` in place of `/api/categories`;
   - optional login check with a dedicated low-role account.
2. Optional: you create a smoke participant account on the live app. Add the `SMOKE_EMAIL` variable and the `SMOKE_PASSWORD` **environment secret** in `demo`, or skip both.
3. PR into staging, then a release PR into main. The merge starts **Deploy demo**: test, then WIF auth, build and push with the full SHA as the tag, digest, migrate job, deploy, smoke test, run summary.
4. You check in the Console that the revision digest equals the summary digest, the migrate job succeeded and the image tag equals the SHA. This is release **A**.
5. **Repeatability (C-06):**
   1. Praewa authors this one, so R-11 gets an authored PR from her as well as reviews.
   2. A small visible change on branch `feature/l5-7-deploy-proof`, for example a footer line with the build commit.
   3. Better still, show the running commit in the UI or `/api/health`. That proves R-08 straight from the URL: pass `GIT_SHA` as a non-secret env var in deploy.
   4. PR into staging with a specific review from you, then a release PR, then the automatic deploy. This is release **B**.

### Step 8: L5-8 Persistence and rollback, Ep 8 (you; Claude checks the results)
1. On the live URL, create a record: a registration or a new event. Note its ID.
2. **Restart:** deploy a new revision with no code change (`gcloud run services update … --update-labels=restart=1`), or stop and start the instance. The record must still be there.
3. **Redeploy:** Actions → Deploy demo → Run workflow with `image_tag` set to release A's full SHA. That is the rollback, with test and build skipped. The record must still be there and you stay signed in.
4. Roll forward with B's SHA. The record must still be there. Before-and-after screenshots with the URL visible are **C-05**.

### Step 9: L5-9 deployment.md, the evidence index and the PDF (Sat–Sun)
1. **Claude** finishes `deployment.md` (handout §4.3):
   - stack and differences from the kit;
   - env-var table;
   - commands;
   - GCP project, region and resource names;
   - release procedure, how to find the running commit, rollback, and pause/resume (Ep 9).

   It also does a last secret scan.
2. **Claude** drafts the PDF `lab5_sec<section>_<group name>.pdf` as an evidence index:
   - Part 0: team, IDs, repo, tag or commit, URL and the commit it serves, contribution table, evidence index;
   - Parts 1–4: links first, a numbered caption on each screenshot, secrets blurred.

   You supply the screenshots. The R-09/R-10/R-11 traceability uses the same Issue → PR → review chain as Deliverable 1.
3. **You** tick the handout §11 Definition of Done with Praewa, submit on LEB2, and **keep the service running** until grading ends and through Lab 6 UAT. Pause (Ep 9) only after that.

---

## Suggested timeline

| Day | Work |
|---|---|
| Thu 12 | Step 0, Step 1 (account approval can lag, so start now) and Step 2 code |
| Fri 13 | Step 2 review and merge, Steps 3 and 4, first release to main |
| Sat 14 | Step 5 deploy, Step 6 WIF and gate, Step 7 releases A and B. Do them back-to-back: Cloud SQL bills hourly |
| Sun 15 | Step 8, Step 9, submit before 23:59 |

## Mapping to the rubric

| Rubric part | Points | Requirements | Proved by |
|---|---|---|---|
| CI and quality gate | 30 | R-05, R-06 | Steps 4 and 6. C-01 is the green PR run; C-02 is the blocked PR |
| Docker and configuration | 20 | R-01, R-02 | Steps 2 and 3. C-03 is the fresh clone run |
| GCP deployment and persistence | 35 | R-03, R-04 | Steps 5 and 8. C-04 is the live journey; C-05 is the restart and redeploy |
| Repeatable release pipeline | 15 | R-07 to R-10 | Step 7. C-06 is Issue → PR → review → release PR → deploy run → revision SHA |
