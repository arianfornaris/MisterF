---
name: resource-sharing-conventions
description: Use when adding, editing, or reviewing Mister F resource sharing behavior, including share links, QR/share modals, profile sharing, shared resource pages, access grants, anonymous shared-resource flows, and share-related access checks.
---

# Resource Sharing Conventions

Use this skill with `resource-page-conventions` and `bootstrap-modal-conventions`
for share UI, and `database-migration-safety` when the change touches persisted
sharing data.

## Core Rules

- Sharing is generic and live. One `resource_share_links` row per resource
  (`getOrCreateResourceShareLink`) and one `resource_access_grants` row per
  accepted recipient profile (`grantResourceAccess`). There is no per-type
  share-link table and no copied-import sharing.
- Recipients always see the owner's current resource, not a snapshot. Share
  modal copy must explain this live behavior.
- Share URLs are `/resources/shared/:shareId`; accepting posts to
  `/resources/shared/:shareId/accept` and records `grantedVia: 'link'`.
  Profile sharing grants access directly with `grantedVia: 'profile'`.
- Folder shares expose the folder's current contents through the accepted
  grant. Access to a folder implies access to what it currently contains.
- Authorization goes through `findResourceAccessForProfile` (owner or shared).
  A shared resource that the owner archived is not reachable by recipients;
  redirect them to `/resources`.
- Share modals offer the absolute URL, a copy action, a native-share action,
  and a QR code (`QRCode.toDataURL`, margin 1, width 180).
- Log accepted shares as `resource_share_link_accepted` with resource, owner,
  and recipient context.

## Anonymous Flows (Growth)

- Shared quizzes: anyone can open and fill the quiz. `POST
  /quizzes/shared/:shareId/take` creates a guest attempt (rate limited per IP
  via `fixedWindowRateLimiter`); pressing `Evaluar` saves answers and routes
  through signup, then the attempt is claimed and evaluated on the student's
  own credit-gated key.
- Shared roleplays and practice guides: the shared page shows general info
  plus `Comenzar`. `GET /{roleplays|practice-guides}/shared/:shareId/start`
  gates on an account, then grants access and launches on the user's own key.
- Place the account wall at the value-consuming action (evaluation or LLM
  launch), never at the viewing step, and resume the flow after auth.

## Checks Before Finishing

- Verify owner, recipient, anonymous, and archived-resource paths for the
  changed share surface.
- Verify no new per-type share table, copied import, or snapshot share slipped
  in.
- Add route-level tests for new share render/accept/start behavior.
- Run typecheck/tests and restart the local server when server or view code
  changed.
