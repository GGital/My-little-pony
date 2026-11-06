# AI-use declaration

Project: **TCG Event Hub** · CPE 334 group project (Theme 3) · Kept current by every Issue PR (see the last section)

The course allows specification and coding agents if the team supplies the contract, works on bounded Issues,
inspects the output, runs the tests and reviews the change (group spec §8.4). This page lists the tools and the
tasks they assisted. Both students are responsible for, and must be able to explain, everything listed here.

## 1. Tools

| Tool | Used by | How |
|---|---|---|
| Claude Code (Anthropic), cloud session, Claude Opus | Phattaratorn (GGital) | Drafted the baseline documents and I-01 / I-02 on a cloud machine with PostgreSQL 16; its commits have the author **Claude** |
| Claude Code (Anthropic), desktop app on the team's own machine, Claude Opus | Phattaratorn (GGital) | PR reviews tested against the local PostgreSQL 17 database; I-04 implementation; its commits carry `Co-Authored-By: Claude` |
| Google Antigravity (Google DeepMind), desktop app, Gemini 2.5 Pro | Praewa (MeldyRose) | Client shell (I-03), Event discovery list and detail (I-05), review fixes and merge resolution |

## 2. Tasks assisted

| Item | Issue / PR | What the AI did | What the students did |
|---|---|---|---|
| SRS, feature inventory, traceability, UI design direction and mock-up, diagrams | PR [#1](https://github.com/GGital/My-little-pony/pull/1) | Drafted the documents from the stakeholder brief and the course spec | Phattaratorn chose the context and directed the drafts; Praewa reviewed and approved PR #1 |
| System-Level SDS, three-sprint plan, Sprint 1 contracts, STS, DoD | PR [#2](https://github.com/GGital/My-little-pony/pull/2) | Drafted the documents | Phattaratorn directed; Praewa reviewed and approved PR #2 |
| I-01 data foundation | #3 · PR [#15](https://github.com/GGital/My-little-pony/pull/15) | Wrote the red tests, then the schema, constraints and seed; recorded the runs | Phattaratorn supervised and opened the PR; Praewa reviewed and approved; the suite was re-run on the local PostgreSQL 17 database during the PR #16 review |
| I-02 API foundation | #4 · PR [#17](https://github.com/GGital/My-little-pony/pull/17) | Wrote the red tests, then errors, validation, origin check, clock, config, health | Phattaratorn supervised and opened the PR; Praewa reviewed and approved |
| I-03 client shell | #5 · PR [#16](https://github.com/GGital/My-little-pony/pull/16) | Generated UI shell, tokens, route guards, time formatting, and test stubs; addressed review fixes | Praewa implemented and answered three review rounds |
| PR #16 review, rounds 2 and 3 | PR #16 | Checked out the branch, ran both suites, the server on the real database, the live app and guard mutations; drafted the review text | Phattaratorn read the findings and posted the reviews. *Round 1 drafting: to be confirmed by Phattaratorn* |
| I-04 sign in, who am I, sign out | #6 · PR [#18](https://github.com/GGital/My-little-pony/pull/18) | Wrote the red tests, the implementation, the sign-out fix (red → green), the docs and the PR draft; ran everything on the real database and in the browser | Phattaratorn set the scope and decisions, committed and opened the PR; review by Praewa pending |
| I-05 event list and detail | #7 · PR [#19](https://github.com/GGital/My-little-pony/pull/19) | Wrote red tests (TEST-F-01 … 05, TEST-C-06), domain and HTTP routes for E-04 / E-05, EventList and EventDetail client pages, ActionButton component, review fixes (M1–M5, S1–S5) and merge resolution | Praewa supervised, directed TDD steps, resolved merge conflicts, and committed |

## 3. How we supervise the agent

- The agent gets one Issue, its contract section and its test IDs, and works on that Issue only.
- Tests are committed and run red before the implementation. Run outputs are saved under
  `docs/sprints/sprint-1/evidence/`. An agent saying "all tests pass" is never evidence.
- A student runs the suites again locally against the real database, reads the diff, and the teammate reviews the
  PR with a specific check, question or finding. Authors do not approve their own PRs.
- No real secrets, passwords or tokens are given to the agent or written to Git; demo accounts use a local
  `SEED_PASSWORD`.
- Full prompt transcripts are not kept (spec §8.4); commit authorship and trailers show which commits the agent wrote.

## 4. Keeping this page current

Every Issue PR adds or updates its own row in §2 (and §1 if a new tool is used), in the same PR as the work, the
same way it fills its row in `sts.md` §5 and in [`contributions.md`](contributions.md).

| Version | Date | Change | Author |
|---|---|---|---|
| v0.1 | 6 Nov 2026 | First declaration: tools, tasks for PR #1, #2 and I-01 … I-04, supervision rules | Team (AI-assisted) |
| v0.2 | 6 Nov 2026 | Added Praewa tools, completed I-03 entry, and added I-05 row | Praewa (MeldyRose) |
