# `src/renderer/components/` — Shared UI Components

Shared, view-agnostic components used across the renderer. The most important pattern here is the
footer portal system.

## Footer portal pattern

The footer bar is constant across all views. Users see it at all times and learn to look there for
context-sensitive action buttons. Each view injects its own buttons without the footer component
knowing anything about them.

### How it works

1. `footer.tsx` renders four **empty slot divs** with stable DOM IDs:
   - `footer-slot-far-left` — sits immediately to the right of the view-switcher menu; use for
     view-level navigation or mode toggles that need to be close to the label.
   - `footer-slot-left` — left column of the three-column grid (right-aligned content).
   - `footer-slot-center` — centre column of the three-column grid (centred content).
   - `footer-slot-right` — right column of the three-column grid (left-aligned content).

2. A view renders `<FooterPortal slot="...">` anywhere inside its component tree. On mount,
   `FooterPortal` locates the matching slot div by ID and uses React's `createPortal` to render its
   children there. On unmount the portal is removed automatically — no cleanup code required.

### Layout diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  ☰ Timeline  │ far-left │       left       │   center   │       right       │        │
└──────────────────────────────────────────────────────────────────────────────────────┘
               ^           ^──────────────── three-column grid ──────────────^
```

### Adding footer buttons to a new view

Render `<FooterPortal>` anywhere inside your view component — typically at the end of the JSX:

```tsx
import { FooterPortal } from '../../components/footer-portal';
import { FooterButton } from '../../components/footer-button';

export function MyView() {
  return (
    <>
      {/* ...view content... */}

      <FooterPortal slot="right">
        <FooterButton onClick={handleSomething}>Do thing</FooterButton>
      </FooterPortal>

      <FooterPortal slot="center">
        <FooterButton variant="primary" onClick={handleCreate}>+ Add</FooterButton>
      </FooterPortal>
    </>
  );
}
```

Content appears when the view mounts and disappears when it unmounts. No wiring in `footer.tsx`
or the app shell is needed.

## FooterButton

`FooterButton` provides consistent button styling for footer content.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `onClick` | `() => void` | required | |
| `variant` | `'default' \| 'primary' \| 'active'` | `'default'` | `primary` = warm accent fill; `active` = gold border, indicates a toggle is on |
| `title` | `string` | — | Tooltip text |
| `children` | `ReactNode` | required | Label or icon |

## Key files

| File | Role |
|---|---|
| `footer.tsx` | Renders the footer bar and the four empty slot divs. Owns the view-switcher menu. |
| `footer-portal.tsx` | `FooterPortal` — `createPortal` wrapper. Waits for DOM mount before rendering. |
| `footer-button.tsx` | `FooterButton` — styled button with `default`, `primary`, `active` variants. |
| `footer-button.css` | CSS for `.footer-btn` and its variant modifiers (theme vars only, no hex). |

## Don't

- Don't add view-specific logic or imports to `footer.tsx`. The footer knows nothing about views;
  views inject into it.
- Don't render a `FooterPortal` outside a component tree that is mounted inside the app shell
  (i.e. outside a rendered view). `FooterPortal` guards against this with a `mounted` state flag —
  it renders `null` on the first paint — but if the target slot div is absent the portal is also
  silently dropped.
- Don't use more than one `FooterPortal` per slot from the same view. Multiple portals targeting
  the same slot will stack their children inside that div, which may be intentional for composing
  buttons but can cause layout surprises.
- Don't hardcode colours in footer button content. Use `var(--theme-*)` CSS variables or
  `ThemeProvider.get()`.
