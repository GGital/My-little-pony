# Requirements-to-Features Traceability

Project: **TCG Event Hub** · Document version: v0.1 — draft for team review (branch `sprint-1/spec`)
Inputs: [`docs/srs.md`](srs.md) v0.5 · [`docs/features.md`](features.md) v0.2 · Diagrams: [`docs/diagrams/`](diagrams/README.md)

This is step 3 of the course design process. Every requirement is followed through four links, so anyone can
answer "where is this built, when, and how do we know it works?":

```
 Stakeholder problem ─► Requirement ─► Feature / SR ─► Sprint ─► Acceptance criterion ─► Test ─► Result
   (SRS §1.1)          (FR/BR/NFR)    (features.md)  (plan)    (Sprint contract, E)    (STS)   (Part F)
                        └──────────────── this document ───────────────┘
```

- **Sprint 1** requirements already have **planned acceptance-criterion IDs** (`AC-<feature>-nn`). The Sprint 1
  feature contracts define each one fully, and the Software Test Specification gives each a test with the same
  number (`AC-G-02` → `TEST-G-02`).
- **Sprint 2 and 3** requirements need a feature, a sprint and a verification method now. Their AC and test IDs
  are added when those contracts are written (course rule, Deliverable 1 §3.2).
- A requirement shared by several features is **established** in one sprint, by the first feature listed, and
  **re-verified** (rerun as a regression test) in the later sprints shown.

Verification levels: **U** unit test · **I** API + database integration test (real PostgreSQL) · **E** UI/end-to-end
test (component test or Playwright) · **M** manual check with recorded evidence.

---

## 1. Stakeholder problems → requirements

| Problem (SRS §1.1) | Requirements that solve it | Features | Sprint |
|---|---|---|---|
| P-01 Seats counted by hand → overbooking | BR-05, BR-07, FR-15 | Feature-G | 1 |
| P-02 Same player listed twice | BR-06, FR-01 | Feature-G, Feature-A | 1 |
| P-03 Players can't see if seats are left | FR-11, FR-12, FR-13 | Feature-F, Feature-J | 1, 2 |
| P-04 Paper check-in, no-shows unknown | FR-21, FR-22, BR-18, BR-19, BR-20 | Feature-P, Feature-Q | 3 |
| P-05 No attendance view across events | FR-23, FR-24 | Feature-Q, Feature-R | 3 |

---

## 2. Traceability matrix

### 2.1 Functional requirements

| Req. | What it requires (short) | Feature / SR | Established | Planned verification | Re-verified |
|---|---|---|---|---|---|
| FR-01 | Sign in, session with role | Feature-A | Sprint 1 | AC-A-01 · I, E | 2, 3 |
| FR-02 | One generic message for bad credentials | Feature-A | Sprint 1 | AC-A-02 · I | 3 (Feature-T) |
| FR-03 | Current-user request | Feature-A | Sprint 1 | AC-A-03 · I | 2, 3 |
| FR-04 | Sign-out ends the session | Feature-A | Sprint 1 | AC-A-04 · I, E | 2, 3 |
| FR-05 | Role navigation; protected pages redirect | Feature-C | Sprint 1 | AC-C-01, AC-C-02 · E | 2, 3 |
| FR-06 | Create and publish an event; owner recorded | Feature-D | Sprint 1 | AC-D-01 · I, E | 2 |
| FR-07 | Organizer's own events with counts | Feature-E | Sprint 1 | AC-E-01 · I, E | 2 |
| FR-08 | Draft events | Feature-K | Sprint 2 | I (draft hidden from others), E | 3 |
| FR-09 | Edit event, capacity, deadline | Feature-L, Feature-M | Sprint 2 | U (limits), I, E | 3 |
| FR-10 | Cancel event with reason, cascade | Feature-O | Sprint 2 | I (one transaction), E | 3 |
| FR-11 | Public list of upcoming events with counts | Feature-F | Sprint 1 | AC-F-01 · I, E | 2 (with filters) |
| FR-12 | Event detail with server-decided action; not found | Feature-F | Sprint 1 | AC-F-02, AC-F-03 · I, E | 2, 3 |
| FR-13 | Search, filters, paging | Feature-J | Sprint 2 | I, E | 3 (NFR-12) |
| FR-14 | Past/cancelled only on request, never registrable | Feature-J | Sprint 2 | I | 3 |
| FR-15 | Register → `REGISTERED` record returned | Feature-G | Sprint 1 | AC-G-01 · I, E | 2, 3 |
| FR-16 | Rejections store nothing and give a reason | Feature-G, SR-02 | Sprint 1 | AC-G-02 … AC-G-05 · I, E | 2 (deadline) |
| FR-17 | My Events: own registrations | Feature-H | Sprint 1 | AC-H-01 · I, E | 2 (statuses) |
| FR-18 | Organizer's registration list for own event | Feature-I | Sprint 1 | AC-I-01 · I, E | 3 (check-in) |
| FR-19 | Participant cancels before deadline | Feature-N | Sprint 2 | I, E | 3 |
| FR-20 | Re-register after cancelling | Feature-N | Sprint 2 | I | 3 |
| FR-21 | Check in during window | Feature-P | Sprint 3 | I, E | — |
| FR-22 | Undo check-in | Feature-P | Sprint 3 | I | — |
| FR-23 | Per-event attendance report | Feature-Q | Sprint 3 | U (rates), I | — |
| FR-24 | Organizer summary over a date range | Feature-R | Sprint 3 | U, I | — |
| FR-25 | Participant event history | Feature-S | Sprint 3 | I, E | — |
| FR-26 | Sign in, then return to the same event | Feature-C | Sprint 1 | AC-C-03 · E | 2, 3 |
| FR-27 | Header shows name, role, sign-out | Feature-C | Sprint 1 | AC-C-04 · E | 2, 3 |
| FR-28 | Who and when for every state change | SR-08 (Feature-L, N, O, P) | Sprint 2 | I (fields set from the session) | 3 (check-in) |

### 2.2 Business rules

| Req. | Rule (short) | Feature / SR | Established | Planned verification | Re-verified |
|---|---|---|---|---|---|
| BR-01 | Capacity 1–256 whole number | Feature-D | Sprint 1 | AC-D-02 · U, I | 2 (Feature-L) |
| BR-02 | Start in future; end after start, ≤ 24 h | Feature-D, SR-03 | Sprint 1 | AC-D-03 · U, I | 2 |
| BR-03 | Required fields and lengths | Feature-D | Sprint 1 | AC-D-04 · U, I | 2 |
| BR-04 | Visibility (published/cancelled public, drafts owner-only); only open events accept registrations | Feature-F, Feature-G | Sprint 1 | AC-F-04, AC-G-04 · I | 2 (drafts, cancelled, deadline) |
| BR-05 | Active registrations never exceed capacity | Feature-G, SR-01 | Sprint 1 | AC-G-02 · U, I | 2, 3 |
| BR-06 | One active registration per participant per event | Feature-G, SR-01 | Sprint 1 | AC-G-03 · I | 2 (re-register) |
| BR-07 | Exactly one winner for the last seat | Feature-G | Sprint 1 | AC-G-06 · I | 2, 3 |
| BR-08 | Registration deadline | Feature-M, SR-03 | Sprint 2 | U (boundaries), I | 3 |
| BR-09 | Capacity up to max; down only to active count | Feature-L | Sprint 2 | U, I | 3 |
| BR-10 | Only participants register | Feature-G, Feature-B | Sprint 1 | AC-G-05 · I | 2, 3 |
| BR-11 | Cancel own, `REGISTERED`, before deadline | Feature-N | Sprint 2 | I | 3 |
| BR-12 | Event cancel: not started, reason, cascade, final | Feature-O | Sprint 2 | I | 3 |
| BR-13 | Only organizers create events | Feature-B, Feature-D | Sprint 1 | AC-D-05 · I | 2 |
| BR-14 | Organizers manage only their own events | Feature-B, Feature-E, Feature-I | Sprint 1 | AC-E-02, AC-I-02 · I | 2, 3 |
| BR-15 | Frozen fields once started | Feature-L | Sprint 2 | U, I | 3 |
| BR-16 | Own registrations only; public sees counts; organizers see display names | Feature-B, F, H, I | Sprint 1 | AC-F-05, AC-H-02, AC-I-03 · I | 2, 3 |
| BR-17 | Identity only from the session | Feature-B | Sprint 1 | AC-B-01 · I | 2, 3 |
| BR-18 | Check-in: registered, owner, window | Feature-P, SR-03 | Sprint 3 | U (window), I | — |
| BR-19 | Check in once; undo in window | Feature-P | Sprint 3 | I | — |
| BR-20 | No-show and attendance-rate rule | Feature-Q, R, S | Sprint 3 | U | — |

### 2.3 Non-functional requirements

| Req. | Quality target (short) | Feature / SR | Established | Planned verification | Re-verified |
|---|---|---|---|---|---|
| NFR-01 | 401 without a valid session, no private data | Feature-B, Feature-A | Sprint 1 | AC-B-02 · I | 2, 3 (each new endpoint) |
| NFR-02 | 403 wrong role, 404 not owner; fixed check order | Feature-B, SR-02 | Sprint 1 | AC-B-03 · I | 2, 3 |
| NFR-03 | scrypt hash, no password in data or responses | Feature-A | Sprint 1 | AC-A-05 · U, I | — |
| NFR-04 | HttpOnly SameSite cookie, 8 h absolute, dead after sign-out | Feature-A | Sprint 1 | AC-A-04, AC-A-06 · U, I | Lab 5 (deployed) |
| NFR-05 | 20 simultaneous requests → exactly 1 wins | Feature-G | Sprint 1 | AC-G-06 · I | 2 (with cancel) |
| NFR-06 | Data survives restart; migrations only; seed reproducible | SR-01 | Sprint 1 | AC-SR1-01, AC-SR1-02 · I, M | 2, 3, Lab 5 |
| NFR-07 | One safe error shape | SR-02 | Sprint 1 | AC-SR2-01 · I | 2, 3 |
| NFR-08 | No horizontal scroll at 390 / 768 / 1440 px | SR-05, Feature-C | Sprint 1 (Sprint 1 screens) | AC-SR5-01 · E | 2, 3 (all screens) |
| NFR-09 | Loading, empty, error, field-validation states | Feature-C | Sprint 1 | AC-C-05 · E | 2, 3 |
| NFR-10 | Keyboard, labels, contrast, 0 serious axe issues | SR-05 | Sprint 3 | E (axe scan), M (keyboard walk-through) | — |
| NFR-11 | UTC storage, Bangkok display, server clock | SR-03 | Sprint 1 | AC-SR3-01 · U | 2, 3 |
| NFR-12 | < 500 ms p95 with 500 events / 5,000 registrations | SR-06 | Sprint 3 | M (scripted load run, results recorded) | — |
| NFR-13 | Environment config, no secrets, health check, Docker-ready | SR-04 | Sprint 1 (design) | AC-SR4-01 · I, M | Lab 5 (Docker, CI/CD, GCP) |
| NFR-14 | Every AC linked to a test; every BR has a negative test | SR-07 | Sprint 1 | AC-SR7-01 · M (traceability review) | 2, 3 |
| NFR-15 | Schema validation, no state change by GET, text shown as text | SR-02, Feature-C | Sprint 1 | AC-SR2-02, AC-SR2-03, AC-C-06 · I, E | 2, 3 |
| NFR-16 | 5 failed sign-ins in 10 min → 429 | Feature-T | Sprint 3 | I (fixed clock) | — |

### 2.4 Allocation summary

| Sprint | FR | BR | NFR established | Total |
|---|---|---|---|---|
| Sprint 1 | 15 | 12 | 13 | 40 |
| Sprint 2 | 8 | 5 | 0 | 13 |
| Sprint 3 | 5 | 3 | 3 | 11 |
| **All** | **28** | **20** | **16** | **64** |

### 2.5 Shared requirements: who establishes, who re-verifies

The matrix names the feature that **first proves** a requirement. These requirements are also relied on by later
features, which must rerun or extend the same checks. Each later feature's contract repeats the requirement in its
own acceptance criteria.

| Req. | Established by (sprint) | Also relied on by (sprint) | What the later feature must re-check |
|---|---|---|---|
| FR-02 | Feature-A (1) | Feature-T (3) | The lock-out message stays as generic as the bad-password message |
| BR-01 | Feature-D (1) | Feature-L (2) | Capacity edits respect 1–256 |
| BR-04 | Feature-F, Feature-G (1) | Feature-J, Feature-K, Feature-O (2) | Drafts hidden from others; cancelled shown but closed; filters never return drafts |
| BR-06 | Feature-G, SR-01 (1) | Feature-N (2) | After a cancel, one new active registration is allowed, and never two |
| BR-13 | Feature-B, Feature-D (1) | Feature-K (2) | Only organizers create drafts |
| NFR-02 | Feature-B, SR-02 (1) | Feature-E, H, I (1); Feature-K, O (2); Feature-S (3) | Each new endpoint is added to the permission-matrix test |
| NFR-05 | Feature-G (1) | Feature-N (2) | Cancel and re-register at the same time as others still never exceed capacity |
| NFR-07 | SR-02 (1) | Feature-D, Feature-G (1) | Their rejections use the shared error shape |
| NFR-08 | SR-05 (1) | Feature-C, Feature-F (1); every later screen | Each new screen is added to the three-width check |
| NFR-09 | Feature-C (1) | Feature-H (1); every later screen | Each new list or form has loading, empty and error states |
| NFR-10 | SR-05 (3) | Feature-Q (3) | Report tables are readable by screen readers and keyboard |
| NFR-11 | SR-03 (1) | Feature-D, F (1); Feature-L, M (2); Feature-P (3) | Every time boundary is tested with a fixed clock |
| NFR-12 | SR-06 (3) | Feature-J (2), Feature-R (3) | Filtered list and summary meet the 500 ms target |

---

## 3. Sprint 1 acceptance criteria catalogue (planned)

The one-line expected outcome below is what the feature contract must make precise (inputs, exact status codes,
response shapes). Each AC gets a test in the Software Test Specification with the same number.

| AC | Feature | Expected outcome (summary) | Traces to |
|---|---|---|---|
| AC-A-01 | A | A seeded user with the right password is signed in; the response and `GET /me` show their id, name and role | FR-01 |
| AC-A-02 | A | Wrong password and unknown email both give 401 with the same message; no session is created | FR-02 |
| AC-A-03 | A | `GET /me` with a valid session returns the user; without one returns 401 | FR-03 |
| AC-A-04 | A | After sign-out, the old cookie gets 401 on every protected endpoint | FR-04, NFR-04 |
| AC-A-05 | A | Stored passwords are scrypt hashes in the `scrypt$N$r$p$salt$hash` format with N = 2^15; no response contains `password` or `passwordHash` | NFR-03 |
| AC-A-06 | A | Cookie is HttpOnly and SameSite=Lax; a session older than 8 hours gets 401 (fixed clock) | NFR-04 |
| AC-B-01 | B | A `userId`, `role` or `organizerId` sent by the client is ignored; records belong to the session user | BR-17 |
| AC-B-02 | B | Every protected endpoint answers 401 without a session, with no private data in the body | NFR-01 |
| AC-B-03 | B | The permission matrix holds for every role/endpoint pair (403 wrong role, 404 not owner), in the order 401 → 403 → 404 | NFR-02 |
| AC-C-01 | C | Navigation shows only the links for the signed-in role | FR-05 |
| AC-C-02 | C | Opening a protected page while signed out goes to sign-in; a wrong-role page shows "Not available" | FR-05 |
| AC-C-03 | C | A visitor who clicks Register signs in and lands back on the same event | FR-26 |
| AC-C-04 | C | The header shows display name and role with Sign out; signed out, it shows Sign in | FR-27 |
| AC-C-05 | C | Lists show loading, empty and error states; forms show field errors and disable submit while saving | NFR-09 |
| AC-C-06 | C | An event description containing `<script>` is shown as plain text | NFR-15 |
| AC-D-01 | D | An organizer's valid event is saved as `PUBLISHED`, owned by that organizer, and appears in the public list | FR-06 |
| AC-D-02 | D | Capacity 0, −1, 1.5 and 257 are rejected; 1 and 256 are accepted | BR-01 |
| AC-D-03 | D | Past start, end not after start, or end more than 24 h after start are rejected | BR-02 |
| AC-D-04 | D | Missing required fields and over-length text are rejected with field details | BR-03 |
| AC-D-05 | D | A participant gets 403 and a visitor 401 when creating an event; nothing is stored | BR-13 |
| AC-E-01 | E | The dashboard lists the organizer's events with status, capacity, active count and seats left | FR-07 |
| AC-E-02 | E | The dashboard never includes another organizer's events | BR-14 |
| AC-F-01 | F | The list shows only upcoming published events, earliest first, with registered/capacity, to visitors too | FR-11 |
| AC-F-02 | F | The detail shows all public fields and the correct action for visitor, participant, registered participant, organizer and owner | FR-12 |
| AC-F-03 | F | An unknown event id answers "not found" | FR-12 |
| AC-F-04 | F | A started event is not in the upcoming list, and its detail shows registration closed | BR-04 |
| AC-F-05 | F | Public list and detail responses contain no participant names or emails | BR-16 |
| AC-G-01 | G | A participant registers for an open event with seats → 201, `REGISTERED`, seats left drop by one | FR-15 |
| AC-G-02 | G | Registering for a full event → 409 full; nothing stored | BR-05, FR-16 |
| AC-G-03 | G | Registering twice for the same event → 409 duplicate; still one record | BR-06, FR-16 |
| AC-G-04 | G | Registering for an event that has started → 409 closed; nothing stored | BR-04, FR-16 |
| AC-G-05 | G | An organizer trying to register → 403; nothing stored | BR-10, FR-16 |
| AC-G-06 | G | 20 simultaneous participants for 1 seat → exactly one 201; 5 simultaneous requests by one participant → at most one record | BR-07, NFR-05 |
| AC-H-01 | H | My Events lists only the signed-in participant's registrations, with event and status | FR-17 |
| AC-H-02 | H | Asking for another participant's registration answers 404 with no data | BR-16 |
| AC-I-01 | I | The owner sees the registrations for their event: display name, time, status, count vs capacity | FR-18 |
| AC-I-02 | I | Another organizer asking for that list gets 404 | BR-14 |
| AC-I-03 | I | A participant asking for any registration list gets 403; no email appears in the owner's list | BR-16 |
| AC-SR1-01 | SR-01 | A saved event and registration are read back through a new connection and after a server restart | NFR-06 |
| AC-SR1-02 | SR-01 | Running the seed twice creates no duplicates; it provides ≥ 2 organizers and ≥ 3 participants | NFR-06 |
| AC-SR2-01 | SR-02 | Every error (400/401/403/404/409/500) uses the shared shape, with no stack trace or SQL | NFR-07 |
| AC-SR2-02 | SR-02 | Wrong types, out-of-range values and unknown fields → 400 with field details | NFR-15 |
| AC-SR2-03 | SR-02 | No GET request changes stored data | NFR-15 |
| AC-SR3-01 | SR-03 | "Upcoming" and "started" are decided by the server clock at exact, −1 min and +1 min boundaries; times leave the API in UTC and show in Bangkok time | NFR-11 |
| AC-SR4-01 | SR-04 | `.env.example` lists every variable; the secret scan finds nothing; `/api/health` is 200 with the database and 503 without | NFR-13 |
| AC-SR5-01 | SR-05 | Every Sprint 1 screen has no horizontal scroll at 390, 768 and 1440 px | NFR-08 |
| AC-SR7-01 | SR-07 | Every Sprint 1 AC has a test in the STS, every Sprint 1 BR has a negative test, and the release results table is complete | NFR-14 |

47 planned acceptance criteria for Sprint 1. Each Sprint 1 BR (BR-01 … BR-07, BR-10, BR-13, BR-14, BR-16, BR-17)
has at least one rejection criterion, so NFR-14's "negative test for every BR" holds for Sprint 1.

---

## 4. Coverage gaps and approved changes

### 4.1 Gaps

| Check | Result |
|---|---|
| Every FR, BR and NFR in SRS v0.4 appears in the matrix | 64 / 64 — no gaps |
| Every Sprint 1 requirement has at least one planned AC | 40 / 40 |
| Every planned AC traces back to a requirement | 47 / 47 |
| Matrix owners agree with the feature inventory | yes. Differences are the later users listed in §2.5 |
| Requirements without a sprint | none |
| Requirements waiting on the TA | none blocked. Q-01 (public list) and Q-02 (TCG context) affect wording only |

These checks are run by a script against the documents, not counted by hand.

### 4.2 Approved changes since the first SRS draft

A review pass on 4 Nov 2026 compared the SRS, the feature inventory and the diagrams line by line. These changes were
made. Each still needs the teammate's approval in the spec Pull Request.

| Change | What changed | Why | Affects |
|---|---|---|---|
| CH-01 | BR-04 rewritten: cancelled events stay visible, drafts are owner-only | The old wording hid cancelled events, which contradicted FR-14 and broke the "My Events → open event" link in FR-17 | Feature-F, J, K, O |
| CH-02 | FR-28 added: who and when for every state change (SR-08) | No requirement recorded who cancelled or checked in, but reports and disputes need it (compare the lecture POS "Audit Trail") | Feature-L, N, O, P |
| CH-03 | NFR-15 added: input validation, no state change by GET, text shown as text | Common web attacks (bad input, forged requests, script injection) had no measurable requirement | SR-02, Feature-C |
| CH-04 | NFR-16 added: sign-in throttling (Feature-T, Sprint 3) | Password guessing was not limited | Feature-A, T |
| CH-05 | "Upcoming" defined; FR-12 states the action button and "not found"; FR-13 paging; FR-17 opens the event detail | The words were used but not defined, so they could not be tested | Feature-F, H, J |
| CH-06 | BR-08 deadline cannot be set in the past; BR-09 capacity respects BR-01; BR-12 needs a reason of 5–200 characters; BR-15 lists every frozen field | Boundary cases had no defined answer | Feature-L, M, O |
| CH-07 | BR-16 and D-14: organizers see display names, not emails | Data minimisation; email is not needed for check-in | Feature-I |
| CH-08 | NFR-02 check order 401 → 403 → 404 → 409/422; NFR-04 8 h is absolute; NFR-13 health check | Makes the expected status code unambiguous and prepares Lab 5 | Feature-A, B, SR-02, SR-04 |
| CH-09 | A-06 seed has ≥ 2 organizers and ≥ 3 participants; C-06 supported browsers; Q-08, Q-09 overlap questions resolved; X-08 reference fixed | Ownership tests need two users of each role; scope questions answered before building | SR-01 |
| CH-10 | NFR-03 hashing changed from bcrypt to scrypt (D-15) | Chosen while writing the SDS: reuses reviewed TokTickIT code and avoids a native dependency in Docker | Feature-A, AC-A-05 |

No requirement was withdrawn and no ID was renumbered.

---

## 5. How this document is maintained

- A Pull Request that adds or changes a requirement, feature, AC or test updates this matrix in the same PR.
- At each sprint release, the "Planned verification" column gains the **actual test file/name and result**
  (Deliverable 1 Part F results table). A requirement is "verified" only when its tests ran on the release commit.
- When a later sprint's contract is written, its rows gain AC IDs in the same `AC-<feature>-nn` form.

## 6. Change log

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 4 Nov 2026 | First matrix: 64 requirements (40 in Sprint 1), 47 planned Sprint 1 ACs, shared-requirement table, problem trace, gaps and approved changes CH-01 … CH-09 | Team (AI-assisted) |
| v0.2 | 4 Nov 2026 | CH-10: scrypt instead of bcrypt (NFR-03, AC-A-05) | Team (AI-assisted) |
