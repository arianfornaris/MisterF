# Agent Skill Gap Analysis

## Purpose

This document captures which recurring Mister F patterns should become agent
skills and which information should remain normal documentation.

Docs are the product and system source of truth. Skills are short operational
checklists for repeated implementation behavior that agents are likely to touch
again.

## Rule Of Thumb

Use documentation when the artifact answers:

- what the product does
- why a feature exists
- how the system is structured
- what the long-term roadmap or tradeoff is

Use a skill when the artifact answers:

- what an agent must remember every time it edits a repeated pattern
- what files, migrations, prompts, or UI rules must be checked before changing
  that pattern
- what validations should run before finishing that class of work

Good skills should be concise, triggerable from real tasks, and focused on
preventing repeated mistakes.

## Current Skill Coverage

Existing project skills already cover these repeated patterns:

- project artifact language conventions
- database migration safety
- Bootstrap, Bootswatch Flatly, modal, tabs, icon, and surface conventions
- EJS view structure
- LLM credit gates
- LLM tool documentation
- prompt coherence
- tutor structured block protocol
- local server restart after runtime/view changes

Newly added skills cover two gaps:

- `resource-page-conventions`: resource catalog, detail pages, edit pages,
  attempts, results, breadcrumbs, close buttons, action rows, and resource
  history.
- `learner-progress-events`: progress event recording and labels for tutor
  reports, quizzes, roleplays, and future evaluated resources.

## Recommended Future Skills

### Resource Sharing Conventions

Create this when the next sharing refactor starts.

Scope:

- live shared resource references instead of copies
- profile sharing and link sharing
- QR/link modal behavior
- access checks for shared resources
- future public/free quiz and roleplay exceptions

Why it should be a skill:

Sharing appears across quizzes, practice guides, folders, and roleplays.
The rules are easy to accidentally re-implement differently per resource type.

### AI Authoring Chat Conventions

Create this before adding another AI-assisted editor.

Scope:

- General/AI Chat tab layout
- showing authoring conversation history
- sending prior history to each inference
- assistant reply plus structured JSON changes
- pending modal scroll behavior
- avoiding revision-history tables unless explicitly needed

Why it should be a skill:

Quizzes and roleplays already share the pattern. Future resource types will
probably need the same assisted editing workflow.

### Resource Attempt Runtime

Create this before adding another evaluated runtime resource.

Scope:

- start attempt
- freeze resource snapshot
- run interaction
- finish/evaluate
- result page
- follow-up actions
- avoiding separate persisted preview/test attempt modes
- progress event writing

Why it should be a skill:

Quizzes and roleplays now share an attempt/result lifecycle. A new resource
with evaluated learner output should not have to rediscover this architecture.

### Resource Follow-Up Conversations

Create this before expanding follow-up practice from results.

Scope:

- creating a Mr. F conversation from another resource result
- storing frozen source snapshots
- showing the source resource link in the conversation
- applying credit policy
- preventing the tutor from re-grading the same result

Why it should be a skill:

Quizzes, roleplays, and future resources need consistent handoff into Mr. F.

### Markdown Content Fields

Create this if markdown-capable fields continue to expand.

Scope:

- which fields render markdown
- which edit fields use the Markdown editor
- model instructions for markdown-capable fields
- safe markdown rendering expectations

Why it should be a skill:

Markdown appears in practice guides, quizzes, roleplays, exercise prompts,
and general resource info. The same decision keeps coming back.

### Roleplay Pedagogy And Evaluation

Create this after another pass on roleplay quality.

Scope:

- learner English production focus
- avoiding moral/personality judgment unless it affects language learning
- sentence-evaluation-style review
- creative or uncomfortable scenarios as valid practice contexts
- free-form turn limits and future guest/free policy

Why it should be a skill:

Roleplay has domain-specific model behavior that is separate from generic tutor
prompt coherence.

## Not Recommended As Skills Yet

The personalized home suggestion feature should remain normal documentation and
a tracker for now. It is too large and unsettled to encode as a reusable
checklist.

One-off product explorations should also remain docs until they produce
implementation patterns that repeat across the platform.

## Maintenance Notes

When a new repeated pattern appears three or more times, consider creating a
skill. Keep the skill short and link the broader rationale to docs instead of
copying the full product explanation into the skill.
