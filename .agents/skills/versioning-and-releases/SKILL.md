---
name: versioning-and-releases
description: Use when deploying to production, bumping the app version, tagging a release, or answering which version runs in production. Covers the MAJOR.MINOR.PATCH scheme anchored to roadmap versions, how to choose the bump for a deploy, the tag-before-deploy requirement enforced by deploy.sh, merging the release onto the production branch (main) before deploying — a deploy request authorizes that merge, which is announced rather than asked about — and where the version is exposed at runtime.
---

# Versioning And Releases

Mister F versions deploys with a SemVer-shaped scheme anchored to the product
roadmaps. The version lives in `misterf-web/package.json` and every production
deploy is a git tag.

## The Scheme

`MAJOR.MINOR.PATCH`:

- **MAJOR** — the roadmap version (`docs/roadmap/roadmap-vN.md`). Bump it only
  when a new roadmap's release ships to production (V1 → `1.x.y`, V2 →
  `2.0.0`).
- **MINOR** — a deploy that adds or changes user-facing functionality.
- **PATCH** — a deploy with only fixes, docs, refactors, or config changes.

Deciding the bump: "does this deploy change what a user can do or see?" Yes →
MINOR. No → PATCH. New roadmap release → MAJOR.

History note: `v1.0.0` is the V1 release deployed 2026-07-02; tagging started
at `v1.1.0` (2026-07-04), so `v1.0.0` has no tag.

## Release Steps (Before Running deploy.sh)

1. Choose the bump and set it without creating a tag yet:
   `cd misterf-web && npm version <new-version> --no-git-tag-version`
2. Commit the bump together with (or after) the work being released.
3. Tag the release commit with an annotated tag summarizing the release:
   `git tag -a v<new-version> -m "<one-line release summary>"`
4. Run `./deploy.sh` from the repo root (see `production-server-ops`).

Annotated git tags are the release history; GitHub releases are NOT part of
the flow (a "release" here means a tagged production deploy).

`deploy.sh` enforces the policy: it refuses to deploy when `HEAD` is not
tagged `v<package.json version>`, and pushes with `--follow-tags` so the tag
reaches the remote. Annotated tags only — `--follow-tags` does not push
lightweight tags.

## Deploy Branch — Merge To main First

Production tracks **`main`**: `deploy.sh` pushes the branch you run it from, but
the server only advances `main` via `git pull`, and every release tag lives on
`main`. So the release commit and its tag must be on `main` before `deploy.sh`
actually changes production. Deploying from a feature/dev branch (e.g. `v3`)
"succeeds" but is a **no-op** — the remote logs `Already up to date` and
`/health` still reports the old version. Confirm the production branch from
`deploy.sh` (the remote `git pull`) rather than assuming; treat `main` as the
default here.

Before deploying, check the branch you are on:

1. **On `main`** → proceed straight to the Release Steps above.
2. **On another branch** (e.g. `v3`) → that branch is not the deploy branch.
   **A request to deploy to production is the authorization to merge it into
   `main`.** Do not stop to ask again: asking to deploy from a working branch
   has no other possible meaning, since deploying from anywhere else is a no-op.
   Fast-forward `main` to the working branch, then bump / tag (Release Steps)
   and deploy **from `main`**:
   ```bash
   git merge-base --is-ancestor origin/main <branch> \
     && git checkout main && git merge --ff-only <branch> \
     || echo "diverged — do NOT force; surface it and ask how to reconcile"
   ```
   If the fast-forward is not possible (the branches diverged), do not force it
   or create a merge commit blindly — surface the divergence and let the user
   decide how to reconcile.

What the merge still requires is **telling the user what is going with it**,
before running it, not asking permission for it. Merging brings *everything* on
the branch into production, which is usually more than the change at hand, so
list the commits (`git log origin/main..HEAD --oneline`), name any behavior
change that affects people already using the site, and say whether there are
database migrations. Then merge and deploy. The user can stop it; they cannot
un-deploy something they were never told about.

After deploying, verify production actually moved:
`curl -s https://misterf.us/health` must report the new version (pm2's version
column can lag — trust `/health`).

## Where The Version Is Visible

- `GET /health` returns `{ ok, version }` — check production with
  `curl -s https://misterf.us/health`.
- The `server_started` log line includes `version`.
- `git tag --list 'v*'` is the release history; each tag marks exactly what
  was deployed.

## Cautions

- Never retag or delete a pushed tag; if a release was mistagged, bump again
  and deploy the corrected version.
- The version comes from `package.json` at runtime (read by
  `src/server/config/env.ts`), so the bump must be committed — not just
  tagged — for production to report it.
