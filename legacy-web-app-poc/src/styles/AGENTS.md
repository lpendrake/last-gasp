# `src/styles/` — Stylesheets

Global CSS, one file per slice plus a tokens file. No CSS-in-JS, no
CSS modules, no preprocessors.

## Layout

```
styles/
  tokens.css            # css custom properties (colours, spacing, kind hues)
  base.css              # element-level resets and defaults
  app.css               # shell + view-switcher
  timeline.css
  toolbar.css
  filters.css
  event-card.css
  event-modal.css
  editor.css            # event editor modal
  peek.css
  search.css
  notes/
    index.css           # @imports the parts in cascade order
    sidebar.css         # tree, filter input, new-folder, drag-drop
    tabs.css            # tabs bar, breadcrumbs, save status
    editor-surface.css  # contentEditable host, live/source/split modes
    markdown.css        # headings, bold, italic, code, images, links
    link-picker.css
    quick-add.css
    toast.css
    confirm.css
```

## Cascade rules

- `tokens.css` defines `:root` custom properties. Imported first.
- `base.css` after tokens. Element selectors only (`html`, `body`,
  `button`, etc.). No classes.
- Per-slice files use class selectors scoped by a slice prefix
  (`.timeline-…`, `.notes-…`, `.peek-…`). Avoid global classes.
- `notes/index.css` controls the order within the notes split. If
  cascade matters, document it in the index file with comments above
  each `@import`.
- The composition root in `bootstrap/` imports the top-level files;
  React components don't import CSS directly.

## Add a style

- A new component-scoped style → its slice's CSS file.
- A new colour, spacing, or hue → `tokens.css`. Don't hardcode hex.
- A new global element rule → `base.css`. Use sparingly.

## Conventions

- Use `--token` names for any value used in more than one place.
- Class names: `kebab-case`, slice-prefixed.
- Avoid `!important`. If you reach for it, the cascade is wrong.

## Don't

- Don't introduce `styled-components` or CSS modules without a
  conversation. Right now the CSS is plain and that's a feature.
- Don't put one slice's styles in another slice's file. Notes editor
  styles do not belong in `editor.css` (which is the event editor).
