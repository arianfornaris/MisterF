---
name: prompt-attachments
description: Use when adding, editing, or reviewing any Mister F surface where a user writes a prompt for an AI inference — resource creation pages, "Modify with AI" modals, the chat composer, scene media prompts, create-from-context flows — or when touching the attachment ingestion, extraction, staging, or wizard code. Every prompt field must offer file and URL attachment, because an attachment is part of the prompt.
---

# Prompt Attachments

**Wherever a user can write a prompt, they must be able to attach a file or a
URL.** There is no prompt surface that is exempt. A user who can describe what
they want in words must be able to hand over the document they are describing.

Pair this with `ai-authoring-chat-conventions` (the proposal-and-approval
modals), `llm-credit-gate` (extraction spends credit), and
`project-language-conventions` (every label and error is translated).

## The Governing Rule

**An attachment is part of a prompt and shares that prompt's fate.**

Everything else follows from it:

- Where the prompt persists, the attachment persists with it. In chat the prompt
  is a message in a conversation, so the attachment persists alongside it and
  later turns can refer back to it.
- Where the prompt is consumed and gone, so is the attachment. Every authoring
  operation is single-turn — request in, proposal out, no history — so the
  attachment lives exactly as long as that one request. A revision cannot refer
  to a document from an earlier operation for the same reason it cannot refer to
  an earlier prompt: neither is there any more.
- There is **no attachment library**, no re-use of a previously uploaded
  document, and no carrying material from a creation step into a later revision.
  Anyone who wants the same worksheet twice attaches it twice.
- An attachment does **not** propagate into the entity a prompt produced. A
  roleplay generated from a PDF does not carry that PDF into its attempt turns.

## The Binary Is Never Persisted

An attachment is extracted to clean text up front, by its own inference, and the
bytes are dropped. What travels and what is stored is the extracted text.

This is what makes the review step honest: the text the user approves is the
text the model reads, on every turn. There is no richer first-turn
representation that later turns silently lose.

## Wiring A New Prompt Surface

Four steps. Do all four; three of them look complete on their own.

1. **View** — include the picker partial. It has two halves so a caller can
   place them separately:

   ```ejs
   <%- include('partials/attachment-picker', {
     partOnly: 'trigger', wizardId: 'myFeatureAttachmentWizard' }) %>
   ```

   Inside a modal, place `partOnly: 'trigger'` in the body and `partOnly:
   'wizard'` as a **sibling of that modal**, never nested — a modal inside a
   modal is a stacking problem nobody needs. On a plain page, omit `partOnly`
   and both halves render together. Give every surface its own `wizardId`.

2. **Client** — `initializeAttachmentPicker(root)` returns a handle with
   `getIds()` and `clear()`, or `null` when the surface has no picker. For a
   form post the hidden `attachmentIds` field is submitted for you. For anything
   that posts by fetch or socket, send `getIds().join(',')` yourself and call
   `clear()` after — staged ids are claimed once, so leaving them behind attaches
   nothing while looking like it would. Modals using the shared modification
   controller pass them through `extraFields()`.

3. **Server handler** — `claimRequestAttachments(request, userId)`. Claiming is
   ownership-checked and one-shot, so a replayed id cannot re-attach another
   account's material or the same file twice.

4. **Service** — thread `attachments` through to the inference. Anything behind
   `generateStructuredDraft` only needs the parameter passed down; it already
   composes the user message and appends the authoring rules.

## Authored Resources Must Not Mention The Source

A generated resource is opened by a learner who never saw the material and does
not know it existed. `generateStructuredDraft` appends
`attachments/authored-resource-rules.md` whenever material is present, which
forbids "based on the attached document" and every equivalent.

**Any new authoring path that puts attachment text into a prompt without going
through `generateStructuredDraft` must append those rules itself.** This is the
easiest way to reintroduce the bug: a guide once described itself as "Práctica
interactiva basada en el documento adjunto", which is a reference to something
the reader cannot see.

Chat is the deliberate exception. There "in the worksheet you sent me" is
exactly right, because the learner is the person who attached it.

## Extraction Spends Credit

Processing runs a real model call, charged to the user, at the moment they press
`Procesar` — before any resource or message exists. So:

- Gate it with `getCreditCheckedOpenRouterApiKeyForUser`, like any inference.
- Handle `CreditExhaustedError` as product UI inside the wizard.
- Never re-send an attachment into a correction or repair turn. A retry exists
  to fix malformed JSON; re-billing the document to do that is a pure cost bug.
- Tests must never run real extraction. Mock
  `services/attachmentExtraction.js`; everything worth asserting — validation,
  staging, ownership, approval, SSRF — happens either side of it.

## Checks Before Finishing

- Every prompt field on the surface offers attachment, not just the main one.
- The wizard modal is a sibling of any modal it opens from, with a unique id.
- Staged ids reach the server and are cleared after the request.
- Labels, warnings, and rejections are in all three locales (`es`, `en`, `ht`).
- For an authoring path, the resource never names its source.
- `npm run typecheck`, `npm run test:typecheck`, `npm test`, then restart the
  local server.
