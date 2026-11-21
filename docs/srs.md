# Software Requirements Specification (SRS)

Project: **TCG Event Hub** — Event Registration and Attendance System
Course: CPE 334, Semester 1/2026 — Theme 3 (Event Registration and Attendance System)
Team: Phattaratorn Mahatkeerati (67070503433, [@GGital](https://github.com/GGital)) ·
Praewa Thuwatharanimitkul (67070503432, [@MeldyRose](https://github.com/MeldyRose))
Document version: v0.7 — draft for team review in PR #76 (CH-11 store identity incl. contact, CH-12 tournaments, D-16 … D-38); v0.5 approved in PR #2
Companion documents: [`docs/features.md`](features.md), [`docs/traceability.md`](traceability.md),
[`docs/diagrams/`](diagrams/README.md), [`docs/ui/design-direction.md`](ui/design-direction.md), [`docs/system-sds.md`](system-sds.md), [`docs/sprints/plan.md`](sprints/plan.md),
[`docs/sprints/sprint-1/`](sprints/sprint-1/README.md), [`docs/sprints/sprint-2/`](sprints/sprint-2/README.md),
[`docs/sprints/sprint-3/`](sprints/sprint-3/README.md)

This SRS describes the **whole product** across all three sprints. Every requirement has a stable identifier
(`FR-nn`, `BR-nn`, `NFR-nn`) that never changes meaning once the document is approved. Requirements are never
renumbered; a withdrawn requirement is marked *Withdrawn* with a reason in the change log (Section 11). Each
requirement names the sprint that delivers it; the sprint plan and traceability matrix refine that allocation.

---

## 1. Stakeholder problem

The stakeholder brief (group work specification, Theme 3) reads:

> Organizers publish events, manage limited places, and record attendance. Participants discover events and
> register. The finished product should cover publication, capacity, registration/cancellation, organizer
> management, check-in, and attendance reporting. Clarify duplicate registration, registration deadlines, and
> capacity changes.

### 1.1 Chosen context: trading-card-game store events

We specialise the brief for **trading-card-game (TCG) organised play** at local game stores. Stores and community
organizers run weekly casual nights, competitive tournaments, and release events. Each event has a fixed number of
seats, because a store has a fixed number of tables, and every match needs an opponent.

Today a typical store takes sign-ups through chat messages and a paper list. The pain points are:

| # | Problem today | Consequence | Addressed by |
|---|---|---|---|
| P-01 | Seats are counted by hand | Events are overbooked, or the last seats go to whoever messages twice | BR-05, BR-07, FR-15 |
| P-02 | The same player is listed twice under different spellings | Phantom seats; the real count of players is unknown | BR-06, FR-01 (one account per player) |
| P-03 | Players do not know whether seats are left until they ask | Lost players and repeated questions to staff | FR-11, FR-12, FR-13 |
| P-04 | Check-in at the door is a paper tick list | No reliable record of who actually came; no-shows cannot be measured | FR-21, FR-22, BR-18–BR-20 |
| P-05 | Organizers cannot see attendance across events | They cannot plan table counts or prize support | FR-23, FR-24 |
| P-06 | A store runs several card games, and an event title does not always say which one | Players open the wrong events, or arrive with the wrong deck | FR-29, FR-30 (CH-11) |
| P-07 | Every event looks the same in the list, so players cannot spot their usual store | Regulars miss their store's events | FR-30, FR-31 (CH-11) |
| P-08 | Tournament rounds are paired by hand on paper and results are added up on a calculator | Rematches, wrong standings and disputes about who won | FR-32 … FR-37, BR-21 … BR-24 (CH-12) |

### 1.2 UX reference

The product's look and flow are informed by the public event locator of a commercial TCG
(playriftbound.com/en-US/events): players search for nearby store events, filter by event type and format, read an
event card showing store, date/time, format, entry fee and seats, open a detail page, and register. We use only
these *interaction patterns*; we do not copy names, branding, art or text from that product (decision D-02).

The reference list page and three public event detail pages were opened in a browser on 4 Nov 2026
(question Q-07). What we observed, and what we adopt:

| Observed on the reference | What it does for the user | Our product |
|---|---|---|
| Two tabs at the top: **Find an Event** and **My Events** | Separates discovering events from "where am I going" | Adopted: participant navigation is *Find an Event* (FR-11) and *My Events* (FR-17) |
| Site header with the signed-in account's screen name in a drop-down menu (top right) | Shows who is signed in and holds the sign-out action | Adopted: header account menu with display name, role and **Sign out** (FR-27) |
| Filters: **Where** (location, with a "use my location" button), **Event Type** (multi-select), **Format** | Narrow the list to relevant events | Adopted in Sprint 2 as city/text search, event-type and format filters (FR-13); "use my location" excluded (X-06) |
| List controls: **Upcoming Events**, **Distance**, **Sort by**, **Show only Favorited stores**, **Map** toggle | Sort and personalise the list | Sorted by start time only (FR-11); distance, map and favourite stores excluded (X-06, X-13) |
| **Event card** in the list: a date badge (**NOV / 5**), weekday and time (**THURSDAY · 5:00 PM**), title, a line *event type · play style · format* (**Nexus Nights · 1v1 · Constructed**), a store line (store · distance · district), and two chips on the right: entry fee (**THB 250**) and players (**0/16**) | Everything needed to choose an event in one row | Adopted, with our own visual theme (D-13): date badge, weekday/time, title, type · format, venue · city, fee chip and seats chip (FR-11). Distance and the favourite heart are excluded (X-06, X-13) |
| Detail header: store name, event title, **Date**, **Time**, **Players 0 / 16** | Shows at a glance when it is and how full it is | Adopted: detail shows registered/capacity and seats remaining (FR-12) |
| One main button whose label follows the state: **Register**, or a disabled **Event is closed** when full (9 / 9) or over | The user always knows whether they can act | Adopted: Register / Registered / Full / Closed states (FR-12, FR-16) |
| **Event Details**: free-text description written by the store (rules, prizes, house policies such as no-show bans) | Lets each store explain its own event | Adopted as the description field (FR-06) |
| Event-type label, full **street address**, and a play line such as **Constructed • 1v1 • Swiss**, **4 Rounds • Best of 3 • $20** | Practical facts a player needs before going | Adopted: type, format, venue address, rounds/structure note and entry-fee label (FR-06); no payment (X-02) |
| **Contact**: store website, email, phone | Lets the player ask the store directly | Adopted as an optional contact field on the event (FR-06) |
| **Registered Players 9 / 9** with every player's screen name listed publicly; "No registered players at this time" when empty | Social proof; shows who is coming | **Not adopted**: other participants' registrations stay private (BR-16, decision D-12). The empty-state wording pattern is adopted for our lists |
| After the event starts: **Rounds / Standings / Roster** tabs and table pairings | Runs the tournament itself | Excluded (X-05) |

---

## 2. Actors and responsibilities

| Actor | Who they are | Responsibilities in the product | Account? |
|---|---|---|---|
| **Participant** (player) | A TCG player | Browse published events; register for an event; see and (Sprint 2) cancel their own registrations; (Sprint 3) see their attendance history | Yes — seeded |
| **Organizer** | Store staff or a community tournament organizer | Create and publish events they own; manage capacity, deadline and event details; view registrations for their events; (Sprint 3) check players in and read attendance reports | Yes — seeded |
| **Visitor** | Anyone who is not signed in | Browse the public list and detail of published events (read-only, no participant names) | No |
| **System** | The application itself | Enforce rules, count seats, close registration at the deadline, keep time in one zone | — |

Role rules for accounts:

- Every account has **exactly one role**: `PARTICIPANT` or `ORGANIZER` (decision D-05). Multiple roles per account
  are out of scope.
- Accounts are **seeded**. There is no self-registration, password recovery, or account administration screen
  (X-01).
- An organizer **owns** each event they create. An organizer can manage only events they own (BR-14). There is no
  co-organizer or "all events" administrator role (X-08).

### 2.1 Access summary

The table summarises who may use each part of the product. The System-Level SDS turns it into the full
role/permission matrix, and every "No" is enforced by the backend (BR-17), not only by hiding a button.

| Screen or operation | Visitor (signed out) | Participant | Organizer |
|---|---|---|---|
| Find an Event list and event detail (published events only) | Yes | Yes | Yes |
| Sign in | Yes | — | — |
| Sign out, see own identity in the header | — | Yes | Yes |
| Register for an event | No → sent to sign in (FR-26) | Yes, within BR-04 to BR-07 | No (BR-10) |
| My Events — own registrations | No → sent to sign in | Own only (BR-16) | No |
| Cancel own registration (Sprint 2) | No | Own only | No |
| Create / publish an event | No | No (BR-13) | Yes |
| Organizer dashboard: own events, edit, cancel (Sprint 2) | No | No | Own events only (BR-14) |
| Registration list of an event (display names only) | No | No | Own events only (BR-14, BR-16) |
| See a draft event (Sprint 2) | No | No | Own drafts only (BR-04) |
| Check-in and attendance report (Sprint 3) | No | No | Own events only (BR-18) |
| Run a tournament: pairings, results, standings (Sprint 3) | No | No | Own events only (BR-14) |
| See own tournament pairing, record and placing (Sprint 3) | No | Own only; sees the display name of their own current opponent (D-32) | No |
| Store profile: games played and contact details (Sprint 2), logo (Sprint 3) | No | No | Own profile only (BR-17) |
| See a store's contact details on its events | Yes | Yes | Yes |
| Event banner (Sprint 3) | No | No | Own events only (BR-14) |

---

## 3. Product scope

### 3.1 In scope (whole product)

| # | Capability | Sprint |
|---|---|---|
| S-01 | Sign in, sign out and current-user identity with two roles | 1 |
| S-02 | Organizer creates and publishes an event with type, format, venue, time, entry-fee label and capacity | 1 |
| S-03 | Event discovery: a list of upcoming published events with seats remaining, and an event detail page | 1 (list, detail) · 2 (search, filters) |
| S-04 | Registration with capacity, duplicate and timing rules, safe under simultaneous requests for the last seat | 1 |
| S-05 | "My registrations" for participants; "My events" and the registration list for organizers | 1 |
| S-06 | Participant cancellation; registration deadline; organizer edits, capacity change and event cancellation; draft events | 2 |
| S-07 | Check-in at the venue; attendance status; no-show recording | 3 |
| S-08 | Attendance reporting per event and an organizer summary across their events | 3 |
| S-09 | Participant event history (attended / no-show / cancelled) | 3 |
| S-10 | The game of each event, a store's list of games, and a filter by game (CH-11) | 2 |
| S-11 | Store logo and event banner images (CH-11) | 3 |
| S-12 | Swiss tournament support for `TOURNAMENT` events: pairings, byes, drops, match results, standings with tiebreakers and the winner (CH-12) | 3 |

### 3.2 Explicit exclusions

| # | Excluded from the whole product |
|---|---|
| X-01 | Self sign-up, password reset, email verification, account administration screens, and profile editing (the display name, email and password cannot be edited). *Revised in v0.6 (CH-11):* an organizer may set their store's games and logo |
| X-02 | Real payment. The entry fee is a **display label** only (for example "฿150, pay at store"); nothing is charged |
| X-03 | Email, SMS, LINE, push or any external notification |
| X-04 | Waitlists and automatic promotion from a waitlist (decision D-07) |
| X-05 | Tournament software beyond Swiss rounds: single-elimination top cuts, prizes, deck lists, judge calls, round timers, and players reporting their own results. *Revised in v0.7 (CH-12):* Swiss pairings, match results, standings and the winner are now in scope (FR-32 … FR-37) |
| X-06 | Maps, geolocation and distance search (the list filters by city text instead) |
| X-07 | Recurring-event series. Each weekly event is created as a separate event |
| X-08 | Multiple roles per account, co-organizers, store/organisation accounts shared by several users, and an all-events administrator. The "store profile" of CH-11 is a set of fields on the one organizer account, not a separate store account (A-03) |
| X-14 | Publisher game logos, card art or official branding. A game is shown by name only (D-02, CH-11) |
| X-09 | Team events (one registration = one player) and guest/plus-one seats |
| X-10 | QR-code scanning hardware or a mobile app; check-in is done in the web UI (QR codes are a possible later extension, not a requirement) |
| X-11 | Hard deletion of events or registrations. Records are cancelled, never deleted, so history and reports stay correct |
| X-12 | Multi-language UI and multiple time zones (one zone: Asia/Bangkok, NFR-11) |
| X-13 | Favourite stores, personalised recommendations and a public list of registered players |

---

## 4. Domain vocabulary

| Term | Meaning in this product |
|---|---|
| **Event** | One dated TCG session at a venue, with a fixed seat capacity, owned by one organizer |
| **Event type** | `CASUAL` (weekly casual night), `TOURNAMENT` (competitive, prizes) or `RELEASE` (new-set / pre-release event) |
| **Format** | How cards are played: `CONSTRUCTED` (bring your own deck), `SEALED` or `DRAFT` (decks built at the event from new packs) |
| **Capacity** | The maximum number of *active* registrations an event may hold (positive whole number) |
| **Seats remaining** | Capacity minus the event's active registrations, computed by the backend |
| **Upcoming** | An event whose start time is later than the server's current time |
| **Event status** | `DRAFT` (Sprint 2) → `PUBLISHED` → `CANCELLED` (Sprint 2). An event is *past* once its end time has passed; this is derived from time, not stored |
| **Registration** | One participant's place at one event |
| **Active registration** | A registration in status `REGISTERED` or `CHECKED_IN`; it occupies a seat |
| **Registration status** | `REGISTERED` → `CANCELLED` (by participant, Sprint 2) or `EVENT_CANCELLED` (by organizer, Sprint 2) or `CHECKED_IN` (Sprint 3). `NO_SHOW` is reported for a `REGISTERED` record whose event has ended (Sprint 3) |
| **Registration deadline** | The last moment registration is accepted. Defaults to the event start time (Sprint 2) |
| **Check-in window** | From 60 minutes before the start until the end of the event (Sprint 3) |
| **Game** | The trading card game an event is for: `POKEMON`, `MAGIC`, `ONE_PIECE`, `YUGIOH`, `DIGIMON`, `LORCANA` or `OTHER`, shown by name only (CH-11) |
| **Store profile** | Fields of an organizer account that describe their store: the games it runs and its public contact details (Sprint 2), and its logo (Sprint 3). The store name is the organizer's display name |
| **Banner** | An optional wide (3 : 1) image an organizer adds to one event (Sprint 3) |
| **Tournament** | The Swiss rounds of one `TOURNAMENT` event. Status `NOT_STARTED` → `RUNNING` → `FINISHED` (CH-12) |
| **Entry** | One checked-in player taking part in a tournament; fixed when round 1 is paired |
| **Round · match · table** | A round pairs every active entry into matches; each match has a table number. A **bye** is a match with no opponent |
| **Match points** | Win 3, draw 1, loss 0; a bye counts as a 2–0 win |
| **Standings** | Entries ordered by match points, then OMW%, GW%, OGW% (BR-24) |

---

## 5. Functional requirements (FR)

Each requirement states observable behaviour. "The system" means the backend; the UI must reflect the same
behaviour but is never the only enforcement point.

### 5.1 Identity and access — Sprint 1

- **FR-01** The system shall let a seeded user sign in with email and password, and shall start an authenticated
  session that identifies the user and their role.
- **FR-02** The system shall reject a sign-in with an unknown email or a wrong password with one generic message,
  without revealing which of the two was wrong.
- **FR-03** The system shall return the signed-in user's id, display name, email and role from a current-user
  request, and shall report "not signed in" when there is no valid session.
- **FR-04** The system shall end the session on sign-out so that the same session can no longer access any
  protected operation.
- **FR-05** The UI shall show navigation that matches the signed-in role and shall send a signed-out user who opens
  a protected page to the sign-in page.
- **FR-26** When a signed-out visitor chooses **Register** on an event, the UI shall send them to the sign-in page
  and, after a successful sign-in, return them to the same event page. Registration itself still requires the
  server-side checks of FR-15.
- **FR-27** The UI shall show the signed-in user's display name and role in the site header, with a menu that
  contains **Sign out**; a signed-out header shows **Sign in** instead.

### 5.2 Event publication and management

- **FR-06** *(Sprint 1)* The system shall let an organizer create and publish an event with: title, event type,
  format, venue name, venue address, city, start date/time, end date/time, capacity, entry-fee label, play
  structure note (for example "4 rounds · Best of 3 · Swiss"), contact and description. The organizer becomes the
  event's owner.
- **FR-07** *(Sprint 1)* The system shall show an organizer the list of events they own, with each event's status,
  capacity, active registrations and seats remaining.
- **FR-08** *(Sprint 2)* The system shall let an organizer save an event as a draft that participants cannot see,
  and publish it later.
- **FR-09** *(Sprint 2)* The system shall let the owning organizer edit an event's details, including its capacity
  and registration deadline, within the limits of BR-08, BR-09 and BR-15.
- **FR-10** *(Sprint 2)* The system shall let the owning organizer cancel an upcoming event with a reason; every
  active registration then becomes `EVENT_CANCELLED` and the event no longer accepts registrations.

### 5.3 Event discovery

- **FR-11** *(Sprint 1)* The system shall list upcoming published events, ordered by start time (earliest first),
  showing title, type, format, venue, city, date/time, entry-fee label, registered/capacity (for example
  "12 / 32") and seats remaining. Signed-in
  and signed-out users may view the list.
- **FR-12** *(Sprint 1)* The system shall show an event's detail page with all public fields, its seats remaining
  and the action the current viewer may take (sign in to register, register, already registered, full, closed, or
  manage for the owner), decided by the server. An event id that does not exist, or that the viewer may not see
  (BR-04), answers "not found".
- **FR-13** *(Sprint 2)* The system shall let users search the list by text (title, venue or city) and filter it
  by event type, format, date range, and "seats available only", and page through results 20 at a time.
- **FR-14** *(Sprint 2)* The system shall show past and cancelled events only when the user explicitly asks for
  them; they are never registrable.

### 5.4 Registration

- **FR-15** *(Sprint 1)* The system shall let a signed-in participant register for a published, upcoming event,
  creating a registration in status `REGISTERED` for that participant, and shall respond with the saved
  registration.
- **FR-16** *(Sprint 1)* The system shall reject a registration that breaks BR-04 to BR-07 or BR-10, store
  nothing, and return a specific reason the UI can show (for example "This event is full").
- **FR-17** *(Sprint 1)* The system shall show a participant the list of their own registrations with event title,
  date/time, venue, and registration status, and shall let them open each event's detail page from it.
- **FR-18** *(Sprint 1)* The system shall show the owning organizer the list of registrations for one of their
  events: participant display name, registration time and status, with the active count and capacity.
- **FR-19** *(Sprint 2)* The system shall let a participant cancel their own active registration before the
  registration deadline, which frees the seat.
- **FR-20** *(Sprint 2)* The system shall let a participant register again for the same event after cancelling,
  subject to all registration rules.

### 5.5 Check-in and attendance — Sprint 3

- **FR-21** The system shall let the owning organizer check in a registered participant during the check-in
  window, recording the time and the organizer who did it.
- **FR-22** The system shall let the owning organizer undo a mistaken check-in during the same window.
- **FR-23** The system shall show, for each of an organizer's events, an attendance report: capacity,
  registrations, cancellations, checked-in count, no-show count and attendance rate.
- **FR-24** The system shall show an organizer a summary across their events in a chosen date range: number of
  events, total registrations, total check-ins, and average fill rate and attendance rate.
- **FR-25** The system shall show a participant their event history with each event's final status
  (attended, no-show, cancelled, event cancelled).

### 5.6 Record keeping — Sprints 2 and 3

- **FR-28** The system shall record who performed, and when, each state change of an event or registration:
  registration created, registration cancelled, event published, event cancelled (with its reason), capacity or
  deadline changed, check-in and check-in undone. Owners can see this information on the records they manage;
  records are never deleted (X-11). *(Sprint 2 for cancellations and changes, Sprint 3 for check-in.)*

### 5.7 Store identity and game — added by CH-11 (v0.6)

- **FR-29** *(Sprint 2)* The system shall record the **game** each event is for, chosen by the organizer from a fixed
  list (see §4, *Game*). Players can filter the event list by game.
- **FR-30** *(Sprint 2: games and contact · Sprint 3: logo)* The system shall let an organizer keep a **store
  profile** on their own account: the games the store runs, the store's public **contact details** (phone, email,
  website, LINE ID; all optional), and an optional store logo. The games and contact details are shown on every
  event of the store, alongside the event's own optional contact note (FR-06); the logo also appears in search
  results.
- **FR-31** *(Sprint 3)* The system shall let the owning organizer add, replace or remove an optional **banner
  image** on an event. Without a banner, the event page shows a neutral playmat pattern with no game or publisher
  name.

### 5.8 Tournaments — added by CH-12 (v0.7), Sprint 3

- **FR-32** The system shall let the owning organizer **start** the tournament of a `TOURNAMENT` event: every
  checked-in player becomes an entry, the number of rounds is set (default ⌈log₂ entries⌉), and round 1 is paired.
- **FR-33** The system shall **pair each round** by the Swiss method (BR-22): players with the same or nearest match
  points meet, nobody meets the same opponent twice, and one bye is given when the number of active entries is odd.
- **FR-34** The system shall let the owning organizer **record and correct match results** (games won by each player
  and drawn games) for the current round.
- **FR-35** The system shall compute **standings** with tiebreakers (BR-24) and, when the owner finishes the
  tournament after its last round, record the **winner** (rank 1) and every final placing.
- **FR-36** The system shall show a participant their **own** tournament view: the current table and opponent, their
  own record (wins–losses–draws, points) and their final placing, also in their event history (FR-25).
- **FR-37** The system shall let the owning organizer **drop** an entry before the next round is paired; a dropped
  entry keeps its results and its place in the standings but is not paired again.

---

## 6. Business rules (BR)

Business rules are the domain's "must always be true" statements. Each one is enforced by the backend, and the
database where a constraint can express it.

### 6.1 Event rules

- **BR-01** *(Sprint 1)* Capacity is a whole number from **1 to 256**. Zero, negative, fractional or larger values
  are rejected.
- **BR-02** *(Sprint 1)* A new event's start time must be **in the future**, and its end time must be **after** its
  start time and **no more than 24 hours** after it.
- **BR-03** *(Sprint 1)* Title (3–100 characters), event type, format, venue name, venue address, city, start,
  end and capacity are required. Entry-fee label (up to 40 characters), play structure note (up to 80), contact (up
  to 120) and description (up to 2,000 characters) are optional.
- **BR-04** *(Sprint 1)* **Visibility and openness.** `PUBLISHED` and `CANCELLED` events are visible to everyone
  (a cancelled event is shown as cancelled); a `DRAFT` event is visible only to its owner (Sprint 2). Only a
  `PUBLISHED` event that has not started (and, from Sprint 2, whose deadline has not passed) accepts registrations.

### 6.2 Registration rules

- **BR-05** *(Sprint 1)* **Capacity.** A registration is accepted only if the event's active registrations are
  fewer than its capacity. The count of active registrations can never exceed capacity.
- **BR-06** *(Sprint 1)* **One active registration per participant per event.** A second registration attempt by
  the same participant while they hold an active one is rejected and no second record is stored. This answers the
  brief's "duplicate registration" question.
- **BR-07** *(Sprint 1)* **Last seat under competition.** When several participants request the last seat at the
  same moment, exactly one registration succeeds; the rest are rejected as "full". BR-05 and BR-06 must hold even
  for simultaneous requests and repeated clicks.
- **BR-08** *(Sprint 2)* **Registration deadline.** Each event has a registration deadline that defaults to its
  start time. The organizer may set it earlier, never later than the start, and never earlier than the moment it is
  set. After the deadline, registration and participant cancellation are rejected.
- **BR-09** *(Sprint 2)* **Capacity changes.** The owning organizer may raise capacity, up to the BR-01 maximum, at
  any time before the event starts. They may lower it only down to the current number of active registrations, never below; existing
  registrations are never removed by a capacity change. This answers the brief's "capacity changes" question.
- **BR-10** *(Sprint 1)* Only users with the `PARTICIPANT` role can register. An organizer cannot register for any
  event, including their own.
- **BR-11** *(Sprint 2)* A participant can cancel only their own registration and only while it is `REGISTERED` and
  before the deadline. A cancelled registration keeps its record; it no longer occupies a seat.
- **BR-12** *(Sprint 2)* Only an event that has not started can be cancelled, and a reason of 5–200 characters is
  required. When it is cancelled, all its active registrations become `EVENT_CANCELLED` in the same transaction, the
  event stops accepting registrations, and the cancellation cannot be undone.

### 6.3 Ownership and privacy rules

- **BR-13** *(Sprint 1)* Only organizers can create events. Participants and visitors cannot.
- **BR-14** *(Sprint 1)* An organizer can view the registration list of, and manage, **only events they own**.
- **BR-15** *(Sprint 2)* Once an event has started, its start time, end time, capacity and deadline can no longer be
  changed; only its description, play structure note, contact and entry-fee label may be edited.
- **BR-16** *(Sprint 1)* A participant can see **only their own** registrations. Other participants' names and
  registrations are never shown to participants or visitors (one exception from Sprint 3: a tournament player sees
  their own current opponent's display name, D-32); the public sees only registered/capacity and seats
  remaining. The owning organizer sees each participant's **display name**, never their email (D-14).
- **BR-17** *(Sprint 1)* The identity used for every protected operation comes from the authenticated session.
  The backend never trusts a user id or role sent by the client.

### 6.4 Attendance rules — Sprint 3

- **BR-18** Check-in is allowed only for a `REGISTERED` registration, only by the event's owner, and only during
  the check-in window (60 minutes before start until the end).
- **BR-19** A registration can be checked in at most once. An undo returns it to `REGISTERED` and is allowed only
  during the check-in window.
- **BR-20** After an event ends, every registration still `REGISTERED` is reported as a **no-show**. Attendance
  rate = checked-in ÷ (checked-in + no-show). An event with no such registrations shows "—", not 0% or an error.

### 6.5 Tournament rules — added by CH-12 (v0.7), Sprint 3

- **BR-21** **Starting a tournament.** Only a `PUBLISHED` event of type `TOURNAMENT` that is in progress
  (`startAt ≤ now < endAt`, so it can no longer be cancelled, BR-12) can start, once, and only with **at least 2**
  checked-in players. Later rounds, results and finishing may run past `endAt`. The entries are exactly the players
  checked in at that moment; a player checked in later does not join (D-31). Rounds: from 1 to ⌈m ÷ 2⌉, where m is
  the number of entries rounded up to even (this bound guarantees a pairing without rematches, SDS SD-14).
- **BR-22** **Swiss pairing.** Round 1 pairs entries in a random order from a stored seed. Every later round orders
  active entries by standings and pairs from the top, each with the highest-placed entry it has not met; when a
  score group cannot be paired, the lowest entry of that group moves down to the next group. **No two entries meet
  twice.** With an odd number of active entries, the lowest-placed entry that has not had a bye gets the bye. A round
  can be paired only when every match of the previous round has a result.
- **BR-23** **Results.** A result is games won by each player and drawn games, each a whole number 0–3 with a total
  of 1–5. The player with more game wins wins the match; equal game wins is a drawn match. Match points: win 3,
  draw 1, loss 0; a bye is a 2–0 win. A round's results can be corrected only until the next round is paired; after
  the tournament is finished, nothing can change. Only the owning organizer records results (D-33).
- **BR-24** **Standings and winner.** Order: match points; then opponents' match-win percentage (OMW%); then game-win
  percentage (GW%); then opponents' game-win percentage (OGW%); then earliest registration. Each percentage counts
  at least 1/3 per opponent, and byes are left out of opponents' percentages. Dropped entries stay in the standings.
  The winner is rank 1 when the owner finishes the tournament after the last round.

---

## 7. Non-functional requirements (NFR)

Every NFR has a measurable target, a verification method, and the sprint where that verification first runs.
Later sprints rerun earlier checks as regression tests.

| ID | Quality | Requirement and measurable target | Verification | Sprint |
|---|---|---|---|---|
| **NFR-01** | Security — authentication | Every protected API endpoint returns **401** to a request with no session or an expired session, and the response contains no private data | API integration tests, one per protected endpoint group | 1 |
| **NFR-02** | Security — authorization | A signed-in user who calls an operation outside their role gets **403**; a request for another user's registration or another organizer's event data gets **404**, with no private fields in the body. Checks run in a fixed order: session (401) → role (403) → ownership (404) → business rules (409/422) | API integration tests for each role/ownership pair in the permission matrix | 1 |
| **NFR-03** | Security — credentials | Passwords are stored only as salted, slow hashes (scrypt, N = 2^15, r = 8, p = 1, 16-byte random salt, parameters stored with the hash); no plaintext password exists in the database, logs or API responses | Unit test on the hash; database inspection test on seeded users; API test that no response contains `password`/`passwordHash` | 1 |
| **NFR-04** | Security — session lifecycle | The session is an HttpOnly, SameSite=Lax cookie that expires **8 hours after sign-in** (absolute, not extended by activity); after sign-out the old cookie is rejected with 401 | API test: sign in → sign out → reuse cookie → 401; unit test on expiry | 1 |
| **NFR-05** | Data integrity — concurrency | With **20 simultaneous** registration requests from 20 different participants for an event with **1** seat left, exactly 1 succeeds and active registrations equal capacity; 5 simultaneous requests by one participant create at most 1 registration | API/database integration test against PostgreSQL | 1 |
| **NFR-06** | Reliability — persistence | Events and registrations are stored in PostgreSQL and remain after the application restarts; the schema is created only by versioned migrations; seed data is reproducible (running the seed twice creates no duplicates) | Integration test re-reading data through a fresh connection; seed-twice test; manual restart check (Sprint 1), container restart check (Lab 5) | 1 |
| **NFR-07** | Safe errors | Every error response uses one JSON shape `{ "error": { "code", "message", "details?" } }`; no stack trace, SQL text or internal id of another user appears in any response | API tests on validation, 401, 403, 404, 409 and 500 paths | 1 |
| **NFR-08** | Usability — responsive layout | Every Sprint screen works at 390 px, 768 px and 1440 px width with no horizontal page scrolling | Playwright checks at three widths + screenshots | 1 (Sprint 1 screens) · 3 (all) |
| **NFR-09** | Usability — feedback states | Every data screen shows loading, empty and error states; every form shows field-level validation messages and disables its submit button while saving | Component tests + E2E | 1 |
| **NFR-10** | Accessibility | All forms usable by keyboard only, every input has a visible label, text contrast ≥ 4.5:1; automated accessibility scan reports **0 serious/critical** issues on main screens | axe-core scan in Playwright + manual keyboard walk-through | 3 |
| **NFR-11** | Correct time handling | All times stored in UTC and shown in Asia/Bangkok (UTC+7). "Upcoming", deadline and check-in decisions use the **server** clock, never the browser clock | Unit tests with a fixed clock around each boundary (exactly at, 1 minute before, 1 minute after) | 1 |
| **NFR-12** | Performance | With **500 events and 5,000 registrations** seeded, the event-list and organizer-report endpoints respond in **< 500 ms at the 95th percentile** on a developer laptop | Scripted load measurement (e.g. autocannon) recorded in test evidence | 3 |
| **NFR-13** | Deployability and configuration | All configuration (database URL, session secret, port, client origin) comes from environment variables with a committed `.env.example`; no real secret is committed; `GET /api/health` returns 200 only when the database is reachable; the app builds into a Docker image and stores data on durable storage | Repository secret scan + review checklist (Sprint 1); Docker build and GCP deploy (Lab 5) | 1 / Lab 5 |
| **NFR-15** | Security — input and request hygiene | Every request body and query is validated on the server against a schema (wrong types, out-of-range values and unknown fields → 400 with field details); state-changing operations use only POST/PATCH/DELETE; user-written text (titles, descriptions) is always displayed as plain text, never run as HTML | API tests with malformed and extra fields; API test that a GET cannot change data; UI test that a description containing `<script>` is shown literally | 1 |
| **NFR-16** | Security — sign-in throttling | After **5 failed sign-ins for one email within 10 minutes**, further attempts for that email get **429** for 10 minutes, with the same generic message style as FR-02 | API test: 5 failures → 6th attempt 429 → succeeds after the window (fixed clock) | 3 |
| **NFR-17** | Security — image uploads (CH-11) | Only PNG, JPEG or WebP, checked from the file bytes; logo ≤ 2 MB and banner ≤ 5 MB, enforced before the whole body is read; at most 25 megapixels decoded; every image re-encoded on the server so metadata (EXIF, GPS) is removed; stored under a random name; served with `X-Content-Type-Options: nosniff`; SVG never accepted | API tests with oversized, renamed, non-image, SVG, too-small and pixel-bomb files; a test that EXIF is gone after upload; a header check on the deployed URL | 3 |
| **NFR-18** | Performance — pairing (CH-12) | Pairing one round for **256** entries after 8 rounds of history takes **< 1 s** on a developer laptop, and 1,000 generated tournaments contain no rematch and no second bye | Unit benchmark and property-style test with a fixed random seed | 3 |
| **NFR-14** | Maintainability — test coverage of rules | Every acceptance criterion of a sprint is linked to at least one automated test (or a justified manual check), and every BR has at least one negative test | Traceability review at each sprint release | 1, 2, 3 |

---

## 8. Constraints

- **C-01** Full stack with a real UI → API → persistent database workflow (spec §5.1). We reuse the TokTickIT
  labs' stack so the team can build quickly: React + TypeScript + Vite + Bootstrap client; Node.js + Express +
  TypeScript server; Prisma ORM with PostgreSQL; Vitest/Supertest and Playwright tests (details in the SDS).
- **C-02** Server-side authentication and authorization from Sprint 1 (spec §5.2).
- **C-03** Must be packaged with Docker and deployed on GCP from Lab 5; the Sprint 1 release runs locally (spec §5.3).
- **C-04** Synthetic demo data only; no external payment, messaging or third-party API (spec §5.3).
- **C-05** Git workflow: GitHub Issues and project board, branches from `sprint-N-staging`, teammate-reviewed Pull
  Requests, release Pull Request from staging to `main`, tagged releases (spec §8.3).
- **C-06** Supported browsers: current desktop and mobile versions of Chrome, Edge, Firefox and Safari.

---

## 9. Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-01 | One registration is one seat for one player; there are no team or guest registrations | Capacity logic would need a seat count per registration |
| A-02 | All events and users are in Thailand and share Asia/Bangkok time | Time display and boundaries would need per-event time zones |
| A-03 | An organizer runs events at one or more venues; the venue is stored as text on the event, not as a separate managed store record | A Store entity and store-level permissions would be needed |
| A-04 | Entry fees are collected in person at the store; the product only displays the fee | A payment flow would be a new, excluded feature |
| A-05 | The organizer is trusted to check players in honestly; players do not check themselves in | Self check-in would need a code or location proof |
| A-06 | Seeded accounts are enough for every sprint and demo: at least **2 organizers** and **3 participants**, so ownership and privacy rules can be tested between users of the same role | Account creation would become a new feature |
| A-07 | Seat counts shown to the public may be a few seconds stale; the authoritative check happens at registration time (BR-07) | Real-time push updates would be required |

---

## 10. Decisions and questions log

### 10.1 Design decisions

| ID | Decision | Reason | Date | Status |
|---|---|---|---|---|
| D-01 | Context: TCG store events (casual nights, tournaments, release events) | Clear, realistic capacity limits (tables) and attendance needs (no-shows); matches the reference UX | 4 Nov 2026 | Decided by team |
| D-02 | Borrow only interaction patterns from the reference event locator; use our own name ("TCG Event Hub"), wording and visuals | Avoid copying another product's brand or content | 4 Nov 2026 | Decided by team |
| D-03 | "Duplicate registration" = a second **active** registration by the same participant for the same event; rejected (BR-06). After cancelling, re-registering is allowed (FR-20) | Matches how stores treat a player who drops and comes back | 4 Nov 2026 | Decided by team |
| D-04 | Capacity may be lowered only to the current active count (BR-09); nobody is removed automatically | Removing players a store already accepted is unfair and needs a selection rule nobody asked for | 4 Nov 2026 | Decided by team |
| D-05 | Exactly one role per account: Participant or Organizer | Minimum two meaningful roles (spec §5.2); keeps the permission matrix small | 4 Nov 2026 | Decided by team |
| D-06 | Sprint 1 creates events directly as `PUBLISHED`; drafts arrive in Sprint 2 (FR-08) | Keeps the Sprint 1 slice small while meeting the brief's "publish" step | 4 Nov 2026 | Decided by team |
| D-07 | No waitlist (X-04); a full event simply rejects new registrations | Waitlist promotion adds a second capacity workflow; not in the brief | 4 Nov 2026 | Decided by team |
| D-08 | Cross-owner access answers **404** (not found) rather than 403, so the existence of other users' records is not revealed; wrong-role access answers **403** | Privacy (NFR-02) while still telling users what their role cannot do | 4 Nov 2026 | Decided by team |
| D-09 | The public (signed-out) event list and detail are allowed; registration and all personal data require sign-in | Event discovery is meant to be open, as in the reference locator; personal data stays protected | 4 Nov 2026 | Decided by team |
| D-10 | The registration deadline defaults to the start time and can only be earlier (BR-08). In Sprint 1, "event has started" is the cut-off | Answers the brief's "registration deadlines" question with the simplest safe default | 4 Nov 2026 | Decided by team |
| D-11 | Session cookie (server-side session store) rather than a token in browser storage | Logout can truly invalidate the session (NFR-04); the same pattern worked in TokTickIT | 4 Nov 2026 | Decided by team — detailed in SDS |
| D-12 | Unlike the reference, registered players are **not** listed publicly; the public and other participants see only "registered / capacity" | The brief requires that participants cannot inspect another participant's registration; screen names can identify real people | 4 Nov 2026 | Decided by team |
| D-13 | Keep the reference's **layout** (tabs, search bar, event cards with chips, two-column detail page) but give the product its **own visual theme**, defined in `docs/ui/design-direction.md` | Familiar flow for TCG players without copying another product's brand | 4 Nov 2026 | Decided by team |
| D-14 | Organizers see participants' display names only, not emails; contacting players is outside the product (X-03) | Data minimisation: a display name is enough to check a player in | 4 Nov 2026 | Decided by team |
| D-15 | Password hashing uses **scrypt** from Node's built-in crypto, reusing the team's TokTickIT implementation, instead of bcrypt | No native dependency to build in Docker; parameters already reviewed in TokTickIT Lab 3; memory-hard like bcrypt or better | 4 Nov 2026 | Decided by team (SDS SD-03) |
| D-16 | A draft cannot be cancelled; it stays a draft until it is published (records are never deleted, X-11) | A cancelled event is public (BR-04), so cancelling a draft would publish it | 21 Nov 2026 | Proposed (Sprint 2 contracts) |
| D-17 | Registration closes **at** the deadline: `now ≥ deadline` is closed | Same boundary as "started" (D-10), so there is one rule to test | 21 Nov 2026 | Proposed (Sprint 2 contracts) |
| D-18 | A draft is saved with `saveAsDraft: true` on create; the client can never send `status` | The server keeps full control of status (BR-17) | 21 Nov 2026 | Proposed (Sprint 2 contracts) |
| D-19 | After the start, only description, play structure note, contact and entry-fee label can be edited; title, type, format and venue are frozen too | Literal reading of BR-15 ("only … may be edited") | 21 Nov 2026 | Proposed (Sprint 2 contracts) |
| D-20 | The change history stores the **names** of edited detail fields, not their old and new text | Keeps the history short; long descriptions are not copied | 21 Nov 2026 | Proposed (Sprint 2 contracts) |
| D-21 | Publishing a draft checks BR-02 and BR-08 again | A draft can go stale while it waits | 21 Nov 2026 | Proposed (Sprint 2 contracts) |
| D-22 | The search date range uses Bangkok calendar days and includes both ends | Players think in local dates (NFR-11) | 21 Nov 2026 | Proposed (Sprint 2 contracts) |
| D-23 | A new start time earlier than the stored deadline is rejected, not adjusted | Nothing changes without the organizer seeing it | 21 Nov 2026 | Proposed (Sprint 2 contracts) |
| D-24 | CH-11 is split: the game (FR-29, FR-30 games) is built in Sprint 2; the logo and banner uploads (FR-30 logo, FR-31, NFR-17) in Sprint 3 | Uploads need a bucket, an image library and deploy changes that would risk the required Sprint 2 features | 21 Nov 2026 | Decided by team |
| D-25 | `game` is optional in the API and defaults to `OTHER`; the UI requires it. The server does not tie an event's game to the store's game list | Sprint 1 bodies and tests stay valid; the store list only orders the choices in the form | 21 Nov 2026 | Proposed (Sprint 2 contracts) |
| D-26 | Check-in, undo and the attendance numbers use the server clock; the check-in window is `[start − 60 min, end)`; a no-show is counted only after `end` | Same boundary style as D-10 and D-17 | 21 Nov 2026 | Proposed (Sprint 3 contracts) |
| D-27 | Throttling counts failed sign-ins per lower-cased email, including unknown emails, and a successful sign-in does not reset the count | An attacker cannot learn which emails exist, nor reset the counter with a second account | 21 Nov 2026 | Proposed (Sprint 3 contracts) |
| D-28 | Reports and history count a re-registered participant once per event, by their latest registration | A player who cancelled and came back attended once | 21 Nov 2026 | Proposed (Sprint 3 contracts) |
| D-29 | Sign-in attempts made while an email is locked get 429 and are not recorded, so the lock is exactly 10 minutes | Hammering must not extend the lock indefinitely | 21 Nov 2026 | Proposed (Sprint 3 contracts) |
| D-30 | The organizer summary requires `from` and `to`, at most 366 days apart; the page defaults to the last 30 days | A bounded range keeps NFR-12 measurable | 21 Nov 2026 | Proposed (Sprint 3 contracts) |
| D-31 | Tournament entries are fixed when round 1 is paired; later check-ins are not added | Adding players mid-event breaks Swiss maths and is rare at our stores | 21 Nov 2026 | Proposed (CH-12) |
| D-32 | A participant may see the **display name of their own current opponent** and their table. This is the only exception to BR-16; standings and other players' results stay owner-only, and the public sees no names (the team chose owner and player only, 21 Nov 2026) | Players must know whom to play; posting full pairings publicly would expose every name | 21 Nov 2026 | Decided by team (privacy); exception proposed (CH-12) |
| D-33 | Only the owning organizer records and corrects results; players do not self-report (X-05) | Matches the trust model of check-in (A-05) and avoids disputes in the product | 21 Nov 2026 | Proposed (CH-12) |
| D-34 | Standard Swiss scoring and tiebreakers (3/1/0 points, OMW%, GW%, OGW% with a 1/3 floor), the same for every game | One rule set is testable; stores already know it | 21 Nov 2026 | Proposed (CH-12) |
| D-35 | Round 1 is random from a seed stored with the round, so a test or a dispute can reproduce it | Fair and reproducible | 21 Nov 2026 | Proposed (CH-12) |
| D-36 | CH-12 is built in **Sprint 3** (Feature-W pairings, Feature-X results and standings) after Feature-P check-in | It needs check-in; Sprint 2 is full | 21 Nov 2026 | Decided by team |
| D-37 | The store profile holds the store's public contact details (phone, email, website, LINE ID), shown on every event; the event's own `contact` field stays as an optional "Contact for this event". The store email is a separate public field, never the sign-in email (D-14 unchanged); website links must be `http(s)://` | Organizers stop retyping contacts; players can always reach the store; no unsafe links (NFR-15) | 21 Nov 2026 | Requested by team (Sprint 2, Feature-U) |
| D-38 | From Sprint 2 the product's visual theme is **Deep Lagoon** (`071B2B · 167D8D · B9E4E8 · EEEEEE`) with **Inter** for text, **Manrope** for figures and IBM Plex Sans Thai for Thai letters, replacing Arcane Ink and Chakra Petch. It refines D-13 (own visual theme) and is defined in design-direction v0.6 | Chosen by the team from five palette trials and eight font trials on the prototype canvas; every text pair passes WCAG AA | 21 Nov 2026 | Decided by team |

### 10.2 Open questions

| ID | Question | Proposed answer | Ask | Status |
|---|---|---|---|---|
| Q-01 | Is a public (signed-out) event list acceptable, given the spec tests "anonymous" access? | Yes: listing is public; registering and every personal view require sign-in and are tested for 401 (D-09) | TA | Open |
| Q-02 | Is "TCG store events" an acceptable specialisation of Theme 3? | Yes, it keeps every element of the brief | TA | Open |
| Q-03 | Should an organizer be able to see events of other organizers in the public list? | Yes, as any visitor does; they cannot manage them (BR-14) | Team | Resolved — yes |
| Q-04 | Maximum capacity? | 256 (largest local store event we expect) (BR-01) | Team | Resolved |
| Q-05 | Can participants see who else is registered? | No, only the seat count (BR-16) | Team | Resolved |
| Q-06 | Should check-in be allowed after the event ends (late paperwork)? | No; the window closes at the end time (BR-18). Revisit in Sprint 3 if stores need it | Team | Resolved for now |
| Q-07 | Which reference-UX details (card fields, filter set) can be confirmed directly in a browser? | Opened on 4 Nov 2026; observations recorded in §1.2. The list's event cards did not load in the automated browser, so their layout was confirmed from team screenshots of the signed-in list and detail pages | Team | Resolved |
| Q-08 | Should a participant be blocked from registering for two events that overlap in time? | No: players may plan to leave early; overlap is not checked | Team | Resolved — not checked |
| Q-09 | Should an organizer be blocked from creating overlapping events at the same venue? | No: a store may run two events in different rooms | Team | Resolved — not checked |

---

## 11. Change log

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 4 Nov 2026 | First full draft of the whole-product SRS | Team (drafted with AI assistance, see the [AI-use declaration](ai-use.md)) |
| v0.2 | 4 Nov 2026 | Reference UX verified in a browser (§1.2, Q-07 resolved); event gains venue address, play structure note and contact (FR-06, BR-03); list shows registered/capacity (FR-11); added X-13 and D-12 | Team (AI-assisted) |
| v0.3 | 4 Nov 2026 | Event-card and header patterns from the reference (§1.2); access summary (§2.1); FR-26 sign-in-then-return, FR-27 header account menu; D-13 own visual theme | Team (AI-assisted) |
| v0.4 | 4 Nov 2026 | Review pass: BR-04 rewritten (cancelled events visible, drafts owner-only) to remove a conflict with FR-14 and FR-17; added FR-28 record keeping, NFR-15 input hygiene, NFR-16 sign-in throttling, "Upcoming" definition, problem → requirement links, C-06, D-14, Q-08, Q-09; clarified FR-12, FR-13, FR-17, BR-08, BR-09, BR-12, BR-15, BR-16, NFR-02, NFR-04, NFR-13, A-06; fixed X-08 reference | Team (AI-assisted) |
| v0.5 | 4 Nov 2026 | NFR-03 hashing changed from bcrypt to scrypt (D-15), decided while writing the System-Level SDS | Team (AI-assisted) |
| v0.6 | 21 Nov 2026 | Scope change **CH-11** (store identity and game): P-06, P-07, S-10, S-11, FR-29 … FR-31 (§5.7), NFR-17, vocabulary for game, store profile and banner, access rows; X-01 and X-08 revised and X-14 added so the store profile does not contradict the exclusions. Decisions D-16 … D-30 from the Sprint 2 and Sprint 3 contracts. No existing requirement changes meaning | Team (AI-assisted) |
| v0.7 | 21 Nov 2026 | D-38 Deep Lagoon theme with Inter and Manrope (refines D-13; no requirement changes). CH-11 extended: FR-30 now includes the store's public contact details (Sprint 2), vocabulary and access rows, D-37. Scope change **CH-12** (Swiss tournaments): P-08, S-12, X-05 narrowed, vocabulary, access rows, FR-32 … FR-37 (§5.8), BR-21 … BR-24 (§6.5), NFR-18, BR-16 exception for the player's own opponent (D-32), D-31 … D-36 | Team (AI-assisted) |
