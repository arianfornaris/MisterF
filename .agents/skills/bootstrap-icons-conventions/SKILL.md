---
name: bootstrap-icons-conventions
description: Use when adding, editing, or reviewing icons in Mister F UI, including EJS views, client-side DOM templates, buttons, dropdowns, modals, toolbars, third-party widgets, and icon-only controls. Prefer Bootstrap Icons and prevent Font Awesome or ad hoc icon systems from entering the project.
---

# Bootstrap Icons Conventions

Mister F uses Bootstrap Icons as its UI icon system. Keep icons aligned with Bootstrap, Bootswatch Flatly, and the app's existing accessibility patterns.

## Rules

- Use Bootstrap Icons classes in the form `bi bi-*` for UI icons.
- Do not introduce Font Awesome classes such as `fa`, `fas`, `far`, or `fa-*`.
- Do not add icon CDN links, external icon fonts, emoji icons, or one-off inline SVGs unless the user explicitly asks for a custom mark that Bootstrap Icons cannot cover.
- Confirm the page includes Bootstrap Icons before adding `bi` classes. App-shell pages already include them through `partials/app-shell-open.ejs`; standalone pages should pass `includeBootstrapIcons: true` to `partials/document-head`.
- For icon-only buttons, include an accessible name with `aria-label` and usually `title`.
- For icon plus text controls, mark the icon as decorative with `aria-hidden="true"` and use Bootstrap spacing utilities such as `me-1` or `me-2`.
- Prefer Bootstrap button, dropdown, modal, list-group, nav, and toolbar patterns before creating custom icon containers.

## Client Templates

When creating icons with JavaScript, use static Bootstrap Icon markup:

```js
button.innerHTML = '<i class="bi bi-send" aria-hidden="true"></i>';
button.setAttribute('aria-label', 'Enviar');
button.title = 'Enviar';
```

Do not interpolate untrusted values into `innerHTML`. If the icon name is dynamic, validate it against a small allowlist first.

## Third-Party Widgets

When a third-party widget defaults to another icon library, adapt it back to Bootstrap Icons.

- Disable automatic external icon loading when the library supports it, for example `autoDownloadFontAwesome: false`.
- Prefer keeping the widget's native behavior and replacing only the visual icon markup after initialization.
- Verify generated toolbar buttons still have accessible labels and working actions.

For EasyMDE specifically, do not rely on `iconClassMap` for Bootstrap Icons. EasyMDE's toolbar logic is Font Awesome-oriented, so initialize the default toolbar actions and then replace each button's contents with Bootstrap Icon markup.
