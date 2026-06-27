# Testing

## Standard

Mister F uses Vitest as the standard test runner for TypeScript tests.

Tests live in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/tests`

The Vitest configuration lives in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/vitest.config.ts`

The TypeScript test configuration lives in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/tsconfig.test.json`

## Commands

Run the deterministic test suite:

```bash
cd /Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web
npm test
```

Run tests in watch mode:

```bash
cd /Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web
npm run test:watch
```

Typecheck test files:

```bash
cd /Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web
npm run test:typecheck
```

## Tutor Loop Regression Fixtures

Tutor loop tests should protect deterministic project boundaries, not call a
live LLM.

Good targets:

- schema boundaries such as normal tutor output vs persisted/renderable blocks
- block repair detection such as `message` leaking blanks, answer options, or
  inline evaluation JSON
- prompt contract assembly such as removed block types staying out of the
  protocol
- model-facing history serialization such as preserving accepted `{ blocks:
  [...] }` JSON
- runtime helper behavior that can be tested without Socket.IO, OpenRouter, or
  a database

Avoid:

- tests that call OpenRouter or any external model provider
- snapshotting the full assembled system prompt unless the specific test is
  about a small, stable contract
- tests that depend on production data, local SQLite contents, PM2, or browser
  state
- broad "model should behave" assertions that are really prompt-quality
  expectations rather than deterministic code behavior

## Current Baseline

The initial tutor regression suite covers:

- `quiz_result` is rejected from normal tutor responses but accepted for
  persisted/renderable history.
- `sentence_evaluation.parts` must reconstruct `sourceText`.
- `message` leakage detection catches fill-in-the-blank placeholders,
  open-ended writing prompts, evaluable multiple-choice prompts, and inline
  evaluation JSON.
- Optional lettered navigation lists are not treated as multiple-choice
  exercises.
- Removed prompt/protocol concepts such as `direction_choice` and the generic
  `start-session` nudge stay out of the normal tutor prompt path.
- Model-facing assistant history preserves structured `{ blocks: [...] }`
  payloads instead of falling back to lossy markdown.
