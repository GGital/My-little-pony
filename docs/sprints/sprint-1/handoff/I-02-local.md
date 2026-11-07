# Hand-off: re-run I-02 locally, and run the secret scan

For a local Claude Code session (or a person) on the team's own machine. Issue
[#4 (I-02)](https://github.com/GGital/My-little-pony/issues/4), branch `feature/s1-02-api-foundation`.

## What was done and already verified

Tests were written first and run against the cloud session's PostgreSQL 16.15:

| Commit | What it contains | Run |
|---|---|---|
| `7895809` | Tests TEST-SR2-01 … 05, TEST-SR3-01, TEST-SR4-01 (U, I), probe routes in `tests/helpers/`, stubs that only compile | **Red: 55 failed / 78**, all on assertions (`evidence/I-02-red.txt`) |
| `d8971df` | Errors, validation, JSON/413/415, origin check, clock, config, health, `index.ts` | 77 / 78 (`evidence/I-02-green-1.txt`) |
| `c53184e` | Explained test correction: read the logged 500 cause from its field | **Green: 78 passed / 78** (`evidence/I-02-green-2.txt`) |

A real `npm run dev` also answered `GET /api/health` with `200 {"status":"ok"}`, an unknown `/api` path with
`404 NOT_FOUND`, and a `text/plain` POST with `415`. Without `DATABASE_URL` it stopped with
`Invalid configuration: DATABASE_URL is required. …` and exit code 1.

## What the local run is meant to prove

| Test | It proves |
|---|---|
| TEST-SR2-01 | 400, 401, 403, 404, 409 and a forced 500 all answer `{error:{code,message,details?}}` and leak no stack, SQL, path, email or cookie; the 500 is logged with only method, path and the real error |
| TEST-SR2-02 | A `.strict()` schema reports all four bad fields (`capacity`, `title`, `startAt`, unknown `organizerId`) and nothing is stored |
| TEST-SR2-03 | GET on every listed route changes no row; GET on a POST-only path is `404 NOT_FOUND` |
| TEST-SR2-04 | Every SDS §6.2 code has its status; an unknown code fails to compile |
| TEST-SR2-05 | `415` for text, `413` over 100 kB, `403` for a foreign or missing Origin, `400` for broken JSON |
| TEST-SR3-01 | With the clock fixed at T, only the T + 1 min event is upcoming; T itself counts as started |
| TEST-SR4-01 | `.env.example`, SDS §9.1 and `config.ts` list the same 8 variables; the real server refuses to start without `DATABASE_URL`; health is 200 / 503 |

## How to run it

1. In `server/`, run `npm install` (Node 22, npm 10 or later).
2. Add the new variables to your `server/.env` from `.env.example`. Only `APP_ORIGIN` is new and required:
   `APP_ORIGIN="http://localhost:5173"`.
3. Run:

```bash
npm run db:migrate:test
```

```bash
npm test
```

Expected: `Test Files 9 passed (9)`, `Tests 78 passed (78)`.

4. Optional: `npm run dev`, then open `http://localhost:3000/api/health`.

## Manual step still to do: the secret scan (TEST-SR4-01 M, DoD-7)

The cloud session could not download a scanner, so this is **not done yet**. Run either one and save a
screenshot as `docs/sprints/sprint-1/evidence/I-02-secret-scan.png`:

- **gitleaks** (installed on your machine), from the repository root:

```bash
gitleaks git --redact -v .
```

  Expected: `no leaks found`.
- **or** GitHub: repository Settings → Code security → enable Secret scanning, then screenshot the Security tab
  showing 0 alerts.

A text search of the tracked files already found no `.env` file, no database URL with a real password and no key
patterns, but that is not a substitute for the scan.

## Rules for the local session

- Do **not** run `npm run db:reset:test` or `prisma migrate reset` without the user's explicit consent.
- Do not change an assertion to make a test pass. A wrong test is fixed in its own commit with the reason, and a
  version row is added to the STS.
- If a local result differs from the table above, record it in `sts.md` §5 with the local PostgreSQL version.
