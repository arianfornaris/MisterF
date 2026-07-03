---
name: parallel-agent-worktrees
description: Use when asked to work in an isolated or temporary git worktree, when another agent is working on this repo at the same time, or when setting up, verifying, or handing off a parallel task branch for later integration in the main MisterF checkout.
---

# Parallel Agent Worktrees

Multiple agents work on this repo at the same time by giving each session its
own throwaway git worktree and task branch. The main checkout
(`/Users/arian/Documents/GameDev/MatandileGames/MisterF`) belongs to the
owner, who integrates, builds, and tests once at the end. Never do parallel
work directly in the main checkout while another agent is active there.

## Session Setup

Run from the main checkout, then work only inside the new worktree:

```bash
git worktree add ../MisterF-<task-slug> -b <task-slug>
cd ../MisterF-<task-slug>/misterf-web
npm install
cp <main-checkout>/misterf-web/.env.development .
```

- Branch from the current `main`; pick a short task slug for both folder and
  branch name.
- `.env.development` and `data/misterf.sqlite` are gitignored, so a fresh
  worktree lacks them. Copy the env file always; copy the SQLite file into
  `data/` only when the task truly needs the running app.

## Rules While Working

- Commit everything with a normal `git add -A` — the worktree contains only
  this task's changes, so no selective staging is needed.
- Do not run the client/server build and do not commit changes under
  `misterf-web/dist/` or `misterf-web/public/build/`. Built artifacts are
  regenerated once by the owner after integration; committing them from a
  branch causes hash conflicts with every other branch.
- Do not restart or stop the shared pm2 server (`npm run pm2:restart`); it
  serves the main checkout. Verify with `npm run typecheck` and `npm test`
  instead — the tests create their own temporary SQLite databases and do not
  need the copied env or DB.
- New DB migrations: take the next free id on top of current `main`. If the
  integration lands another migration first, renumber yours during the merge
  (migrations are forward-only; see `database-migration-safety`).
- If the task changes a shared convention, update the matching skill in the
  same branch so parallel agents pick it up after integration.

## Handoff and Integration

- End the session by reporting the branch name and a one-line summary of what
  it contains; leave the branch fully committed (no dirty files).
- Integration happens in the main checkout, typically by the owner or a later
  session there:

```bash
git merge <task-slug>            # repeat per finished branch
npm run pm2:restart              # single build + restart with everything merged
# manual testing happens here
git branch -d <task-slug>
git worktree remove ../MisterF-<task-slug>
```

## Checks Before Finishing

- `git status` in the worktree is clean and everything is committed on the
  task branch.
- No `dist/` or `public/build/` changes are committed.
- `npm run typecheck` and `npm test` pass inside the worktree.
