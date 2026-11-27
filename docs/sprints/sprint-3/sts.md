# Sprint 3 Software Test Specification (STS)

Project: **TCG Event Hub** · Sprint 3 · Document version: v0.2 — **draft for team review** (changes in §8)
Contracts: [`feature-contracts.md`](feature-contracts.md) v0.2 · Issues and Definition of Done: [`README.md`](README.md) ·
Earlier STS: [`../sprint-1/sts.md`](../sprint-1/sts.md), [`../sprint-2/sts.md`](../sprint-2/sts.md)

This document turns every Sprint 3 acceptance criterion into planned tests, **before** the code exists, with the
same method as Sprints 1 and 2: Spec DD → Test DD → TDD.

---

## 1. Test strategy

### 1.1 Rules

Sprint 1 STS §1.1 and Sprint 2 STS §1.1 apply unchanged:
- tests come first;
- the server is the authority;
- counts are checked independently;
- persistence is never mocked;
- nothing is weakened;
- the earlier suites are the regression suite;
- every state change is read back from the database;
- every new row lock gets a race test.

Sprint 3 adds:

1. **Every number in a report is checked against an independent SQL count** written in the test (TEST-Q-01,
   R-01). A report that agrees with itself proves nothing.
2. **Every time boundary is tested at, 1 minute before, and 1 minute after** with `clock.setNow()`. This covers the
   check-in window, the event end for no-shows, Bangkok midnight in the summary, and the throttling window.
3. **Manual checks must leave a file.** M rows (SR-05 keyboard, SR-06 load run, V-06 deploy) count only with
   their evidence file in `docs/sprints/sprint-3/evidence/`, named with the commit.

### 1.2 Levels and tooling

These are the same as Sprint 1 STS §1.2, under `server/tests/sprint-3/`, `client/tests/sprint-3/` and
`e2e/sprint-3/`, plus:

| Tool | Used for |
|---|---|
| `@axe-core/playwright` | TEST-SR5-02 accessibility scan |
| `autocannon` (dev dependency) | TEST-SR6-01, 02 load runs |
| `sharp` (also used by the app) | Building test images and reading back stored ones (TEST-V-*) |
| The `local` `MediaStore` driver in a temp folder | Every V test except V-06, which runs against the real bucket |

### 1.3 Test data

- Factories from Sprints 1–2, plus `checkIn(reg, at)`, `endEvent(event)` (moves the clock past `endAt`) and
  `failSignIn(email, n)`.
- Since CH-13 (Lab 7), E-06 accepts only a start at least 60 minutes ahead. Fixtures that need an event starting
  sooner (check-in window, in progress, ended) are written with `makeEvent()` straight to the database, or created
  earlier on the fixed clock and then reached by moving the clock (`setNow`).
- E2E: the seed with EV-4 (check-in window open after seeding) and EV-10 (ended, with a check-in, a no-show and a
  cancellation).
- Images are generated in the test (`sharp({ create: … })`), so no binary fixtures are committed. The EXIF test
  writes GPS metadata with `sharp().withMetadata()`.
- **Tournament standings fixture (TEST-X-03, BR-24).** 5 players, registered in the order A, B, C, D, E; D drops
  after round 2. Results are games won A–B–drawn:

  | Round | Matches |
  |---|---|
  | 1 | A–B 2–0 · C–D 1–1–1 (draw) · E bye |
  | 2 | A–E 2–1 · C–B 2–0 · D bye |
  | 3 | A–C 0–2 · E–B 2–1 (D dropped) |

  Expected standings, computed by hand with exact fractions (byes left out of opponents; 1/3 floor):

  | Rank | Player | Points | W–L–D | OMW% | GW% | OGW% | Why this rank |
  |---|---|---|---|---|---|---|---|
  | 1 | C | 7 | 2–0–1 | 55.5556 | 76.1905 | 52.3810 | most points |
  | 2 | A | 6 | 2–1–0 | 59.2593 | 57.1429 | 57.3413 | ties E on points, wins on OMW% |
  | 3 | E | 6 | 2–1–0 | 50.0000 | 62.5000 | 45.2381 | E's opponent B is floored to 33.33% |
  | 4 | D (dropped) | 4 | 1–0–1 | 77.7778 | 66.6667 | 76.1905 | a dropped player keeps their place |
  | 5 | B | 0 | 0–3–0 | 70.3704 | 33.3333 | 65.2778 | GW% floored from 3/21 to 1/3 |

  The fixture is computed by a short script in the test (exact fractions) and also written out here, so a reviewer
  can check it by hand.

### 1.4 Concurrency simulation

| Test | Set-up | Sent at the same time | Invariant, every round (20 rounds) |
|---|---|---|---|
| TEST-P-06a | Mint `REGISTERED`, window open | 2 × E-18 for Mint | one `200`, one `409 ALREADY_CHECKED_IN`; one change row |
| TEST-P-06b | Mint `REGISTERED`, window open, before the deadline | E-18 (owner) + E-16 (Mint) | final status is exactly one of `CHECKED_IN` or `CANCELLED`; never both timestamps; the loser got the matching 409 |
| TEST-W-06 | a running tournament, round 1 complete | 2 × E-27 | exactly one round 2; one `201`, one `409`; every entry paired once |

**Mutation check at review:** remove `FOR UPDATE` from E-18 and from E-27. Round (b) of TEST-P-06 and TEST-W-06 must
fail at least once. Record this in §5.

### 1.5 Definition of a passing Sprint 3 suite

The suite passes when:
- every §2 row is green on the `v1.0.0` commit, with M rows carrying their evidence files;
- every Sprint 3 AC appears in §3, and §4 has a rejection test for each Sprint 3 BR;
- the Sprint 1 and Sprint 2 suites are fully green;
- JRN-01 … JRN-08 pass;
- §6 records the commit, the commands, the counts and any exceptions.

---

## 2. Planned tests

Legend for **Result**: `Pending` = planned and not yet run. It changes to `Pass` or `Fail` **only from real
output**, with the commit id in §6. The work status of each feature (planned, in progress, implemented, tested,
accepted) is kept in the README §3 table, so a test result is never used as a feature status.

### 2.1 Feature-P — check-in and undo

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-P-01 | I, C, E2E | AC-P-01, FR-21, FR-28 | O1 owns X (start T + 30 min); Mint `REGISTERED`; clock T | E-18; E-08; read the Registration and EventChange rows. (C) Door check-in with E-18 stubbed. (E2E, JRN-05) on EV-4 | `200 CHECKED_IN`, `checkedInAt T`, `checkedInById` O1; 1 `attendance` change row with the registration id; `counts.checkedIn 1`; `registeredCount` unchanged. (C) "Checking in…" with `aria-busy`, then "Checked in 17:02", Undo, live-region text | `server/tests/sprint-3/checkin.api.test.ts`, `client/tests/sprint-3/DoorCheckIn.test.tsx`, `e2e/sprint-3/journey.spec.ts` | Pending |
| TEST-P-02 | U, I | AC-P-02, BR-18, NFR-11, D-26 | X start S, end E | (U) `isCheckInOpen` at S − 61, S − 60, E − 1, E (minutes); (I) E-18 at the same times; E-19 at E; E-08 `checkIn.open` | (U) false, true, true, false. (I) `409 NOT_IN_CHECK_IN_WINDOW`, `200`, `200`, `409`; undo `409`; `open` false/true/true/false | `server/tests/sprint-3/unit/attendance-rules.unit.test.ts`, `server/tests/sprint-3/checkin.api.test.ts` | Pending |
| TEST-P-03 | I, C | AC-P-03, FR-22, BR-19 | Mint checked in at T | E-19 at T + 5 min; E-08. (C) press Undo | `200 REGISTERED`, both check-in fields null; 1 change row CHECKED_IN → REGISTERED; count − 1. (C) the row shows CHECK IN | `server/tests/sprint-3/checkin.api.test.ts`, `client/tests/sprint-3/DoorCheckIn.test.tsx` | Pending |
| TEST-P-04 | U, I | AC-P-04, BR-18, BR-19 | Mint `CHECKED_IN`, Ploy `CANCELLED`, Boss `EVENT_CANCELLED`, Nok `REGISTERED` | (U) `decideCheckIn` / `decideUndo` per status; (I) E-18 Mint, Ploy, Boss; E-19 Nok | `409 ALREADY_CHECKED_IN`; `409 REGISTRATION_NOT_ACTIVE` ×2; `409 NOT_CHECKED_IN`; row and change-row counts unchanged | `server/tests/sprint-3/unit/attendance-rules.unit.test.ts`, `server/tests/sprint-3/checkin.api.test.ts` | Pending |
| TEST-P-05 | I | AC-P-05, BR-14, NFR-02 | Mint's registration on O1's event | E-18 and E-19 by O2, Mint, visitor, foreign Origin; 999999 and `abc` by O1 | `404` (equal to the 999999 body), `403`, `401`, `403`, `404 REGISTRATION_NOT_FOUND`, `400`; nothing changes | `server/tests/sprint-3/checkin.api.test.ts` | Pending |
| TEST-P-06 | I | AC-P-06, BR-19, NFR-05 | §1.4 | §1.4, 20 rounds each | §1.4 invariants | `server/tests/sprint-3/checkin.concurrency.api.test.ts` | Pending |

### 2.2 Feature-Q — attendance report

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-Q-01 | U, I, C | AC-Q-01, FR-23, BR-20, D-28 | the AC data; clock after the end | (U) `attendanceRate(16, 5)`, `formatRate(16/21)`, `formatRate(0.875)`; (I) E-20; independent SQL counts. (C) the report table | (U) 0.7619…, "76%", "88%". (I) `ENDED`, `active 21`, `checkedIn 16`, `noShow 5`, `cancelled 3`, rates as in the AC, all equal to the SQL counts. (C) caption, row headers, the values | `server/tests/sprint-3/unit/attendance-rules.unit.test.ts`, `server/tests/sprint-3/attendance.api.test.ts`, `client/tests/sprint-3/AttendanceReport.test.tsx` | Pending |
| TEST-Q-02 | I, C | AC-Q-02, BR-20, NFR-11 | the same event | E-20 at `endAt − 1 min` and at `endAt`. (C) the in-progress response | `IN_PROGRESS` with `noShow null` and `attendanceRate null`, then `ENDED`. (C) "After the event ends" | `server/tests/sprint-3/attendance.api.test.ts`, `client/tests/sprint-3/AttendanceReport.test.tsx` | Pending |
| TEST-Q-03 | U, I | AC-Q-03, BR-20 | the three events in the AC | (U) `attendanceRate(0, 0)`; (I) E-20 on each | `null`; three `200`s with rate `null`; cancelled: `CANCELLED`, `eventCancelled 3`, the reason | `server/tests/sprint-3/unit/attendance-rules.unit.test.ts`, `server/tests/sprint-3/attendance.api.test.ts` | Pending |
| TEST-Q-04 | I | AC-Q-04, BR-14, NFR-02 | O1's event | E-20 by O2, Mint, visitor; 999999; `abc` | `404` (byte-identical), `403`, `401`, `404`, `400` | `server/tests/sprint-3/attendance.api.test.ts` | Pending |
| TEST-Q-05 | E2E | AC-Q-05, NFR-08, NFR-10 | seed; EV-10 report | axe scan; Tab through the page; three widths | 0 serious or critical issues; caption and headers present; `scrollWidth ≤ innerWidth` | `e2e/sprint-3/a11y.spec.ts` | Pending |

### 2.3 Feature-R — organizer summary

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-R-01 | U, I | AC-R-01, FR-24, BR-20 | the AC events for O1 | (U) `summarise(rows)`; (I) E-21 November; independent SQL | `events 4`, `cancelledEvents 1`, no draft; `averageFillRate 0.625`; `attendanceRate 11/15`; counts equal SQL; 4 rows in order | `server/tests/sprint-3/unit/summary.unit.test.ts`, `server/tests/sprint-3/summary.api.test.ts` | Pending |
| TEST-R-02 | I | AC-R-02, D-22, BR-14 | events at 23:30 on 30 Nov and 00:30 on 1 Dec (Bangkok); O2 events | E-21 `to=2026-11-30` as O1 | 23:30 included; 00:30 excluded; no O2 id | `server/tests/sprint-3/summary.api.test.ts` | Pending |
| TEST-R-03 | U, I | AC-R-03, D-30 | O1 | the five bad queries; an empty range | `400` ×5 naming the key; `200` with zeros and `null` rates | `server/tests/sprint-3/unit/summary.unit.test.ts`, `server/tests/sprint-3/summary.api.test.ts` | Pending |
| TEST-R-04 | I | AC-R-04, NFR-01, NFR-02 | — | E-21 by Mint, by a visitor | `403`, `401` | `server/tests/sprint-3/summary.api.test.ts` | Pending |
| TEST-R-05 | C, E2E | AC-R-05, NFR-08, NFR-10 | seed (EV-10 in the default range) | (C) the default dates, submit, URL; (E2E) three widths, axe | last 30 days by default; URL `from`/`to`; captions; no page scroll; 0 serious issues | `client/tests/sprint-3/Summary.test.tsx`, `e2e/sprint-3/a11y.spec.ts` | Pending |

### 2.4 Feature-S — participant history

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-S-01 | I, C | AC-S-01, FR-25, BR-20 | Mint's four registrations | E-22. (C) the History tab | 4 items in the AC order, with the final statuses and `cancelReason`. (C) chips with words and icons | `server/tests/sprint-3/history.api.test.ts`, `client/tests/sprint-3/History.test.tsx` | Pending |
| TEST-S-02 | I | AC-S-02, D-28 | Mint cancelled, re-registered and was checked in on Y; Y ended | E-22 | one Y item, `ATTENDED` | `server/tests/sprint-3/history.api.test.ts` | Pending |
| TEST-S-03 | I | AC-S-03, NFR-11 | upcoming and in-progress registrations | E-22 before, then at the in-progress event's `endAt` | absent, then `ATTENDED` | `server/tests/sprint-3/history.api.test.ts` | Pending |
| TEST-S-04 | I | AC-S-04, BR-16, NFR-02 | Ploy also has history | E-22 as Mint (stringify), O1, visitor; `page=0` | only Mint's; no Ploy name or id; `403`; `401`; `400` | `server/tests/sprint-3/history.api.test.ts` | Pending |
| TEST-S-05 | C, E2E | AC-S-05, NFR-09 | Nok empty; Mint 25 items | (C) both. (E2E, JRN-05) Mint's History after EV-4 ends | the empty state with Find an Event; 20 + Next "21–25 of 25". (E2E) EV-4 **Attended** | `client/tests/sprint-3/History.test.tsx`, `e2e/sprint-3/journey.spec.ts` | Pending |

### 2.5 Feature-T — sign-in throttling

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-T-01 | I | AC-T-01, NFR-16, FR-02 | Mint; clock fixed | 5 wrong passwords, then the right one | 5 × `401`; `429 TOO_MANY_ATTEMPTS`, the message, `Retry-After: 600`; no Session row and no `Set-Cookie`; 5 failure rows | `server/tests/sprint-3/throttle.api.test.ts` | Pending |
| TEST-T-02 | U, I | AC-T-02, D-29, NFR-11 | 5th failure at F | (U) `lockedUntil(failures)`; (I) right password at F + 9:59; 20 attempts during the lock; right password at F + 10:00 | `429`; 20 × `429`, row count unchanged; `200` with a cookie | `server/tests/sprint-3/unit/throttle.unit.test.ts`, `server/tests/sprint-3/throttle.api.test.ts` | Pending |
| TEST-T-03 | I | AC-T-03, D-27, FR-02 | unknown `ghost@…`; Mint | 6 attempts for ghost; failures as `MINT@…` and ` mint@… `; compare bodies and mean timing over 20 tries | ghost `429` with a body identical to Mint's `429`; timing difference < 50 ms; variants share one counter | `server/tests/sprint-3/throttle.api.test.ts` | Pending |
| TEST-T-04 | I | AC-T-04, NFR-16 | Mint locked | Ploy signs in; Mint at F + 10 min right, then wrong | Ploy `200`; Mint `200`, then `401` | `server/tests/sprint-3/throttle.api.test.ts` | Pending |
| TEST-T-05 | I, C | AC-T-05, NFR-06, NFR-07 | 5 failures | new Prisma client and new app instance, E-01; scan all route-table bodies. (C) the sign-in page with a 429 stub | still `429`; no `LoginAttempt` or `attemptedAt` in any body. (C) the alert text, email kept, password cleared | `server/tests/sprint-3/throttle.api.test.ts`, `client/tests/sprint-3/SignIn.throttle.test.tsx` | Pending |

### 2.6 Feature-V — store logo and event banner

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-V-01 | I | AC-V-01, FR-30, NFR-17 | O1; a 600 × 600 PNG with GPS EXIF (made in the test) | E-24; read the stored file with `sharp().metadata()`; E-05 and E-04; upload again | `200 logoUrl`; WebP 512 × 512, `exif` undefined; same URL in E-05 and E-04; the first file is gone | `server/tests/sprint-3/media.api.test.ts` | Pending |
| TEST-V-02 | I | AC-V-02, FR-31 | O1 owns X | E-25 with a 2400 × 800 JPEG; E-05 as a visitor | `200 bannerUrl`; WebP 1600 × 533; E-05 `bannerUrl` | `server/tests/sprint-3/media.api.test.ts` | Pending |
| TEST-V-03 | U, I | AC-V-03, NFR-17 | — | (U) `sniffImageType(bytes)` on PNG, JPEG, WebP, GIF, SVG and text; (I) the six AC uploads | (U) png, jpeg, webp, null ×3. (I) `413`; `200`; `415`; `415`; `422 IMAGE_TOO_SMALL`; `400 IMAGE_UNREADABLE`; the media folder is unchanged after each failure | `server/tests/sprint-3/unit/image.unit.test.ts`, `server/tests/sprint-3/media.api.test.ts` | Pending |
| TEST-V-04 | I | AC-V-04, BR-14, BR-17 | X (O1), C cancelled | the AC calls | `404`, `403`, `401`, `403`; `409 ALREADY_CANCELLED`; `403`; no file written | `server/tests/sprint-3/media.api.test.ts` | Pending |
| TEST-V-05 | I, C | AC-V-05 | a logo and a banner | `DELETE` ×2; E-05. (C) the event page with `null` URLs | `204` ×2; `null` URLs; files gone. (C) initials and the playmat; banner and logo `aria-hidden` | `server/tests/sprint-3/media.api.test.ts`, `client/tests/sprint-3/EventBranding.test.tsx` | Pending |
| TEST-V-06 | M | AC-V-06, NFR-13, NFR-17 | the deployed candidate | upload a banner; `curl -I` its URL; deploy a new revision; `curl -I` again; list the bucket | `200`, `image/webp`, `nosniff`, twice; the object listed | `docs/sprints/sprint-3/evidence/V-06-<commit>.txt` | Pending |
| TEST-V-07 | C, E2E | AC-V-07, NFR-09, NFR-10 | the store profile and banner box | (C) resize path with a 7 MB canvas image; a GIF; the remove-logo confirmation. (E2E) three widths | "Resized from …"; the alert names the file with focus on the input; Keep it changes nothing; the strips are shaded; no page scroll | `client/tests/sprint-3/StoreMedia.test.tsx`, `e2e/sprint-3/branding.spec.ts` | Pending |

### 2.7 Feature-W — Swiss pairings and rounds

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-W-01 | I, C | AC-W-01, FR-32, BR-21, D-31, D-35 | O2's `TOURNAMENT` in progress; 5 `CHECKED_IN`, 2 `REGISTERED` | E-26 `{}`; read entries, round, matches; call `pairRound` again with the stored seed. (C) the start screen and the round-1 table | `201`; 5 entries = the checked-in ids; rounds 3; 3 matches incl. one bye stored 2–0–0; each entry once; same pairings from the seed; 1 change row. (C) caption, table numbers, Bye | `server/tests/sprint-3/tournament.api.test.ts`, `client/tests/sprint-3/Tournament.test.tsx` | Pending |
| TEST-W-02 | U, I | AC-W-02, BR-21 | the six events in the AC | (U) `decideStart` per case and `maxRounds(4) = 2`; (I) E-26 on each, `rounds` 0 / 3 / 2 | the five 409 codes; `422` ×2 and `201`; table counts unchanged after each rejection | `server/tests/sprint-3/unit/tournament-rules.unit.test.ts`, `server/tests/sprint-3/tournament.api.test.ts` | Pending |
| TEST-W-03 | U | AC-W-03, BR-22, SD-14 | fixed seed 20261121 | 1,000 generated tournaments (2–64 entries, random results, random drops, every allowed round count) | no rematch; ≤ 1 bye per entry; each active entry once per round; pairs respect score groups with float-downs | `server/tests/sprint-3/unit/pairing.property.unit.test.ts` | Pending |
| TEST-W-04 | I | AC-W-04, FR-33, FR-37 | running 6-player tournament | E-27 with a missing result; complete; E-27; E-29; E-27 after the final round | `409 ROUND_NOT_COMPLETE`; `201` round 2 by points, no rematch; drop `200`, absent from round 3, present in standings; `409 NO_ROUNDS_LEFT` | `server/tests/sprint-3/tournament.api.test.ts` | Pending |
| TEST-W-05 | I | AC-W-05, BR-14, NFR-02 | O2's tournament | E-26, E-27, E-29, E-31 by O1, Mint, visitor, foreign Origin | `404` (byte-identical), `403`, `401`, `403`; nothing changes | `server/tests/sprint-3/tournament.api.test.ts` | Pending |
| TEST-W-06 | I | AC-W-06, NFR-05 | §1.4 | §1.4, 20 rounds | §1.4 invariant | `server/tests/sprint-3/tournament.concurrency.api.test.ts` | Pending |
| TEST-W-07 | U | AC-W-07, NFR-18 | 256 entries, 8 rounds of history, seed fixed | time `pairRound` for round 9, 20 runs | median and max < 1 s; valid pairing | `server/tests/sprint-3/unit/pairing.bench.unit.test.ts` | Pending |

### 2.8 Feature-X — results, standings and winner

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-X-01 | U, I | AC-X-01, FR-34, BR-23 | round 1 running | (U) `validateResult` and `matchPoints`; (I) the AC bodies on E-28, and on the bye | `200` ×3 with 3/0, 0/3, 1/1 points; `400` ×4 naming the field; bye `409 ROUND_LOCKED`; `reportedById` = owner | `server/tests/sprint-3/unit/tournament-rules.unit.test.ts`, `server/tests/sprint-3/results.api.test.ts` | Pending |
| TEST-X-02 | I | AC-X-02, BR-23 | round 2 paired | E-28 on a round-1 match; twice on a round-2 match | `409 ROUND_LOCKED`, unchanged; `200` ×2, the last value stored | `server/tests/sprint-3/results.api.test.ts` | Pending |
| TEST-X-03 | U, I | AC-X-03, BR-24, D-34 | the §1.3 fixture | (U) `standings(matches)` with exact fractions; (I) the fixture entered through E-26 … E-29 with fixed pairings, then E-31 | the §1.3 table to 4 decimal places: order C, A, E, D, B | `server/tests/sprint-3/unit/standings.unit.test.ts`, `server/tests/sprint-3/results.api.test.ts` | Pending |
| TEST-X-04 | I, C | AC-X-04, FR-35, FR-36 | final round complete | E-30; E-28, E-27, E-29, E-26; E-31; E-22 as Ploy. (C) the finished page | `200 FINISHED`, `winner` = rank 1; `409` ×4; standings unchanged; Ploy's history `placing`. (C) "Winner: …" | `server/tests/sprint-3/results.api.test.ts`, `client/tests/sprint-3/Tournament.test.tsx` | Pending |
| TEST-X-05 | I, C | AC-X-05, FR-36, BR-16, D-32 | Mint v Ploy, table 2, round 2 | E-32 on Mint's registration id as Mint, then the same id as Ploy, as O1 and as a visitor; stringify Mint's body. (C) the player view | Mint: table 2, opponent "Ploy", own record, points, rank; Ploy `404`; `403`; `401`; no other name, no `standings`, no email. (C) "Round 2 · Table 2 · You play Ploy" | `server/tests/sprint-3/results.api.test.ts`, `client/tests/sprint-3/MyTournament.test.tsx` | Pending |
| TEST-X-06 | I | AC-X-06, BR-14 | finished / unfinished tournaments | E-30 by O1, participant, visitor; before the final round | `404`, `403`, `401`; `409 ROUND_NOT_COMPLETE` | `server/tests/sprint-3/results.api.test.ts` | Pending |
| TEST-X-07 | C, E2E | AC-X-07, NFR-08, NFR-10 | the seed, EV-11 | (E2E, JRN-08) quick buttons, finish, axe, three widths, print view | busy state and live region; Winner shown; 0 serious issues; captions; no page scroll; print columns | `e2e/sprint-3/tournament.spec.ts` | Pending |

### 2.9 SR-05, SR-06, SR-07, regression and journeys

| Test ID | Level | AC / Req | Precondition / input | Action | Expected result | File | Result |
|---|---|---|---|---|---|---|---|
| TEST-SR5-02 | E2E | AC-SR5-02, NFR-10 | the seed; three sessions | axe on the 14 screens | 0 serious and 0 critical; moderate ones listed in §6 | `e2e/sprint-3/a11y.spec.ts` | Pending |
| TEST-SR5-03 | E2E | AC-SR5-03, NFR-08 | the seed | the 14 screens × 390 / 768 / 1440 | 42 / 42 without page scroll; screenshots | `e2e/sprint-3/responsive.spec.ts` | Pending |
| TEST-SR5-04 | M | AC-SR5-04, NFR-10 | keyboard only | the three journeys | each finishes; focus visible; recorded | `docs/sprints/sprint-3/evidence/SR5-04-keyboard-<commit>.md` | Pending |
| TEST-SR6-01 | M | AC-SR6-01, NFR-12 | the perf database, production build | `node scripts/perf.mjs events report` | p95 < 500 ms for E-04 ×2 and E-20 | `docs/sprints/sprint-3/evidence/perf-<commit>.txt` | Pending |
| TEST-SR6-02 | M | AC-SR6-02, NFR-12 | the same | `node scripts/perf.mjs summary`; `EXPLAIN ANALYZE` | p95 < 500 ms; plans recorded | `docs/sprints/sprint-3/evidence/perf-<commit>.txt` | Pending |
| TEST-SR7-02 | M | AC-SR7-02, NFR-14 | the `v1.0.0` candidate | `npm run sts:check -- sprint-1/2/3`; traceability review | all ACs with results; every BR with a rejection; every matrix row with a test and a result | this file §6 | Pending |
| TEST-B-03 (rows added) | I | AC-B-03, NFR-02 | — | rows for E-18 … E-22, E-24 … E-32 | matrix statuses | `server/tests/sprint-1/authorization.api.test.ts` | Pending |
| TEST-SR1-02 (revised) | I | AC-SR1-02 | — | the seed twice | 11 events with EV-10 and EV-11 as in contracts §0.3; second run adds 0 | `server/tests/sprint-1/seed.api.test.ts` | Pending |
| TEST-SR2-03, 04 (rows added) | I, U | AC-SR2-03, NFR-07 | — | new routes and codes | GET on POST/PUT/DELETE paths → 404; codes map to their status | `server/tests/sprint-1/validation.api.test.ts`, `server/tests/sprint-1/unit/errors.unit.test.ts` | Pending |
| JRN-05 | E2E | P, Q, S | contracts §13 | | | `e2e/sprint-3/journey.spec.ts` | Pending |
| JRN-06 | E2E | T | contracts §13 | | | `e2e/sprint-3/journey.spec.ts` | Pending |
| JRN-07 | E2E | V, U | contracts §13 | | | `e2e/sprint-3/branding.spec.ts` | Pending |
| JRN-08 | E2E | W, X, S | contracts §13 | | | `e2e/sprint-3/tournament.spec.ts` | Pending |

**Totals:** 53 planned test rows that carry an AC number, 3 regression rows and 4 new journeys. The Sprint 1 and
Sprint 2 suites run unchanged.

---

## 3. Acceptance criterion → tests

| AC | Tests | AC | Tests | AC | Tests |
|---|---|---|---|---|---|
| AC-P-01 | TEST-P-01, JRN-05 | AC-R-01 | TEST-R-01 | AC-V-01 | TEST-V-01, JRN-07 |
| AC-P-02 | TEST-P-02 | AC-R-02 | TEST-R-02 | AC-V-02 | TEST-V-02, JRN-07 |
| AC-P-03 | TEST-P-03, JRN-05 | AC-R-03 | TEST-R-03 | AC-V-03 | TEST-V-03 |
| AC-P-04 | TEST-P-04 | AC-R-04 | TEST-R-04, TEST-B-03 | AC-V-04 | TEST-V-04, TEST-B-03 |
| AC-P-05 | TEST-P-05, TEST-B-03 | AC-R-05 | TEST-R-05 | AC-V-05 | TEST-V-05 |
| AC-P-06 | TEST-P-06 | AC-S-01 | TEST-S-01 | AC-V-06 | TEST-V-06 |
| AC-Q-01 | TEST-Q-01, JRN-05 | AC-S-02 | TEST-S-02 | AC-V-07 | TEST-V-07 |
| AC-Q-02 | TEST-Q-02 | AC-S-03 | TEST-S-03 | AC-SR5-02 | TEST-SR5-02 |
| AC-Q-03 | TEST-Q-03 | AC-S-04 | TEST-S-04, TEST-B-03 | AC-SR5-03 | TEST-SR5-03 |
| AC-Q-04 | TEST-Q-04, TEST-B-03 | AC-S-05 | TEST-S-05, JRN-05 | AC-SR5-04 | TEST-SR5-04 |
| AC-Q-05 | TEST-Q-05 | AC-T-01 | TEST-T-01, JRN-06 | AC-SR6-01 | TEST-SR6-01 |
| | | AC-T-02 | TEST-T-02, JRN-06 | AC-SR6-02 | TEST-SR6-02 |
| | | AC-T-03 | TEST-T-03 | AC-SR7-02 | TEST-SR7-02 |
| | | AC-T-04 | TEST-T-04 | | |
| | | AC-T-05 | TEST-T-05 | | |
| AC-W-01 | TEST-W-01, JRN-08 | AC-X-01 | TEST-X-01, JRN-08 | | |
| AC-W-02 | TEST-W-02 | AC-X-02 | TEST-X-02 | | |
| AC-W-03 | TEST-W-03 | AC-X-03 | TEST-X-03 | | |
| AC-W-04 | TEST-W-04, JRN-08 | AC-X-04 | TEST-X-04, JRN-08 | | |
| AC-W-05 | TEST-W-05, TEST-B-03 | AC-X-05 | TEST-X-05, TEST-B-03 | | |
| AC-W-06 | TEST-W-06 | AC-X-06 | TEST-X-06, TEST-B-03 | | |
| AC-W-07 | TEST-W-07 | AC-X-07 | TEST-X-07 | | |

53 / 53 Sprint 3 ACs have at least one test. No authorization AC is proven by a UI test alone. M rows count only
with their evidence file.

## 4. Business rules with rejection (negative) tests

| BR | Rejection tested by | What is rejected |
|---|---|---|
| BR-18 | TEST-P-02, TEST-P-04, TEST-P-05 | Check-in outside the window; check-in of a cancelled registration; check-in by another organizer |
| BR-19 | TEST-P-04, TEST-P-06, TEST-P-02 | A second check-in (also when simultaneous); undo of a registration that is not checked in; undo after the window |
| BR-20 | TEST-Q-02, TEST-Q-03, TEST-S-03 | Counting no-shows or rates before the end; a rate with a zero divisor; history before the end |
| BR-14 (re-verified) | TEST-Q-04, TEST-R-02, TEST-V-04 | Another organizer's report, summary rows and banner |
| BR-16 (re-verified) | TEST-S-04 | Another participant's history |
| BR-17 (re-verified) | TEST-V-04 | Uploading a logo for another account |
| BR-21 | TEST-W-02 | Starting a non-tournament, a cancelled, a not-started, a one-player or an already started event; rounds over the cap |
| BR-22 | TEST-W-03, TEST-W-04, TEST-W-06 | Any rematch or second bye; pairing before the round is complete; a second round from a double click |
| BR-23 | TEST-X-01, TEST-X-02, TEST-X-04 | Out-of-range results; changing a bye or a closed round; any change after finishing |
| BR-24 | TEST-X-03 | A wrong tiebreak order (A must rank above E on OMW%) |

7 / 7 Sprint 3 BRs have a rejection test.

---

## 5. TDD record

Fill this table from the real runs (Sprint 1 README §3). P and T are built in the Deliverable 2 week, so their rows
are the Sprint 3 TDD evidence in the 29 Nov PDF.

| Issue | Tests written first | Red commit | Red run (failed / total) | Green commit | Green run (passed / total) |
|---|---|---|---|---|---|
| S3-01 Feature-P check-in | TEST-P-01 … 06, TEST-SR1-02 (revised), TEST-B-03 (E-18, E-19 rows) | | | | |
| S3-02 Feature-Q report | TEST-Q-01 … 05 | | | | |
| S3-03 Feature-R summary | TEST-R-01 … 05 | | | | |
| S3-04 Feature-S history | TEST-S-01 … 05 | | | | |
| S3-05 Feature-T throttling | TEST-T-01 … 05 | | | | |
| S3-06 Feature-V media | TEST-V-01 … 07 | | | | |
| S3-07 SR-05 accessibility | TEST-SR5-02 … 04 | | | | |
| S3-08 SR-06 performance | TEST-SR6-01, 02 | | | | |
| S3-10 Feature-W pairings | TEST-W-01 … 07 (engine tests W-03, W-07 first) | | | | |
| S3-11 Feature-X results and standings | TEST-X-01 … 07 | | | | |
| S3-09 Release `v1.0.0` | JRN-05 … 08, TEST-SR7-02, regression rows | | | | |

## 6. Results (filled at release)

| Item | Value |
|---|---|
| Release commit / tag | `v1.0.0` — Pending |
| Server / client / E2E counts (passed / failed / skipped) | Pending |
| Concurrency: TEST-P-06 and TEST-W-06, 20 rounds | Pending |
| Sprint 1 and 2 regression | Pending |
| Accessibility scan (serious / critical / moderate) | Pending |
| Load run p95 per endpoint | Pending |
| Coverage (`npm run sts:check` for all three sprints) | Pending |
| Failed / skipped tests and known limitations | Pending |

## 7. Test commands

These are the same as Sprint 1 STS §7, plus:

```bash
npm --prefix server run seed:perf
```

```bash
node scripts/perf.mjs events report summary
```

`npm run e2e` includes `e2e/sprint-3/`. The accessibility and responsive specs need the seed.

## 8. Version history

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 21 Nov 2026 | First draft: strategy additions (independent counts, boundaries, M evidence), tools, concurrency plan, 39 AC tests, 3 regression rows, JRN-05 … 07, AC map, BR rejection map, empty TDD and results tables | Team (AI-assisted) |
| v0.2 | 21 Nov 2026 | CH-12: §1.3 hand-computed standings fixture, TEST-W-06 race, §2.7 Feature-W and §2.8 Feature-X (14 tests incl. the 1,000-tournament property test and the 256-entry benchmark), JRN-08, AC map, BR-21 … BR-24 rejections, TDD rows S3-10, S3-11; 53 AC tests | Team (AI-assisted) |
| #118 | 25 Nov 2026 | With the contracts' #118 row. §1.3: fixtures under CH-13 (events starting within 60 minutes are written directly or reached by moving the clock); §2 points the work status to README §3. No test changes | Team (AI-assisted) |
