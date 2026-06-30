# Home Suggestions Tracker

Date: 2026-06-29

This tracker splits personalized home suggestions out of Resource
Simplification V2. The feature is large enough to deserve its own design,
ranking, data, and UX work instead of being bundled into resource foundation
cleanup.

Primary exploration document:

- [Home Start Experience](../features/home-start-experience.md)

## Product Goal

When a learner starts a new Mr. F conversation, the app should suggest useful
practice directions without forcing surveys or interrupting the learner. The
suggestions should combine:

- learner profile context
- previous conversations
- learner progress
- quizzes and practice guides
- future roleplays
- built-in practice topic library content

## Initial Scope

- [ ] Define the suggestion surfaces:
  - home page
  - new chat empty state
  - resource follow-up entry points
- [ ] Define suggestion types:
  - conversation starter
  - practice guide
  - quiz follow-up
  - roleplay
  - built-in topic
- [ ] Define ranking inputs.
- [ ] Define privacy and logging boundaries.
- [ ] Decide whether suggestions are generated on demand, cached, or mixed.
- [ ] Design a small built-in topic library.
- [ ] Add resource-aware metadata requirements.
- [ ] Add credit policy for any AI-generated suggestions.
- [ ] Add tests for deterministic ranking and fallback suggestions.

## Deferred From Resource Simplification V2

Resource Simplification V2 Slice 9 now updates progress, logging, and payment
docs for resource context only. Home suggestions are intentionally deferred to
this tracker.
