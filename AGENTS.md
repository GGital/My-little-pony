# Rules for every contributor and coding agent

TCG Event Hub (CPE 334, Theme 3). Two students, and usually several pull requests open against the same
`sprint-N-staging` branch at once. Every coding agent (Claude Code, Codex, Copilot, Cursor, …) and every person
follows these rules. `CLAUDE.md` points here.

**Why these rules exist:** between 25 and 26 Nov 2026, parallel PRs kept conflicting on the same lines:
- Each PR bumped the same `Document version` headers and added the same next version number.
- New rows went at the end of the same tables, in `contributions.md`, `ai-use.md`, the STS and the contracts.
- Decision **D-39** was used twice.
- Every E2E run rewrote other Issues' evidence files.

Most of these rules make each PR touch only lines that belong to its own Issue.

## 1. Working on an Issue

1. One Issue, one branch: `feature/sN-NN-slug`, created from `origin/sprint-N-staging` with `--no-track`.
2. Contract first, then tests, then code. The test commit runs **red** and the implementation commit runs **green**.
   No assertion is weakened to pass. A test that must change goes in its own commit, with the reason.
3. Open the PR into `sprint-N-staging`. A teammate reviews it on the real database.
4. Agents never push, merge, comment or post without the user's explicit OK for that action.
5. Working notes and PR drafts stay outside the repository. `git status` shows only the Issue's own changes.

## 2. Shared record tables: touch only your own rows

| File / table | What your PR does | What it never does |
|---|---|---|
| `docs/contributions.md` §5 · `docs/ai-use.md` §2 | Adds **one row for its Issue** at the end of the table. Its status reads `In review (PR #N)` | Edit another Issue's row, a summary or a heading |
| Every version-history table: `srs.md`, `system-sds.md`, `features.md`, `traceability.md`, sprint `feature-contracts.md`, `sts.md` and `README.md`, `ai-use.md`, `contributions.md` | Adds rows **labelled with the Issue ID**, not a number: `\| S2-06 \| 26 Nov 2026 \| what changed and why \| Team (AI-assisted) \|`. A PR with no Issue (a chore) uses its PR number instead: `\| #110 \| … \|` | Pick the next `vX.Y`, or edit the `Document version:` line at the top |
| `docs/sprints/sprint-N/sts.md` §5 (TDD record) | Fills **its own Issue's row**, which already exists | Touch another row |

The integration Issue of each sprint (S2-08, S3-09) makes one **records commit** on staging. That commit:
- gives each document its next `vX.Y`, covering the Issue-labelled rows above it, and updates the `Document version`
  line;
- changes `In review` to `Merged (sha)` in `contributions.md`, using the PR record.

`.gitattributes` sets `merge=union` on `docs/contributions.md` and `docs/ai-use.md`. When you merge staging into your
branch locally, git then keeps both sides' new rows. Look for duplicated rows afterwards. GitHub's web conflict
editor ignores this setting, so merge locally. Union keeps **both** versions of a line that two branches edited
(for example a status), which is why a PR never edits an existing line in these two files: it only adds its own.

## 3. IDs: claim before you use

This applies to new **D-**, **CH-**, **UX-**, **E-**, **TEST-** and seed **EV-** numbers:
1. Run `git fetch`.
2. Search `origin/sprint-N-staging` **and** every open PR (`gh pr diff <n>`) for the number.
3. Take the next free one.
4. Claim it in a comment on your Issue ("Using D-41 for …").

If two PRs still pick the same number, the PR that merges second renumbers.

## 4. Code that many Issues touch

- **Migrations:** each new Prisma migration folder gets a timestamp prefix, `YYYYMMDDHHMMSS_<issue>_<slug>` (for
  example `20261126090000_s2-06_deadline`), never the next `000N`. Folders that already exist keep their names.
- **CSS:** new styles go in a CSS file next to the component that uses them, imported by that component.
  `client/src/theme/theme.css` holds tokens and shared base styles only.
- **Client types:** a type that only one page uses lives in that page's module. `client/src/api/types.ts` gets only
  types that two or more features share.
- **Server:** a new endpoint goes in the feature's own router (`server/src/http/<feature>.routes.ts`), mounted with one
  line in `app.ts`. New rules go in a feature module (`server/src/domain/<feature>.ts`) with its own unit-test file.
  Shared modules (`event-lifecycle.ts`, `events.read.ts`, …) change only where the behaviour itself must change.
- **Permission matrix:** a new endpoint's TEST-B-03 cells go in the feature's own API test file, inside
  `describe('TEST-B-03 rows (E-xx) …')`. Its TEST-SR2-03 route is one line in `server/tests/helpers/routes.ts`, in
  E-number order.
- **Unavoidable conflict:** keep it to one line, and resolve it by keeping both sides.

## 5. Evidence files

- Files are prefixed with their Issue ID (`S2-06-…`). Only that Issue's PR adds or changes them.
- A spec writes evidence only when its variable is set. A plain `npx playwright test` writes nothing, so a test run
  never rewrites another Issue's screenshots. To regenerate evidence, set the variable for that spec:

  | Spec | Writes to | Set |
  |---|---|---|
  | `e2e/sprint-1/responsive.spec.ts` | `docs/sprints/sprint-1/evidence/responsive/` | `EVIDENCE=1` |
  | `e2e/sprint-1/lab7-ch13.spec.ts` | `docs/labs/lab07/evidence/` | `L7_SIDE=before` or `after` |
  | `e2e/sprint-2/s2-NN-evidence.spec.ts` | `docs/sprints/sprint-2/evidence/S2-NN-*` | `S2_SIDE=before` or `after` |

  Run only the spec you mean, for example `S2_SIDE=after npx playwright test e2e/sprint-2/s2-06-evidence.spec.ts`.
  A new evidence spec follows the same pattern and adds its row here.
- Logs replace absolute local paths with `<repo>`. No secret, password or token ever appears in evidence.

## 6. Before you open or update a PR

1. `git fetch`, then `git merge origin/sprint-N-staging` into your branch, locally. Do not rebase a branch that is
   already pushed.
2. Resolve conflicts by the rules above. Never drop another Issue's rows.
3. Rerun the server, client and E2E suites and the client build. Run `npm run sts:check` and
   `npm run secret:scan`.
4. In the PR body, list the AI use, the contribution, and the red and green commits with their run counts.
