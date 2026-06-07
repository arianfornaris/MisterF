---
name: bootstrap-tabs-conventions
description: Use when creating, editing, or reviewing tabs in the Mister F project, especially EJS views with `nav-pills`, tabbed summaries, progress pages, conversation tabs, or any UI that switches between page sections.
---

# Bootstrap Tabs Conventions

Use standard Bootstrap pills for tabbed navigation in Mister F. Tabs should look
consistent across the app and should not create a second visual system.

## Rules

- Default to Bootstrap's plain pills pattern:
  `ul.nav.nav-pills > li.nav-item > a.nav-link`.
- Use normal links with `href` for server-rendered tab pages so the active tab is
  represented in the URL, for example `/progress?tab=vocabulary`.
- Use `button` tabs with `data-bs-toggle="tab"` only for purely client-side tab
  panes that do not need URL state.
- Do not wrap tabs in custom gradient, shadow, border, or color treatments.
- Do not add custom CSS for tab colors, active states, shadows, radii, or
  horizontal rules unless the user explicitly asks for a different tab design.
- Use `nav-pills` instead of `nav-tabs` for Mister F tabbed sections. The app
  standard is pills because they avoid horizontal divider lines cutting through
  content panels.
- Do not use `nav-tabs` for new or updated tab controls unless the user
  explicitly asks for tab-line styling.
- Keep tab labels short and content-oriented, such as `General`,
  `Vocabulario`, `Bitácora`, `Conversación`, or `Resumen`.
- Keep ordering consistent for progress-style tabs: `General`, `Vocabulario`,
  `Bitácora`.
- For conversation summary tabs, match the progress-page pattern: plain
  Bootstrap `nav-pills`, no custom wrapper style.
- Preserve Bootstrap focus and active states; do not override them with custom
  colors from older app themes.

## EJS Pattern

```ejs
<ul class="nav nav-pills" role="tablist">
  <li class="nav-item" role="presentation">
    <a
      class="nav-link <%= activeTab === 'general' ? 'active' : '' %>"
      href="/progress?tab=general"
      role="tab"
      aria-selected="<%= activeTab === 'general' ? 'true' : 'false' %>"
    >
      General
    </a>
  </li>
</ul>
```

## Review Checklist

- Tabs use Bootstrap classes only: `nav`, `nav-pills`, `nav-item`, `nav-link`,
  and `active`.
- There is no tab-specific custom CSS unless explicitly requested.
- Server-rendered tabs use links and preserve URL state.
- Active state is computed from route/query state, not client-only DOM state.
- Tab content may have custom app styling, but tab controls themselves stay
  Bootstrap-native.
