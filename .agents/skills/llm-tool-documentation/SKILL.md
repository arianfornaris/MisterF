---
name: llm-tool-documentation
description: Use when creating, editing, or reviewing any LLM-accessible tool in Mister F, including AI SDK `tool(...)` definitions, MCP-style tools, tutor tools, chat-room tools, progress tools, practice-module tools, or any schema exposed to a model. Requires documenting both the tool and every input parameter, and keeping project tool docs synchronized.
---

# LLM Tool Documentation

Every tool exposed to an LLM must have complete documentation. This is mandatory and fundamental because the model uses this documentation to decide when to call the tool and how to fill its parameters.

## Required Contract

When creating or modifying a tool:

- Document the tool itself with a clear `description`.
- Document every input parameter in the schema.
- For Zod schemas, use `.describe(...)` on each field.
- For nested objects or arrays, document each meaningful nested field too.
- Say when the tool should be used.
- Say when the tool must not be used.
- For optional parameters, explain exactly when to omit them.
- For ids, explicitly state that the model must use real ids from tool results, current context, or stored records, and must never invent, slugify, translate, or guess ids.
- For user-facing text fields, specify the required language.
- For hidden/system-facing instruction fields, specify whether they are persistent configuration, transient chat state, progress, or evaluator guidance.

## Project Documentation

When adding, renaming, deleting, moving, or changing the purpose of a tool, update the project docs in the same task:

- `docs/architecture.md`: keep the Tool Architecture section as the architectural entry point listing every tutor-accessible tool family, every tool name, and the source file where each family is defined.
- `docs/tutor-runtime.md`: keep Tools Available to Mr. F aligned with the runtime behavior, including current tool families, full tool lists, availability constraints, and high-level usage boundaries.

If only parameter wording changes and the tool list/purpose does not change, docs may not need a content update, but still verify that the docs remain accurate.

## Review Checklist

Before finishing tool work, inspect the final tool definition and confirm:

- The top-level tool `description` exists and is specific.
- Each `inputSchema` field has parameter-level documentation.
- Optional fields document their fallback behavior or omission rule.
- The documentation prevents the most likely misuse of the tool.
- `docs/architecture.md` lists any new, renamed, moved, or removed tools and points to the correct source files.
- `docs/tutor-runtime.md` lists the current tools available to Mr. F and accurately describes their runtime use.
- The compiled server still typechecks.

## Example Pattern

```ts
inputSchema: z.object({
  resourceId: z.string().trim().min(1)
    .describe('Real saved resource id from tool results or current context. Never invent, slugify, translate, or guess this id.'),
  title: z.string().trim().min(1).max(220)
    .describe('Short Spanish title shown to the learner. Include only when creating or renaming the saved resource.'),
})
```
