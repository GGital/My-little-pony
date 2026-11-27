# TCG Event Hub — instructions for Claude Code

@AGENTS.md

The rules in `AGENTS.md` apply in full: they are the team's rules for every coding agent and contributor. In short:

- One Issue per branch (`--no-track` from `sprint-N-staging`); tests red first, then green; nothing pushed, merged or
  posted without the user's OK.
- Record tables (`docs/contributions.md`, `docs/ai-use.md`, every version history, STS §5): touch only your Issue's
  rows; label version rows with the Issue ID; never edit a `Document version` line (the integration Issue does).
- Claim new D-/CH-/UX-/E-/TEST-/EV- numbers on the Issue after checking staging and open PRs.
- Timestamped migration folders; feature-local CSS, types, routers and domain modules.
- Evidence specs write files only with `S2_SIDE` / `L7_SIDE` / `EVIDENCE=1` set.
- Merge `origin/sprint-N-staging` into the branch locally before opening or updating a PR, then rerun every suite.
