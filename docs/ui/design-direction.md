# UI Design Direction — "Arcane Ink" theme

Project: TCG Event Hub · Version v0.1 (4 Nov 2026) · Branch `sprint-1/spec`
Related: `docs/srs.md` §1.2 (reference UX), §2.1 (access summary), D-12, D-13. A visual mock-up is in
[`mockup.html`](mockup.html) (open it in a browser), with rendered images in [`mockup/`](mockup/).

This document fixes the **look** and the **screen patterns** that every feature contract reuses. The System-Level
SDS links to it for UI standards; each Sprint feature's UI specification adds the detailed fields and states.

---

## 1. What we keep from the reference and what we change

The reference event locator has a layout TCG players already know. We keep that **layout** and replace the
**visual identity** completely (decision D-13).

| Kept (layout and behaviour) | Changed (our own identity) |
|---|---|
| Page title, then two tabs: *Find an Event* / *My Events* | Name and logo: **TCG Event Hub**, not the reference brand |
| One rounded search bar: Where · Event type · Format · search button | Colours: deep ink-violet page, violet actions, teal "seats" signals instead of navy and orange |
| Event card: date badge, weekday · time, title, type · format, venue line, fee chip, players chip | Typeface: **Sora** for headings, **Inter** for text, instead of the reference fonts |
| Detail page: header row (date, time, players) with one wide action button; two columns below | The right-hand panel is **Seats**, not a public list of player names (D-12, BR-16) |
| Account name in the top-right header with a drop-down | Our header carries the **role badge** and *Sign out* (FR-27) |

---

## 2. Theme tokens

Every colour, size and radius used by the client comes from these tokens (CSS variables on `:root`, mapped onto
Bootstrap variables). Contrast pairs were chosen to meet 4.5:1 for text (NFR-10).

| Token | Value | Used for |
|---|---|---|
| `--ink-900` | `#16112B` | Header bar, page backdrop (with a soft gradient to `#2A1F55`) |
| `--surface` | `#FFFFFF` | Cards and panels |
| `--surface-muted` | `#F5F3FB` | Page body inside the main panel, input backgrounds |
| `--text` | `#1F1A33` | Body text on light surfaces |
| `--text-muted` | `#5F5878` | Secondary lines (venue, format) |
| `--primary` | `#6C4CE0` | Primary buttons, active tab underline, date badge |
| `--primary-hover` | `#5838C9` | Hover/pressed primary |
| `--accent` | `#0E8F80` | "Seats left" chip, success messages, *Registered* state |
| `--warning` | `#B45309` | "Few seats left" (≤ 20 % of capacity) |
| `--danger` | `#C8303F` | Errors, *Full*, destructive actions |
| `--border` | `#E3DFF0` | Card and input borders |
| `--focus` | `0 0 0 3px rgba(108,76,224,.45)` | Visible keyboard focus ring on every control |
| Radius | `16px` panels · `12px` cards · `999px` chips and pill buttons | |
| Type scale | Sora 700 — 32 / 24 / 18 px headings · Inter 400/600 — 16 / 14 / 12 px | Upper-case labels use Inter 600, 12 px, letter-spacing .08em |

---

## 3. Shared layout

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◆ TCG EVENT HUB    Events   (Organizer: Dashboard)          [ Mint · PLAYER ▾ ]│  ← header (--ink-900)
├───────────────────────────────────────────────────────────────────────────────┤
│   ┌───────────────────────────────────────────────────────────────────────┐   │
│   │  PAGE TITLE                                                           │   │  ← main panel (--surface,
│   │  FIND AN EVENT   MY EVENTS                                            │   │     radius 16)
│   │  ───────────────                                                      │   │
│   │  … page content …                                                     │   │
│   └───────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
```

- Width: content max 1200 px, centred; side gutter 16 px on phones. No horizontal scroll at 390 / 768 / 1440 px
  (NFR-08).
- Under 768 px the search bar stacks its three fields vertically and the card chips move under the title.

---

## 4. Authentication and authorization in the UI

The UI **reflects** permissions; the server **enforces** them (BR-17). Every rule below has a matching backend
check, so a user who bypasses the screen still gets 401/403/404 (NFR-01, NFR-02).

### 4.1 Header states (FR-05, FR-27)

| Who | Header right side | Navigation shown |
|---|---|---|
| Visitor | **Sign in** button | Events |
| Participant | `Display name` + `PLAYER` badge ▾ → *My Events*, *Sign out* | Events · My Events |
| Organizer | `Display name` + `ORGANIZER` badge ▾ → *Dashboard*, *Sign out* | Events · Dashboard · **+ Create event** |

### 4.2 Sign-in screen (FR-01, FR-02, FR-26)

```
┌─────────────────────────────────────┐
│  SIGN IN                            │
│  Email     [______________________] │
│  Password  [______________________] │
│  [ ⚠ Email or password is incorrect ]   ← one generic message (FR-02)
│  [          SIGN IN          ]      │   ← disabled + spinner while sending (NFR-09)
│  Demo accounts are listed in README │
└─────────────────────────────────────┘
```

- After success: return to the page the user came from (`?returnTo=` — FR-26), otherwise to *Find an Event*
  (participant) or *Dashboard* (organizer). `returnTo` accepts only paths inside the app, never a full URL.
- **Sign out**: the server ends the session; the client clears the cached user and goes to *Find an Event* with a
  "You are signed out" notice. Pressing Back does not show private data again (it is refetched and gets 401).
- **Session expired** (any request returns 401): show "Your session has ended — please sign in again" and go to
  sign-in with `returnTo` set.

### 4.3 Route protection

| Route | Visitor | Participant | Organizer |
|---|---|---|---|
| `/events`, `/events/:id` | ✓ | ✓ | ✓ |
| `/login` | ✓ | → `/events` | → `/organizer` |
| `/me/registrations` (*My Events*) | → `/login?returnTo=…` | ✓ | **Not available** page (403) |
| `/organizer`, `/organizer/events/new` | → `/login?returnTo=…` | **Not available** page (403) | ✓ |
| `/organizer/events/:id/registrations` | → `/login?returnTo=…` | **Not available** (403) | ✓ own event · **Not found** (404) for another organizer's event |

The *Not available* and *Not found* pages are full panels with a short explanation and a button back to
*Find an Event*. They never show any of the hidden record's data.

### 4.4 The main action button on an event (FR-12, FR-16, FR-26)

The wide button in the detail header (and the small one on a card) is driven by state the **server** returns
with the event, so the screen never guesses.

| Situation | Button | Extra text |
|---|---|---|
| Visitor, seats left | **SIGN IN TO REGISTER** (primary) | — |
| Participant, seats left, not registered | **REGISTER** (primary) | — |
| Participant, already registered | **✓ REGISTERED** (teal outline, not clickable) | "See it in My Events" link |
| Anyone, no seats left | **FULL** (disabled) | "All 16 seats are taken" |
| Event started / closed | **REGISTRATION CLOSED** (disabled) | — |
| Organizer, not the owner | *(no button)* | "Organizer accounts can't register for events" |
| Organizer, owner | **MANAGE EVENT** (outline) | Opens the registrations list |

If the server rejects a click (for example another player took the last seat a moment earlier — BR-07), the page
shows the server's message ("This event just became full") in a red alert and refreshes the seat count.

---

## 5. Sprint 1 screens

| Screen | Route | Feature (SRS) | Key states |
|---|---|---|---|
| Sign in | `/login` | FR-01, FR-02, FR-26 | invalid credentials, sending, success redirect |
| Find an Event | `/events` | FR-11 (search and filters arrive in Sprint 2, FR-13; the bar is shown disabled with "Coming soon" tooltips until then) | loading skeleton cards, empty "No upcoming events yet", error with *Try again* |
| Event detail | `/events/:id` | FR-12, FR-15, FR-16 | button states in §4.4, rejection alert, not found |
| My Events | `/me/registrations` | FR-17 | empty "You haven't registered for any events yet — Find an Event", list, error |
| Organizer dashboard | `/organizer` | FR-07 | empty "Create your first event", list with seats used |
| Create event | `/organizer/events/new` | FR-06, BR-01–BR-03 | field errors from the server shown under each field, sending, success → event detail |
| Event registrations | `/organizer/events/:id/registrations` | FR-18, BR-14 | count "12 / 32", empty "No registrations yet", not found |

### 5.1 Event card (list)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ┌─────┐  THURSDAY · 5:00 PM                              ( THB 250 ) ( 👥 3/24 )│
│ │ NOV │  Friday Night Constructed                                             │
│ │  5  │  Casual · Constructed                                                 │
│ └─────┘  Quantum Cards · Bang Khae, Bangkok                         21 seats left│
└──────────────────────────────────────────────────────────────────────────────┘
```

- Date badge uses `--primary`; the seats chip is teal, amber when ≤ 20 % left, red **FULL** at 0.
- The whole card is one link to the detail page (keyboard reachable, visible focus ring).

### 5.2 Event detail

```
┌ STORE NAME (label) ───────────────────────────────────────────────────────────┐
│ Event title                                                                    │
│ DATE Nov 5, 2026    TIME 5:00 PM    PLAYERS 3 / 24        [     REGISTER     ] │
├───────────────────────────────────────┬────────────────────────────────────────┤
│ EVENT DETAILS                         │ SEATS                       3 / 24     │
│ (CASUAL) chip                         │ ███░░░░░░░░░░░░░░░░░  21 seats left    │
│ 📅 Nov 5, 2026 · 5:00–9:00 PM         │ Player names are private.              │
│ 📍 venue address                       │ (Owner organizer: "View registrations")│
│ 🏆 Constructed · 4 rounds · Bo1        │                                        │
│ 💳 THB 250 — pay at the store          │                                        │
│ description text…                     │                                        │
├───────────────────────────────────────┤                                        │
│ CONTACT  🌐 link   ✉ email             │                                        │
└───────────────────────────────────────┴────────────────────────────────────────┘
```

---

## 6. Change log

| Version | Date | Change |
|---|---|---|
| v0.1 | 4 Nov 2026 | First version: theme tokens, layout, auth/authorization UI rules, Sprint 1 screens |
