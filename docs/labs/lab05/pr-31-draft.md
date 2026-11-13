L5-2: Cloud-ready app: /api/ready, one container, APP_ORIGIN list, SIGTERM (R-02, R-04)

`sprint-1-staging` ← `refactor/l5-2-cloud-ready` · labels `lab5`, `backend`, `tdd`

Closes #31

## Summary

**L5-2 (Lab 5 handout R-02, R-04; Student Guide Episode 2).** This makes the Sprint 1 app ready for Cloud Run before #32 puts it in a container.

- **One container (SD-01).** Express serves the built React app after `/api`, and client-side routes such as `/events/1` get `index.html`. `/api/*` keeps its JSON 404.
- **`GET /api/ready`** answers `{"status":"ready","db":"connected"}`, or `503 {"status":"not_ready"}`. This is the shape the kit's smoke test reads.
- **`APP_ORIGIN` may list several origins**, comma-separated. Cloud Run answers on two URLs, and the origin check must accept both. Anything else still gets `403 FORBIDDEN`.
- **SIGTERM** finishes open requests, then closes the Prisma pool (Cloud Run contract).
- **`prisma` and `tsx` are runtime dependencies**, because the migration job and `tsx` start run in the image. The scripts use `--env-file-if-exists`, so neither the container nor CI needs a `.env`.
- **`docs/labs/lab05/deployment.md` v0.1** covers the stack and the changes from the kit, all eight variables, and the commands.

**Branch base.** The branch starts from `main` (`cb42ae9`), which is `sprint-1-staging` plus the release merge commit. Merging this PR therefore also brings staging up to date with `main`, which the Lab 5 ruleset will require.

## Episode 2 checklist

- [x] 1. Uploaded files are not saved in a local folder. Already OK: the app has no upload feature.
- [x] 2. The seed is safe for production. Already OK:
  - it creates users and events only when missing and never resets a password;
  - the password comes from `SEED_PASSWORD` (12 characters or more);
  - event dates are relative to the first run.
- [x] 3. No dev shortcuts in production. Already OK: there is no user picker and no default password is shown.
- [x] 4. Sessions are stored in the database. Already OK: the `Session` table (SD-07), with only the SHA-256 of the token stored.
- [x] 5. The server reads `PORT`. Already OK: `config.PORT`, and Express listens on all interfaces.
- [x] 6. `/api/ready` exists and returns 503 when the database is down. **Added in this PR** (TEST-L5-02).

## TDD record

| Step | Commit | Run |
|---|---|---|
| Red: tests and a type-only stub (`AppDeps.staticDir`) | `22bc585` | **11 failed / 17**, all `AssertionError`: `/` and `/events/1` give 404, `/api/ready` gives 404, the second listed origin gets 403, the list fails config (`evidence/L5-02-red.txt`) |
| Green: implementation | `ba00939` | lab5 **17 / 17**; server **285 / 285**; client **64 / 64**; client build OK (`evidence/L5-02-green.txt`) |
| Docs | `0ab4ccd`, `352dd2f` | `deployment.md` v0.1, SDS v0.7, AI-use and contribution rows; Playwright E2E **40 / 40** |

Six cases pass at red, for honest reasons:
- The rejections (another site, a prefix, no Origin, a path or a space in the list) were already rejected by the exact-match check.
- `/api/nope` was already the JSON 404.

**One assertion changed after red.** TEST-L5-01 expected `application/javascript` for a built `.js` file. Express 5 sends `text/javascript` (RFC 9239), so the assertion now matches `/javascript/`. The test still proves the asset is served as itself and not as `index.html`.

## What changed

| Area | Files |
|---|---|
| Static serving | `server/src/app.ts`: `express.static(client/dist)` after `/api`, plus a GET/HEAD fallback to `index.html`. It is only mounted when a build exists; `staticDir` can be injected for tests |
| Readiness | `server/src/http/health.ts`: `/api/ready` next to `/api/health`, sharing one `SELECT 1` helper. The error log event names are unchanged (`health_check_failed`, plus `ready_check_failed`) |
| Origin list | `server/src/config.ts` checks every comma-separated entry is an origin. `server/src/http/origin.ts` accepts exactly one listed entry |
| Shutdown | `server/src/index.ts`: `SIGTERM` → `server.close()` → `prisma.$disconnect()` |
| Packages | `server/package.json` and lock: `prisma` and `tsx` move to `dependencies` (the lockfile only drops `"dev": true` flags); scripts use `--env-file-if-exists=.env` |
| Tests | `server/tests/lab5/`: TEST-L5-01 static, TEST-L5-02 ready, TEST-L5-03 config list, TEST-L5-04 origin list |
| Docs | `docs/labs/lab05/deployment.md` v0.1, `docs/system-sds.md` v0.7 (§6.1, §9.1, §9.2, E-12b), `server/.env.example` note, `docs/ai-use.md` v0.13, `docs/contributions.md` v0.13 (§3 Lab 5 table) |

## Verified by hand

The server ran on port 3100 with `APP_ORIGIN=http://localhost:3100`, serving `client/dist`, against the development database:
- A browser reload of `/events/1` showed the event page.
- `GET /api/ready` returned `{"status":"ready","db":"connected"}`.
- A same-origin `POST /api/auth/login` with an unknown account returned **401** `INVALID_CREDENTIALS`, so the origin check passed. A cross-site origin gets 403.
- `GET /api/nope` returned a 404 in `application/json`.

SIGTERM can't be sent on Windows. It gets checked in the Linux container in #32.

## How to review

1. `git fetch && git checkout refactor/l5-2-cloud-ready`, then `npm --prefix server ci && npm --prefix server run db:generate`.
2. `npm --prefix server run db:migrate:test && npm --prefix server test`. Expect 285 / 285.
3. Replay red: `git checkout 22bc585 -- server/src && npx --prefix server vitest run tests/lab5`, which gives 11 failed. Then `git checkout HEAD -- server/src`.
4. Live: `npm --prefix client run build`, then start the server with `APP_ORIGIN=http://localhost:3000` and open `http://localhost:3000/events/1`, reloading the page. Try `/api/ready`. Try a POST from the console with a different `Origin` and expect 403.
5. Please state a specific check, question or finding in the review (R-09).

## AI use and contributions

- **AI:** Claude Code (desktop app, Claude Opus) read the Lab 5 handout, the Student Guide and the Starter Kit. It wrote:
  - the red tests, then the implementation;
  - the docs and this PR text.

  It ran the suites on the local PostgreSQL database and the app in the browser. It ran no GCP command. Declared in `docs/ai-use.md` v0.13.
- **Built by:** Phattaratorn (GGital), who supervised, read the diff and opened the PR.
- **Reviewed by:** filled in from the review record.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
