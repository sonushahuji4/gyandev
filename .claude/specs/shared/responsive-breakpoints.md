Replace the contents of .claude/specs/shared/responsive-breakpoints.md with this exact content:

---
title: GyanDev — Responsive Breakpoints
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
applies_to: all pages
---

# Responsive Breakpoints

This spec defines how GyanDev adapts across screen sizes. Every page and component must follow these rules. Mobile-first approach: start with mobile, layer on features for larger screens.

## 1. Breakpoint Scale (Tailwind Defaults)

| Breakpoint | Min width | Device target | Usage |
|---|---|---|---|
| (default) | 0px | Mobile portrait | Base styles, no prefix |
| `sm` | 640px | Mobile landscape / small tablet | `sm:` prefix |
| `md` | 768px | Tablet portrait | `md:` prefix |
| `lg` | 1024px | Tablet landscape / small laptop | `lg:` prefix |
| `xl` | 1280px | Desktop | `xl:` prefix |
| `2xl` | 1536px | Large desktop | `2xl:` prefix |

**Why Tailwind defaults**: No custom config = less to maintain, matches what every developer knows.

## 2. Mobile-First Philosophy

All CSS starts with mobile styles. Larger screens add enhancements.

### ✅ Correct pattern
```html
<!-- Mobile: full width, stacked. Desktop: side-by-side -->
<div class="flex flex-col lg:flex-row gap-4">
  <aside class="w-full lg:w-64">Sidebar</aside>
  <main class="flex-1">Content</main>
</div>
```

### ❌ Wrong pattern (desktop-first)
```html
<!-- Desktop default, then override for mobile -->
<div class="flex flex-row lg:flex-col"> <!-- backwards -->
```

## 3. Layout Behavior by Breakpoint

### Top Navigation
| Breakpoint | Behavior |
|---|---|
| Default (< 768px) | Hamburger icon, logo, theme toggle. Nav links in slide-in drawer. |
| `md` (768px+) | Full horizontal nav visible. Logo + links + search + theme + GitHub. |
| `lg+` | Same as md, with more breathing room. |

### Left Sidebar (chapter tree)
| Breakpoint | Behavior |
|---|---|
| Default | Hidden. Accessible via hamburger → drawer from left. |
| `lg` (1024px+) | Visible as fixed sidebar, 260px wide. |
| `xl+` | Same as lg. |

### Right TOC (on-page navigation)
| Breakpoint | Behavior |
|---|---|
| Default | Hidden. Accessible via "On this page ▾" pill → bottom sheet. |
| `lg` | Still hidden (prioritize left sidebar). |
| `xl` (1280px+) | Visible as fixed right rail, 220px wide. |

### Main Content Column
| Breakpoint | Width | Padding |
|---|---|---|
| Default | 100% | 16px |
| `sm` | 100% | 20px |
| `md` | max 720px, centered | 24px |
| `lg` | max 720px, between sidebars | 32px |
| `xl+` | max 720px, both sidebars visible | 32px |

### Course Grid (home + all-courses)
| Breakpoint | Columns |
|---|---|
| Default | 1 column |
| `sm` | 1 column |
| `md` | 2 columns |
| `lg+` | 3 columns |

### Chapter List Rows
Always 1 column. Only spacing and typography change:
| Breakpoint | Row spacing | Title size |
|---|---|---|
| Default | 12px gap | 16px |
| `md+` | 16px gap | 18px |

## 4. Touch Target Requirements

Mobile interfaces must respect finger-friendly sizing.

### Minimum sizes
- **Tap targets**: 44 × 44px minimum (Apple HIG standard)
- **Navigation rows**: 48px height
- **Buttons**: 44px height, 16px horizontal padding
- **Icons**: 20px minimum (24px preferred)
- **Body text**: 16px minimum on mobile (prevents iOS auto-zoom)

### Spacing between tappable elements
- Minimum 8px between adjacent tap targets
- 12px preferred for dense lists

## 5. Typography Scale

Font sizes adapt across breakpoints using `clamp()` for smooth scaling.

### Headings
| Element | Mobile | Desktop | clamp() formula |
|---|---|---|---|
| H1 | 28px | 40px | `clamp(1.75rem, 4vw, 2.5rem)` |
| H2 | 22px | 32px | `clamp(1.375rem, 3vw, 2rem)` |
| H3 | 18px | 24px | `clamp(1.125rem, 2vw, 1.5rem)` |
| H4 | 16px | 18px | `clamp(1rem, 1.5vw, 1.125rem)` |

### Body
| Breakpoint | Size | Line height |
|---|---|---|
| Default | 16px | 1.6 |
| `md+` | 18px | 1.6 |
| `xl+` | 18px | 1.65 |

### Code blocks
Always 14–15px on mobile (prevents overflow issues), 16px on desktop.

## 6. Spacing Scale by Breakpoint

Section vertical padding:
| Breakpoint | Value |
|---|---|
| Default | 32px |
| `md` | 48px |
| `lg+` | 64px |

Horizontal page padding:
| Breakpoint | Value |
|---|---|
| Default | 16px |
| `sm` | 20px |
| `md` | 24px |
| `lg+` | 32px |

## 7. Viewport Meta Tag

Required on every page. Must be exactly:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

Do NOT include:
- `maximum-scale` — blocks accessibility zoom (WCAG violation)
- `user-scalable=no` — same reason
- `minimum-scale` — unnecessary

## 8. Dynamic Viewport Units

Use modern viewport units for full-height elements:

| Unit | Purpose |
|---|---|
| `100dvh` | Dynamic viewport height — accounts for mobile browser UI |
| `100svh` | Small viewport height — always excludes browser UI |
| `100lvh` | Large viewport height — ignores browser UI |

**Use `100dvh` for modals, drawers, full-screen overlays.**
Avoid `100vh` — it breaks on mobile Safari when address bar shows/hides.

## 9. Mobile-Specific Patterns

### Drawer (Left Sidebar on Mobile)
- Slides in from left
- Backdrop overlay (50% black) closes on tap
- Width: 280px (or 85% of viewport, whichever is smaller)
- Max height: `100dvh`
- Traps focus when open
- Returns focus to trigger button when closed
- Smooth transition: 200ms ease-out

### Bottom Sheet (TOC on Mobile)
- Triggered by "On this page ▾" pill
- Slides up from bottom
- Max height: 60% of viewport
- Has drag handle (affordance for close)
- Dismissible by swipe down or backdrop tap

### Full-Screen Search
- Triggered by search icon in top nav
- Takes entire viewport (100dvh)
- Auto-focuses input
- Escape or X closes and restores focus

## 10. Image Handling

### Responsive images
Use `<picture>` or `srcset` for all content images:

```html
<img
  src="/img/hero-800.webp"
  srcset="
    /img/hero-400.webp 400w,
    /img/hero-800.webp 800w,
    /img/hero-1600.webp 1600w
  "
  sizes="(max-width: 768px) 100vw, 800px"
  alt="…"
  width="800"
  height="450"
  loading="lazy"
>
```

### Rules
- Always specify `width` and `height` (prevents CLS)
- Use `loading="lazy"` below the fold
- Use `fetchpriority="high"` on LCP image
- Serve AVIF or WebP with JPEG fallback

## 11. Code Block Handling

Code blocks need special care on mobile (horizontal overflow).

```css
pre {
  overflow-x: auto;          /* horizontal scroll within block */
  overscroll-behavior-x: contain;  /* don't scroll page */
  -webkit-overflow-scrolling: touch;
  font-size: 14px;           /* smaller on mobile */
}

@media (min-width: 768px) {
  pre { font-size: 15px; }
}
```

### Mobile-specific
- Show scrollbar always (don't hide)
- Add `→` fade indicator on right edge if content overflows
- Copy button stays in top-right corner (doesn't scroll with code)

## 12. Table Handling

Tables on mobile are challenging. Two strategies:

### Strategy A: Horizontal scroll (default)
```html
<div class="overflow-x-auto">
  <table>…</table>
</div>
```

### Strategy B: Stacked on mobile
For small comparison tables, collapse to cards on mobile using CSS grid:
```css
@media (max-width: 767px) {
  table, thead, tbody, tr, td, th { display: block; }
  /* plus row labels via data attributes */
}
```

Use Strategy B sparingly — only for 2–3 column comparison tables.

## 13. Gestures

### Supported
- Tap / click
- Swipe (drawer dismiss, bottom sheet dismiss)
- Pinch-to-zoom (accessibility — always allowed)

### Not supported
- Long-press menus (no context menus)
- Multi-finger gestures
- Swipe-to-delete (dangerous without confirmation)

### Gesture alternatives
Every gesture has a button fallback. Example:
- Swipe drawer closed ✅
- Also: X button or backdrop tap ✅

## 14. Print Styles

See `shared/accessibility.md` and `shared/performance.md` for detail. Summary:

```css
@media print {
  nav, aside, .theme-toggle, .comments { display: none; }
  main { max-width: 100%; }
  a::after { content: " (" attr(href) ")"; }  /* show URLs */
}
```

## 15. Testing Checklist

Before shipping any page:
- [ ] Tested on 375px width (iPhone SE) — smallest common viewport
- [ ] Tested on 768px width (iPad portrait)
- [ ] Tested on 1024px width (iPad landscape)
- [ ] Tested on 1280px width (small laptop)
- [ ] Tested on 1920px width (desktop)
- [ ] Pinch-zoom to 200% — content still readable
- [ ] Rotate device — layout adapts without breaking
- [ ] Keyboard-only navigation works at all sizes
- [ ] No horizontal scroll on body (except within code blocks)

## 16. Success Criteria

This spec is complete when:
- [ ] All pages follow mobile-first patterns
- [ ] Tailwind breakpoints used consistently (no custom values)
- [ ] Touch targets audited (44px minimum)
- [ ] Typography scales smoothly across breakpoints
- [ ] Drawer and bottom sheet patterns implemented
- [ ] Tested on real devices (not just DevTools emulation)

## 17. Open Questions

- [ ] Should we support `3xl` (1920px+) for ultra-wide? — defer
- [ ] Do we need landscape-specific mobile layouts? — probably no
- [ ] Should code block font size be user-adjustable? — Phase 2 feature

## 18. References

- Spec: [shared/website-overview.md](website-overview.md)
- Spec: [shared/accessibility.md](accessibility.md)
- Plan: [plans/shared/responsive-breakpoints.md](../../plans/shared/responsive-breakpoints.md) *(to be created)*
- Tailwind breakpoint docs: https://tailwindcss.com/docs/responsive-design
- Apple Human Interface Guidelines (touch targets): https://developer.apple.com/design/human-interface-guidelines/layout
- MDN dynamic viewport units: https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-percentage_lengths

After saving, do NOT commit. Do NOT create any other files. Just overwrite this file and confirm.