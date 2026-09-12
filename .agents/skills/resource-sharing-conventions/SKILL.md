---
name: resource-sharing-conventions
description: Use when adding, editing, or reviewing Mister F resource sharing behavior, including share links, QR/share modals, profile sharing, shared resource pages, access grants, anonymous shared-resource flows, and share-related access checks.
---

# Resource Sharing Conventions

Use this skill with `resource-page-conventions` and `bootstrap-modal-conventions`
for share UI, and `database-migration-safety` when the change touches persisted
sharing data.

## Core Rules

- Sharing to run is generic and live. One `resource_share_links` row per
  resource (`getOrCreateResourceShareLink`) and one `resource_access_grants` row
  per accepted recipient profile (`grantResourceAccess`). There is no per-type
  share-link table, and the run link never copies.
- Recipients of the run link always see the owner's current resource, not a
  snapshot. Share modal copy must explain this live behavior.
- The one deliberate exception is **sharing a copy** (Roadmap V3 §1.19), the
  teacher-to-teacher path. See [Copy Links](#copy-links-teacher-to-teacher)
  below. It is the only place a snapshot copy crosses accounts.
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

## Copy Links (Teacher-To-Teacher)

"Compartir una copia" gives another teacher their own copy of a resource, to
edit and run with their own students (Roadmap V3 §1.19). It is a separate
mechanism from the run link, on purpose:

- **Separate token, separate table.** `resource_copy_links`, at most one active
  per resource (partial unique index). The run link's id never works as a copy
  link, and `/resources/copy/:id` never offers to run the resource.
- **Copying hands over the answer key**, so the author mints the link
  explicitly (`POST /resources/:id/copy-link`). Never create one on page view
  the way `getOrCreateResourceShareLink` does. Revoking
  (`/copy-link/revoke`) sets `revoked_at`, the old id stays dead, and a later
  create mints a new id. Copies already made are never taken back.
- **The copy is a snapshot owned by the recipient**, made by
  `copyResourceFromLink` (`resources/duplicate.ts`): authored content only, no
  participation, shares, or grants, and it keeps its original title. Folders
  recurse.
- **Origin lives in `resource_copies`, not in `resources.source_*`.** Detail
  pages read `sourceProfileId` as "Compartido por", and a copy is owned, not
  shared. `origin_*` is the root author, kept along chains. Pages credit it
  with `partials/resource-copied-from.ejs` ("Basado en un recurso de …").
- A second accept by the same profile opens its existing live copy
  (`findActiveCopyOfResourceForProfile`) instead of piling up duplicates.
- The owner UI is one shared partial, `partials/resource-copy-link-modal.ejs`
  (`#resourceCopyLinkModal`, locals from `buildCopyLinkModalLocals`), opened
  from `Opciones` → "Compartir una copia" and from `?share=copy`. The run
  action is labelled "Compartir para practicar".
- Log `resource_copy_link_created`, `resource_copy_link_revoked` and
  `resource_copy_link_accepted`. The last one is the adoption metric.

## Checks Before Finishing

- Verify owner, recipient, anonymous, and archived-resource paths for the
  changed share surface.
- Verify no new per-type share table slipped in, and that no snapshot copy
  crosses accounts outside the copy-link path.
- Add route-level tests for new share render/accept/start behavior.
- Run typecheck/tests and restart the local server when server or view code
  changed.
