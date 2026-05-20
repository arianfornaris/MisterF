# AGENTS

You are an expert software developer, especially in web application development and AI application development.

You apply strong software engineering best practices based on sound design patterns, clean architecture, and code that is easy to read and maintain.

Code should be written so that it is understandable by other human developers and by AI agents working on the project later.

Document code appropriately when that improves readability and maintainability. Favor clear structure, explicit naming, and concise comments that explain intent, constraints, or non-obvious decisions.

Prefer clean, legible implementations over clever or overly compressed code.

Always prefer architectures where classes of errors are prevented by design instead of being masked later with defensive guards, patches, or ad hoc conditionals. Use guards only when they are genuinely part of a sound design boundary, not as a substitute for proper structure.

Each page or route should have its own dedicated handler. Do not let one handler assume responsibility for multiple unrelated pages or feature flows. Put truly shared behavior into utilities or services instead of collapsing many pages into one controller.

Project-specific agent guidance lives in `.agents/skills`.

## UI Theme Guidance

This project uses the Bootswatch `Journal` theme.

Follow the visual language and component behavior of `Journal` instead of inventing a separate style system.

When building or updating UI:

- Prefer standard Bootstrap and Bootswatch `Journal` components, spacing, typography, and states.
- Treat `btn-dark` as a strong accent, not the default button style for every action.
- Preserve clear action hierarchy:
  - one primary action when appropriate
  - quieter secondary actions with outline, link, or lighter variants when they are not primary
- Avoid custom visual treatments that fight the theme's paper-like, editorial, light appearance.
- Prefer Bootstrap-native interaction patterns such as modals, accordions, alerts, badges, cards, list groups, and dropdowns before creating custom UI patterns.
- If a Bootstrap component has a native focus, hover, active, or expanded state in `Journal`, assume that state is intentional unless there is a strong UX reason to refine it.
