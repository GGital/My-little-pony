# UI Design Direction — "Arcane Ink" theme

Project: TCG Event Hub · Version v0.2 (4 Nov 2026) · Branch `sprint-1/sds` (local draft)
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
| Event card: date badge, weekday · time, title, type · format, venue line, fee chip, players chip | Typeface: **Chakra Petch** for headings and **IBM Plex Sans Thai** for text. Both include Thai letters, so organizers' Thai titles and venues render in the same type |
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
| `--accent` | `#0E8F80` | Seat bar fill, borders and icons on teal surfaces. **Not for small text or as a background behind white text** (4.0:1) |
| `--accent-ink` | `#0B6B60` | Teal text, the *Registered* button, and role-badge backgrounds behind white text (≈ 6:1) |
| `--accent-tint` | `#E6F6F3` | Seats chip and the top of the "You're in" card |
| `--warning` | `#B45309` | "Few seats left" (≤ 20 % of capacity) |
| `--danger` | `#C8303F` | Errors, *Full*, destructive actions |
| `--border` | `#E3DFF0` | Card and input borders |
| `--focus` | `0 0 0 3px rgba(108,76,224,.45)` | Visible keyboard focus ring on every control |
| Radius | `16px` panels · `12px` cards · `999px` chips and pill buttons | |
| Type scale | Chakra Petch 700 — 32 / 24 / 18 px headings · IBM Plex Sans Thai 400/600 — 16 / 14 / 12 px, line height 1.55 | Upper-case labels use IBM Plex Sans Thai 600, 12 px, letter-spacing .08em. Counts use tabular (fixed-width) digits so "3 / 24" does not jump when it changes |
| Motion | `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`; 100–150 ms feedback, 150–300 ms state changes, 620 ms for the one authored moment (§7) | Every animation has a `prefers-reduced-motion` alternative |

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
| Participant, request in flight | **HOLDING YOUR SEAT…** (spinner, `aria-busy`, ignores further clicks) | — |
| Participant, already registered | **✓ REGISTERED** (`--accent-ink` outline, not clickable) | "See it in My Events" link |
| Anyone, no seats left | **FULL** (disabled) | "All 16 seats are taken" |
| Event started / closed | **REGISTRATION CLOSED** (disabled) | — |
| Organizer, not the owner | *(no button)* | "Organizer accounts can't register for events" |
| Organizer, owner | **MANAGE EVENT** (outline) | Opens the registrations list |

If the server rejects a click (for example another player took the last seat a moment earlier — BR-07), the page
shows the server's message ("This event filled up a moment ago, so no registration was made.") in a red alert and
refreshes the seat count.

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
│ ┌─────┐  THURSDAY · 5:00 PM                              ( THB 250 ) ( ⚇ 3/24  )│
│ │ NOV │  Friday Night Constructed                                             │
│ │  5  │  Casual · Constructed                                                 │
│ └─────┘  Quantum Cards · Bang Khae, Bangkok                         21 seats left│
└──────────────────────────────────────────────────────────────────────────────┘
```

- Date badge uses `--primary`; the seats chip is teal, amber when ≤ 20 % left, red **FULL** at 0. The players icon
  (⚇ in the sketch) is the drawn "users" icon from the icon set (§8).
- The whole card is one link to the detail page (keyboard reachable, visible focus ring).

### 5.2 Event detail

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Event title                                                                    │
│ at Store name · District, City                                                 │
│ DATE Nov 5, 2026    TIME 5:00 PM    PLAYERS 3 / 24        [     REGISTER     ] │
├───────────────────────────────────────┬────────────────────────────────────────┤
│ EVENT DETAILS                         │ SEATS                       3 / 24     │
│ (CASUAL) chip                         │ ███░░░░░░░░░░░░░░░░░  21 seats left    │
│ [cal]  Nov 5, 2026 · 5:00–9:00 PM     │ Player names are private.              │
│ [pin]  venue address                  │ (Owner organizer: "View registrations")│
│ [cup]  Constructed · 4 rounds · Bo1   │ After a successful registration this   │
│ [fee]  THB 250, paid at the store     │ card flips to "You're in." (§7)        │
│ description text…                     │                                        │
├───────────────────────────────────────┤                                        │
│ CONTACT  [mail] email                 │                                        │
└───────────────────────────────────────┴────────────────────────────────────────┘
```

- On phones (< 768 px) the Seats card moves directly under the Register button, so the result of the tap is
  visible without scrolling.

---

## 6. Voice

TCG Event Hub talks like a **friendly store host**: clear first, warm second, with a little card-table flavour only
where it helps. Plain wording everywhere else.

| Do | Don't |
|---|---|
| "You're in." · "See you at the table." · "Holding your seat…" | Jokes on errors, or exclamation marks on routine actions |
| Errors name the problem, then what happened: "This event filled up a moment ago, so no registration was made." | Blame ("You were too slow") or codes alone ("409") |
| Facts the product actually knows: "4 / 24 taken · 20 left" | Claims it does not know, such as a seat or table number (we do not assign seats) |

## 7. The one authored moment: "seat secured"

The only celebration in the product. Getting a seat is the main thing a player comes to do (FR-15), so it is
the one moment that earns a response. Everything else stays fast and quiet.

| Step | What the player sees | How |
|---|---|---|
| 1. Tap **Register** | Button reads **HOLDING YOUR SEAT…** with a spinner; extra taps are ignored | `aria-busy="true"`; no fake delay in the real app (the mock-up waits 0.7 s only to show the state) |
| 2. Server answers 201 | The Seats card **flips over like a dealt card** to show **"You're in."**: event, time, venue, "4 / 24 taken · 20 left", seat bar, check-in note, link to My Events | 3D `rotateY` 620 ms with `--ease-out`; the bar fills with `transform: scaleX` (no layout change) |
| 3. Same moment | Header count changes 3 / 24 → 4 / 24; button becomes **✓ REGISTERED** | Tabular digits, so nothing shifts |
| 4. Assistive tech | Screen readers hear "You're registered for Friday Night Constructed. 20 seats left."; focus moves to "You're in." | `aria-live="polite"` region; the hidden card face is `aria-hidden` |
| Reduced motion | No flip: the two faces cross-fade in 200 ms, and the bar jumps to its new value | `@media (prefers-reduced-motion: reduce)` |
| Server says no (409) | No flip. Red alert with the reason; seat count refreshes | Same alert pattern as every other error |

Rendered states: `mockup/detail-1440.png` (before) and `mockup/detail-registered-1440.png`,
`mockup/detail-registered-390.png` (after).

## 8. Icons and browser details

- **Icons are drawn SVG from one set**: 24 px grid, 1.75 px stroke, round caps (calendar, pin, trophy, fee, mail,
  users, lock, search, check, chevron, alert, arrow, spinner). **Emoji and Unicode symbols are never used as
  icons.** In Sprint 1 the set is defined once in the client and used with `<use href="#i-…">`. A library with the
  same style (for example Lucide) is an acceptable replacement.
- **No small label above a heading.** A store name goes *below* the event title ("at Quantum Cards · Bang Khae"),
  not as a caption above it.
- **Icons sit beside headings, not in tiles above them** (for example the lock on the "Not available" page).
- Browser surfaces follow the theme: text selection `rgba(108,76,224,.24)`, caret and checkbox/radio colour
  `--primary`, link underline offset 3 px, scrollbar `#4A3A8C` on `--ink-900`.

## 9. Design checks

The mock-up was polished with the Impeccable skill's `delight` command (4 Nov 2026), then scanned with its
automatic detector. The first scan reported three issues: teal badge contrast 4.0:1, an icon tile above a heading,
and an overused font. All three were fixed, and the final scan reports **0 findings**. Rendered and checked at 1440 px,
390 px and with reduced motion, with no console errors and no horizontal scroll.

---

## 10. Change log

| Version | Date | Change |
|---|---|---|
| v0.1 | 4 Nov 2026 | First version: theme tokens, layout, auth/authorization UI rules, Sprint 1 screens |
| v0.2 | 4 Nov 2026 | Impeccable `delight` pass: "seat secured" moment (§7), voice (§6), icon and browser rules (§8), fonts changed to Chakra Petch + IBM Plex Sans Thai, `--accent-ink` for teal text and badges, store name moved below the title, phone order of the Seats card, design checks (§9) |
