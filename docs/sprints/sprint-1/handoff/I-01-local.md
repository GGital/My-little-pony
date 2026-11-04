# Hand-off: re-run I-01 on a local PostgreSQL

For a local Claude Code session (or a person) on the team's own machine. Issue
[#3 (I-01)](https://github.com/GGital/My-little-pony/issues/3), branch `feature/s1-01-data-foundation`.

## What was done and already verified

The tests were written first and run against a throwaway PostgreSQL 16.15 in the cloud session:

| Commit | What it contains | Run |
|---|---|---|
| `4725528` | Tests TEST-SR1-01 … 05, schema, table-only migration `0001_init`, placeholder seed | **Red: 10 failed / 17**, all on assertions (`evidence/I-01-red.txt`) |
| `3486e31` | Migration `0002_rule_constraints`, real idempotent seed | 16 / 17 (`evidence/I-01-green-1.txt`) |
| `47bba2c` | Explained test correction: match SQLSTATE 23505, check the index shape | **Green: 18 passed / 18** (`evidence/I-01-green-2.txt`) |

The real seed was also run twice against the development database: 6 users, 6 events, 9 registrations both times.

## What the local run is meant to prove

| Test | It proves |
|---|---|
| TEST-SR1-01 | An event and a registration read back identically through a new database connection (NFR-06) |
| TEST-SR1-02 | The seed creates exactly the accounts and events of contracts §0.3, with scrypt hashes, and adds nothing on a second run |
| TEST-SR1-03 | The database itself refuses capacity 0, −1 and 257, and accepts 1 and 256 (BR-01) |
| TEST-SR1-04 | The database refuses an end at or before the start, or more than 24 h after it, and accepts exactly 24 h (BR-02) |
| TEST-SR1-05 | A partial unique index allows only one active registration per participant per event, and allows a new one after a cancel (BR-06) |

## How to run it

1. Create two empty databases on the local PostgreSQL, for example `tcg_event_hub` and `tcg_event_hub_test`.
2. In `server/`, run `npm install`, then copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` → the development database
   - `DATABASE_URL_TEST` → the **test** database (must be different: tests empty every table there)
   - `SEED_PASSWORD` → any local value of 12 characters or more
3. Run:

```bash
npm run db:migrate:test
```

```bash
npm test
```

Expected: `Test Files 3 passed (3)`, `Tests 18 passed (18)`.

4. Optional: see the red step yourself. Check out `4725528`, use a **fresh, empty** test database, run
   `npm run db:migrate:test` and `npm test`, and expect `10 failed / 17`. Then check out the branch again. A test
   database that already has `0002` applied will not go back to red without a reset.

5. Optional, development database: run `npm run db:deploy`, then `npm run db:seed` twice. Expect the message
   "Seed complete" both times and no duplicate rows.

## Rules for the local session

- Do **not** run `npm run db:reset:test` or `prisma migrate reset` without the user's explicit consent. They delete
  all data. Use `db:migrate:test` instead.
- Do not change an assertion to make a test pass. If a test is wrong, fix it in its own commit with the reason, and
  add a version row to the STS.
- If a local result differs from the table above, record it in `sts.md` §5 with the local PostgreSQL version.
