---
name: versioning-and-releases
description: Use when deploying to production, bumping the app version, tagging a release, or answering which version runs in production. Covers the MAJOR.MINOR.PATCH scheme anchored to roadmap versions, how to choose the bump for a deploy, the tag-before-deploy requirement enforced by deploy.sh, and where the version is exposed at runtime.
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

`deploy.sh` enforces the policy: it refuses to deploy when `HEAD` is not
tagged `v<package.json version>`, and pushes with `--follow-tags` so the tag
reaches the remote. Annotated tags only — `--follow-tags` does not push
lightweight tags.

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
