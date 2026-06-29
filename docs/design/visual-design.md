# Visual Design, Theme, and Color System

## Goal

Mister F should feel consistent across the whole application while still giving
the tutor experience its own pedagogical visual language.

The design rule is:

- Bootstrap and Bootswatch `Flatly` own the application theme.
- Mister F custom tokens own only the instructional visuals inside practice and
  chat content.
- Links, buttons, menus, forms, alerts, badges, cards, tables, and app chrome
  should use Bootstrap classes and Bootstrap variables.

## Theme Source of Truth

The app uses Bootswatch `Flatly`.

When building or changing UI, prefer Bootstrap primitives first:

- `btn`, `btn-primary`, `btn-outline-secondary`, `btn-link`
- `card`, `list-group`, `table`, `badge`, `alert`
- `dropdown`, `modal`, `offcanvas`
- spacing, color, flex, grid, and typography utilities
- Bootstrap Icons for iconography

Do not create a custom visual treatment when Bootstrap already provides the
state or component.

## Controls

Buttons and links must follow Bootstrap.

This includes controls rendered inside tutor messages or exercise cards. If an
element behaves like a button or link, it should use Bootstrap button/link
classes and should not receive custom color rules.

Examples:

- A buy-credits CTA inside a tutor message should use `btn btn-primary`.
- A secondary action should use `btn btn-outline-secondary` or `btn-link`.
- A generated practice-guide link inside a tutor message should use a
  Bootstrap button/link variant, not a custom color.
- Markdown links inside messages should inherit Bootstrap link styling.

Avoid selectors like:

```css
.message-bubble a {
  color: ...;
}
```

That kind of rule can accidentally override Bootstrap buttons and make the UI
feel inconsistent.

## Modals

Use standard Bootstrap modal structure and actions.

Modal rules:

- A dismissible modal should have a header `btn-close`.
- Do not use `btn-link` or plain links for modal `Cerrar` or `Cancelar` actions.
- Modal close/cancel actions should be real buttons with
  `data-bs-dismiss="modal"`.
- Informational modals can use a primary close action, such as `Cerrar` or
  `Entendido`.
- Confirmation, form, destructive, purchase, or generation modals should keep the
  main action visually dominant and use `btn-secondary` for `Cancelar` or
  `Cerrar`.
- Destructive confirmations should place `Cancelar` before the `btn-danger`
  action.
- Pending modals with static backdrop/keyboard disabled should not include close
  controls.
- Long-running modal submits should disable the submit button, change its label,
  and show a pending/loading modal or spinner immediately.
- If a request creates a report, resource, module, checkout, or other server-side
  result, the UI must not look idle while the browser waits.

The project skill
`/Users/arian/Documents/GameDev/MatandileGames/MisterF/.agents/skills/bootstrap-modal-conventions`
contains the operational checklist for future modal work.

## Tutor Exercise UI

Tutor exercise cards may use Mister F custom colors for instructional identity,
but their interactive controls should still feel native to Bootstrap and the
Flatly theme.

General rules:

- Exercise cards can use custom tokens for borders, accents, highlights,
  selected token surfaces, and correctness feedback.
- Buttons, links, dropdown actions, modal actions, and quiz navigation should
  use Bootstrap classes and Bootstrap variables.
- Exercise controls should not look disabled unless they are actually disabled.
- Long learner-visible text should remain readable after selection.
- Exercise controls should use the normal UI font when they behave like app
  controls; reserve the pedagogical serif voice for prompts, sentences, and
  learning content.

### Scramble blocks

`unscramble_sentence` and `quiz_unscramble_sentence` render shuffled tokens on
the client, but the model-provided `tokens` array is stored in the correct order.

UI guidance:

- token chips can use Mister F practice tokens for their card identity
- the submit/check action should use Bootstrap button semantics
- links or CTAs near the card should use Bootstrap link/button colors
- feedback text can use semantic danger/success styling, but not arbitrary
  legacy reds

### Fill-in-the-blank blocks

Inline blank controls need enough room for realistic learner answers.

UI guidance:

- text-input blanks should size generously for the expected answer
- choice blanks should account for the longest option where practical
- selected long options should not be clipped in the sentence
- spacing around cards and headings should use Bootstrap spacing utilities or
  clearly named local layout rules

### Multiple-choice blocks

Multiple-choice options may contain long phrases or full clauses.

UI guidance:

- selected options should remain readable
- option layout should wrap/flex instead of truncating meaningful text
- selection states may use custom practice highlights, but not Bootstrap button
  colors unless the option is intentionally rendered as a Bootstrap button

- loading/pending states should use Bootstrap spinners or disabled button states
- evaluation focus labels should use Bootstrap badges before custom badge styles
- the submitted state should make the textarea read-only/disabled and show a
  clear completed status
- do not color the submit button with practice accent tokens

### Optional direction lists

Optional next-step choices are learner navigation text, not interactive exercise
widgets.

UI guidance:

- keep optional `a)`, `b)`, `c)` direction lists inside normal `message` prose
- do not render them like `multiple_choice`
- do not add correctness, selected-answer, or exercise-evaluation states
- use standard Markdown/Bootstrap text styling instead of bespoke cards

### Quiz UI

Quiz UI should follow Bootstrap's control language.

UI guidance:

- close controls should be Bootstrap-friendly and not use bespoke shapes that
  fight Flatly
- `Atrás`, `Siguiente`, and `Evaluar` should use `btn-primary`
- secondary sizing is fine for navigation, but the styling should remain clearly
  enabled when the action is available
- `Evaluar` should be disabled only until the quiz has enough input to submit
- quiz control labels should use the normal UI font

## Custom Color Tokens

Custom colors are allowed only for the tutor/practice visual language. They are
defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/client/styles/base.css`

The tokens use the `--mf-*` prefix.

### Practice Tokens

Use `--mf-practice-*` for the main instructional blue/teal language:

- user message bubble accents
- matching-pairs cards
- fill-in-the-blank input highlights
- translation prompt borders
- selected practice items

### Exercise Type Tokens

Use exercise type tokens to distinguish structured learning blocks:

- `--mf-choice-*`: choice-based fill-in-the-blank and related orange accents
- `--mf-quiz-*`: quiz card identity
- `--mf-teal-*`: quiz result and unscramble-related accents
- `--mf-practice-blue`: multiple-choice identity

These colors are for borders, labels, highlights, and surfaces. They are not for
generic app buttons or links.

### Feedback Tokens

Use feedback tokens for learner evaluation states:

- `--mf-success-*`: correct, completed, accepted
- `--mf-warning-*`: partial, can improve, missed answer
- `--mf-danger-*`: error, incorrect, failed attempt

These are appropriate for:

- evaluation badges
- sentence-part highlights
- exercise feedback panels
- correctness states inside practice cards

When the same state appears as a Bootstrap component, prefer Bootstrap semantic
classes first, such as `alert-warning`, `text-bg-success`, or `btn-danger`.

### Dialogue Tokens

Use `--mf-dialogue-*` for inline dialogue and transcript cards generated by the
tutor.

These tokens make fictional character turns feel like a distinct learning
artifact without changing the global site theme.

### Code and Markdown Tokens

Use `--mf-code-*` and `--mf-blockquote` only for rich text rendered inside tutor
messages:

- inline code
- code blocks
- blockquotes
- markdown tables

Do not use these tokens for app navigation, forms, buttons, or legal/settings
pages.

## Neutral Surfaces

Some neutral values remain local in CSS for layout surfaces:

- white and near-white gradients
- transparent black shadows
- subtle neutral borders

These should be used sparingly. If a neutral value becomes repeated or
meaningful, promote it to a token.

For app surfaces outside the chat, prefer Bootstrap variables:

- `--bs-body-bg`
- `--bs-body-color`
- `--bs-secondary-color`
- `--bs-border-color`
- `--bs-card-bg`
- `--bs-primary`
- `--bs-primary-bg-subtle`
- `--bs-primary-text-emphasis`

## CSS Organization

Current CSS entry point:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/client/styles/app.css`

Important style files:

- `base.css`: global Bootstrap aliases and Mister F custom tokens
- `app-shell.css`: app shell, sidebar, modals, dropdowns
- `composer.css`: tutor composer and context meter
- `chat-content.css`: tutor message content and exercise block visuals
- `chatrooms.css`: chat room thread visuals
- `responsive.css`: responsive layout adjustments
- `auth.css`: intentionally minimal; auth pages should use Bootstrap

Keep app-level UI outside `chat-content.css` whenever possible. That file is for
tutor message content and practice blocks.

## Practical Rules

Before adding a color:

1. If the element is a button, link, form, menu, alert, badge, or page card, use
   Bootstrap.
2. If the element is a practice block highlight, exercise state, dialogue
   artifact, or tutor message rich-text detail, use an existing `--mf-*` token.
3. If no token fits, add a semantic `--mf-*` token in `base.css` before using the
   color.
4. Do not introduce one-off hex colors in component CSS unless it is a temporary
   spike that will be immediately replaced.

## Review Checklist

When reviewing UI changes, check:

- Buttons use `btn...` classes and are not recolored by custom CSS.
- Links use Bootstrap link styling unless they are explicitly converted into a
  Bootstrap button.
- No selector globally recolors links inside `.message-bubble`.
- New custom colors appear as `--mf-*` tokens in `base.css`.
- `chat-content.css` colors are only for tutor/practice content.
- Non-chat pages use Bootstrap and Bootswatch `Flatly` primitives.
