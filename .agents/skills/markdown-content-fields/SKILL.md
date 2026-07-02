---
name: markdown-content-fields
description: Use when adding, editing, or reviewing Mister F fields that store or render markdown, including resource descriptions, tutor instructions, roleplay scenarios, markdown editors in edit forms, `data-render-markdown` views, or prompts that let the model produce markdown.
---

# Markdown Content Fields

Use this skill with `ejs-view-structure` for view changes and
`system-prompt-coherence` when telling the model a field accepts markdown.

## Core Rules

- Long-form learner/author content fields are markdown-capable: resource
  descriptions, practice-guide tutor instructions, roleplay
  scenario/pedagogical focus, and similar prose fields. Short identity fields
  (titles, names, labels) are plain text.
- Render markdown on the client: give the container the `resource-markdown`
  class plus the `data-render-markdown` attribute; the shared client
  initializer renders it with `renderMarkdown` from
  `src/client/chat/shared/markdown.js`.
- `renderMarkdown` is the only sanctioned markdown renderer. Never interpolate
  user or model text into HTML manually; EJS output escaping plus the shared
  renderer is the safe path.
- Edit forms use the shared EasyMDE-based editor: add `data-markdown-editor`
  to the textarea and let `src/client/shared/markdownEditor.js` initialize it
  with the standard toolbar (heading, bold, italic, lists, quote, link,
  preview). Do not hand-roll per-page editors or extend the toolbar ad hoc.
- When a model-facing prompt covers a markdown-capable field, say so
  explicitly and name the allowed constructs (headings, bold, lists, quotes,
  links) so drafts and revisions produce consistent formatting.
- New markdown surfaces should degrade gracefully: the stored value is plain
  markdown text, so views that skip rendering still show readable content.

## Checks Before Finishing

- Verify new markdown output goes through `data-render-markdown`, not `<%-`
  raw interpolation.
- Verify the edit field and the detail view agree: if a field is edited as
  markdown it must render as markdown everywhere it is shown, including
  shared/anonymous pages.
- Verify authoring prompts mention markdown capability for the field if the
  model can write it.
- Run the client build and restart the local server when view or client code
  changed.
