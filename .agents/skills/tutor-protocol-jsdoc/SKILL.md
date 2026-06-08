---
name: tutor-protocol-jsdoc
description: Use when adding, editing, or reviewing tutor structured response blocks in Mister F, especially changes to system-prompts/tutor/system.md, llmTutor schemas/types, block renderers, or block-specific prompt rules. Ensures the TypeScript-like protocol with JSDoc remains the source of truth.
---

# Tutor Protocol JSDoc

Use this skill whenever changing the tutor structured response protocol.

Rules:

- Treat `misterf-web/system-prompts/tutor/system.md` as the source of truth for tutor block documentation.
- Document every tutor block next to its TypeScript-like interface using JSDoc.
- Document every learner-facing or model-facing property inside the interface, not in a separate repeated rule section.
- For every textual property, explicitly state the expected language:
  - Spanish for tutor-facing prose, labels, titles, prompts, explanations, summaries, and rubrics.
  - English for English practice sentences, answers, tokens, and dialogue lines when the exercise is English practice.
  - Preserve original language for transcripts and evaluated learner text.
  - Mixed or context-dependent only when the property truly supports both languages.
- Keep block-specific rules beside the relevant block or property.
- Avoid adding separate duplicated sections such as "`X Block Rule`" when the same rule belongs in the protocol JSDoc.
- Update `system-prompts/tutor/structured-correction.md` whenever adding or removing a valid block type.
- Update `src/server/services/llmTutor/types.ts` and `schemas.ts` in the same change as the protocol.
- If a block has contextual validation that Zod cannot know, document that behavior in the block JSDoc and implement it in a shared server service.
- If a block is a side-effect block rather than a normal chat bubble, document where it renders or how the client consumes it.

Checklist:

- The block appears in the `TutorResponseBlock` union in `system.md`.
- The block has a JSDoc comment above its interface.
- Each property has a JSDoc comment.
- Textual properties say Spanish, English, original language, or context-dependent.
- The server type union includes the block.
- The Zod response schema includes the block.
- Runtime side effects and client rendering are updated when needed.
- The structured correction prompt accepts the same block list.
