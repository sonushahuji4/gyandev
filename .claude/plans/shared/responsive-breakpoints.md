---
title: Responsive Breakpoints — Implementation Plan
status: draft
spec: .claude/specs/shared/responsive-breakpoints.md
created: 2026-04-20
session: 2
estimated_effort: 8–10 hours
dependencies:
  - .claude/plans/00-infrastructure.md
  - .claude/plans/RESEARCH.md (Topic 5)
  - .claude/plans/shared/routing-and-urls.md (BaseLayout.astro)
---

# Implementation Plan: Responsive Breakpoints

## 1. Overview

This plan sets up Tailwind CSS v4 with a CSS-first design-token system, implements the mobile-first layout shell (drawer + bottom sheet patterns + main content column), and delivers the typography scale that clamps smoothly between breakpoints. After this plan lands, every subsequent component and page can assume the token system, breakpoint scale, and responsive utilities are in place. The deliverables are concrete: one `global.css` file, four layout-chrome components (TopNav, LeftSidebar, RightTOC, Drawer + BottomSheet), and a small set of utility classes for touch targets and code-block overflow.

## 2. Spec Reference

See `.claude/specs/shared/responsive-breakpoints.md`. Load-bearing requirements:

- §1 Use Tailwind default breakpoints: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.
- §2 Mobile-first. Base styles = mobile; `md:` / `lg:` layer on enhancements.
- §3 Layout behavior: top nav flips at `md`; left sidebar appears at `lg` (260px); right TOC appears at `xl` (220px); main content column stays ≤ 720px.
- §4 Touch targets: 44×44px minimum; 48px nav rows; 16px min body font on mobile.
- §5 Typography: `clamp()` formulas for H1–H4 + body.
- §6 Section + page padding scale by breakpoint.
- §7 Viewport meta tag must NOT include `maximum-scale` or `user-scalable=no`.
- §8 Use `100dvh` for full-height overlays (modals, drawers).
- §9 Drawer + bottom sheet + full-screen search patterns.
- §10 Responsive images (`srcset`, `width`/`height`, `loading="lazy"`, `fetchpriority="high"` on LCP).
- §11 Code block overflow handling.
- §12 Table handling (horizontal scroll default; stacked for 2–3 col comparisons only).

## 3. Technical Approach

**3.1 Tailwind v4 CSS-first config.** Per RESEARCH.md Topic 5, v4 uses `@import "tailwindcss"` + `@theme` + `@custom-variant` directly in CSS. No `tailwind.config.js`, no PostCSS config. The `@tailwindcss/vite` plugin is already installed and wired in `astro.config.mjs` — we do not add `@astrojs/tailwind`.

**3.2 Semantic design tokens.** We define tokens in CSS semantic names (`--color-bg`, `--color-text`, `--color-accent`) rather than palette names (`--color-indigo-500`). This lets us swap palettes under `.dark` in one block without rewriting every utility reference. Tailwind v4 namespaces (`--color-*`, `--font-*`, `--spacing-*`, `--breakpoint-*`) auto-generate utilities — so `bg-bg` and `text-text` and `text-text-muted` work by design.

**3.3 Dual-sink dark mode.** Per RESEARCH.md Topic 8, the theme toggle sets BOTH `html.classList` (for Tailwind) and `html.dataset.theme` (for astro-mermaid). We define `@custom-variant dark (&:where(.dark, .dark *))` so Tailwind dark-utility syntax still works (`dark:bg-...` utilities reach the tokens through variable lookup anyway, but having the variant explicit helps for component-local dark overrides).

**3.4 Pre-paint theme script.** A single inline `<script is:inline>` in `BaseLayout.astro`'s `<head>` runs synchronously before paint, reading `localStorage.theme` (`'dark' | 'light' | 'system'`) and setting the class + attribute. This prevents FOUC — any `client:*` directive runs post-parse (RESEARCH.md Topic 4).

**3.5 Typography via `clamp()`.** Per spec §5, headings and body scale smoothly across breakpoints using CSS `clamp(min, preferred, max)`. We encode these as CSS custom properties in `@theme` so they're also reusable in components and MDX-rendered prose.

**3.6 Overlay components.** Drawer (left-slide), Bottom Sheet (bottom-slide), and Full-Screen Search use `<dialog>` elements with the `modal` invocation pattern. `<dialog>` gives us: native focus trap, built-in backdrop, `Esc`-to-close, and correct modal semantics without hand-rolled ARIA. Falls back gracefully in older browsers (we don't target them).

**3.7 Main column as a CSS Grid.** The chapter page shell is a 3-column grid at `xl`:
```
  [left-sidebar 260px] [main max-720px] [right-toc 220px]
```
At `lg`, the right-TOC column collapses (width 0, content moves to bottom sheet). At `md` and below, the left sidebar also collapses (content moves to drawer). This is implemented with `grid-template-columns` + `display: none` — not `flex` — because grid gives us cleaner gutter control and `auto` tracks collapse cleanly.

## 4. File Structure

```
src/
  styles/
    global.css                                      [create — @import, @theme, @custom-variant, base, tokens]
    prose.css                                       [create — .prose typography rules for MDX content]
    code.css                                        [create — Shiki + rehype-pretty-code CSS variable swap]
  layouts/
    BaseLayout.astro                                [modify — add viewport meta, theme pre-paint script, global.css import]
  components/
    layout/
      TopNav.astro                                  [create — shared global header]
      LeftSidebar.astro                             [create — chapter tree, ≥lg]
      RightTOC.astro                                [create — on-page nav, ≥xl]
      Drawer.astro                                  [create — mobile left slide-in]
      BottomSheet.astro                             [create — mobile TOC]
      SearchModal.astro                             [create — shell only; Pagefind wires in performance.md/seo.md]
      PageShell.astro                               [create — wraps TopNav + grid + main; used by every page]
      ChapterShell.astro                            [create — TopNav + left sidebar + main + right TOC + tab bar]
    ui/
      ThemeToggle.astro                             [create — vanilla script, no island]
      TouchTarget.astro                             [create — helper wrapper ensuring 44×44]
  scripts/
    theme-init.ts                                   [create — inline pre-paint theme script source]
```

No changes in this plan to `astro.config.mjs` (Tailwind is already wired via `@tailwindcss/vite`).

## 5. Dependencies

**External (already installed):**
- `tailwindcss@^4.2.2`, `@tailwindcss/vite@^4.2.2` — per RESEARCH.md Topic 5, this is the only Tailwind plugin.
- `astro@^6.1.8`.

**External (to add):** none.

**Internal:**
- `src/lib/storage.ts` — consumed by `ThemeToggle.astro` for theme persistence. Defined in `.claude/plans/00-infrastructure.md` §10 and implemented in a later session (Session 3 likely, or carved into a helper during this plan's execution).

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — `BaseLayout.astro` exists; we extend it.
- `.claude/plans/shared/accessibility.md` — drawer/modal focus behavior, reduced motion, target-size rules.
- `.claude/plans/shared/performance.md` — font loading and critical CSS inlining live there; this plan defines the structure.

## 6. Implementation Steps (Ordered)

1. **Create `src/styles/global.css`** with the skeleton:
   ```css
   @import "tailwindcss";

   @custom-variant dark (&:where(.dark, .dark *));

   @theme {
     /* Colors — semantic, light mode */
     --color-bg: #faf7f0;
     --color-surface: #ffffff;
     --color-text: #17150f;
     --color-text-muted: #5b5649;
     --color-border: #e5ddc8;
     --color-accent: #c2410c;
     --color-accent-fg: #ffffff;
     /* Fonts */
     --font-sans: 'Inter', system-ui, sans-serif;
     --font-serif: 'Source Serif 4', Georgia, serif;
     --font-mono: 'JetBrains Mono', ui-monospace, monospace;
     /* Typography scale (clamp formulas per spec §5) */
     --text-h1: clamp(1.75rem, 4vw, 2.5rem);
     --text-h2: clamp(1.375rem, 3vw, 2rem);
     --text-h3: clamp(1.125rem, 2vw, 1.5rem);
     --text-h4: clamp(1rem, 1.5vw, 1.125rem);
     /* Layout */
     --content-max: 45rem;   /* 720px */
     --sidebar-w: 16.25rem;  /* 260px */
     --toc-w: 13.75rem;      /* 220px */
     --nav-h: 3.5rem;        /* 56px sticky header */
   }

   @layer base {
     html.dark {
       --color-bg: #131210;
       --color-surface: #1b1914;
       --color-text: #ece7d9;
       --color-text-muted: #a19b87;
       --color-border: #322d22;
       --color-accent: #fb923c;
       --color-accent-fg: #1a1208;
     }

     html { scroll-padding-top: var(--nav-h); }
     body {
       background: var(--color-bg);
       color: var(--color-text);
       font-family: var(--font-sans);
       font-size: 16px;
       line-height: 1.6;
     }
     @media (min-width: 768px) { body { font-size: 18px; } }

     :focus-visible {
       outline: 2px solid var(--color-accent);
       outline-offset: 2px;
       border-radius: 4px;
     }
     :focus:not(:focus-visible) { outline: none; }

     @media (prefers-reduced-motion: reduce) {
       *, *::before, *::after {
         animation-duration: 0.01ms !important;
         transition-duration: 0.01ms !important;
         scroll-behavior: auto !important;
       }
     }
   }
   ```
   - Import from `BaseLayout.astro`: `import '../styles/global.css';`.
   - Done when: a page renders with the expected background and toggling `.dark` on `<html>` in DevTools switches palette instantly.

2. **Create `src/scripts/theme-init.ts`** exporting the raw string of the pre-paint script. (We source it from a string so it can be emitted via `is:inline` and also unit-tested independently.)
   ```ts
   export const THEME_INIT = `(() => {
     const stored = localStorage.getItem('gyandev:theme');
     const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
     const isDark = stored ? stored === 'dark' : prefers;
     const root = document.documentElement;
     root.classList.toggle('dark', isDark);
     root.setAttribute('data-theme', isDark ? 'dark' : 'light');
   })();`;
   ```
   - `BaseLayout.astro` emits it: `<script is:inline set:html={THEME_INIT} />`.
   - Done when: with `localStorage.setItem('gyandev:theme','dark')`, a hard reload shows dark colors on first paint — no flash.

3. **Modify `src/layouts/BaseLayout.astro`** — add (a) viewport meta tag per spec §7, (b) theme pre-paint script per Step 2, (c) `<link rel="stylesheet">` / `@import` of `global.css` (via Astro's CSS pipeline — just import from the frontmatter), (d) `<html lang="en" data-theme="light">` (data-theme set by script on paint).
   - Viewport: `<meta name="viewport" content="width=device-width, initial-scale=1">`. Do NOT add `maximum-scale` or `user-scalable=no` (WCAG violation per spec §7).
   - Done when: View Source on any page shows the exact viewport string.

4. **Create `src/components/ui/ThemeToggle.astro`** — no island. Renders a `<button aria-label="Toggle theme" aria-pressed={...}>` and a trailing `<script>` that:
   - Reads current state from `documentElement.dataset.theme`.
   - Sets `aria-pressed` on initial mount.
   - On click: flip class + attribute + write `localStorage.setItem('gyandev:theme', ...)` + dispatch a `CustomEvent('theme-change', { detail: { theme } })` so other components (Giscus wrapper, Mermaid wrapper) can react.
   - Done when: click toggles theme without a framework import; Network tab shows no new JS download.

5. **Create `src/components/layout/TopNav.astro`** — sticky header:
   - Default (< md): hamburger button (opens drawer), logo, theme toggle.
   - `md+`: full nav — logo, primary links (Courses, About), search-trigger button, theme toggle, GitHub link.
   - Height: `var(--nav-h)` (56px). Position: `sticky top-0 z-40`.
   - Uses `grid` with `md:hidden` / `hidden md:grid` for variant switching — not JS toggling.
   - Props: `{ currentPath?: string }` for `aria-current` on active links.
   - Done when: at 375px width, hamburger + logo + theme toggle visible; at 768px+, full nav visible; at any width, header stays at top on scroll.

6. **Create `src/components/layout/Drawer.astro`** — mobile left drawer using native `<dialog>`:
   - Width: `min(280px, 85vw)`. Max height: `100dvh`. Slides in from `translateX(-100%)` to `0` over 200ms ease-out.
   - Backdrop via `::backdrop` pseudo-element (native dialog).
   - Dismissal: X button, backdrop click (built-in for `<dialog>`), Esc (built-in), focus trap (built-in).
   - Slot: main drawer contents (usually the nav tree + theme toggle).
   - Exports a `data-drawer-id` attribute; trigger button uses `document.getElementById(id)?.showModal()`.
   - Done when: hamburger click slides drawer in from left; Esc closes; Tab key never escapes to background content.

7. **Create `src/components/layout/BottomSheet.astro`** — same pattern as Drawer but slides from bottom:
   - Max height: `60dvh`. Slides `translateY(100%)` → `0`.
   - Used by right-TOC on `<xl`. Dismissal: X button, drag-handle visual affordance (no actual drag in Phase 1), backdrop, Esc.
   - Done when: at 1024px width, clicking "On this page ▾" slides sheet up to 60% of viewport.

8. **Create `src/components/layout/SearchModal.astro`** — full-viewport modal shell. This plan delivers only the shell (dialog + dismissal + focus). Pagefind UI mount happens in `.claude/plans/shared/seo.md` / `.claude/plans/shared/performance.md` (search is cross-cutting; component-library plan will own the full wiring).
   - Takes `100dvh × 100vw`. Auto-focuses its input on `show()`.
   - Global keybinding: `⌘K` / `Ctrl+K` / `/` opens it. That handler lives in `.claude/plans/shared/accessibility.md` `src/scripts/keybindings.ts`.
   - Done when: `⌘K` opens a full-screen empty modal with an input; Esc closes and restores focus to the trigger.

9. **Create `src/components/layout/LeftSidebar.astro`** — chapter tree sidebar:
   - `hidden lg:block`. Fixed position, `top: var(--nav-h)`, `height: calc(100dvh - var(--nav-h))`, `width: var(--sidebar-w)`, overflow-y-auto.
   - Props: `{ course: CollectionEntry<'courses'>, chapters: CollectionEntry<'chapters'>[], currentChapterSlug?: string }`.
   - Renders grouped `<nav aria-label="Chapter tree">` with `<details>` per season (if applicable) and `<a aria-current="page">` for the active chapter.
   - Done when: at 1024px+ the sidebar occupies its column; at < 1024 it is not in the DOM visible layer (still render to DOM so mobile drawer can reuse the same markup — see Step 11).

10. **Create `src/components/layout/RightTOC.astro`** — on-page table of contents:
    - `hidden xl:block`. Same fixed-position pattern as LeftSidebar but right side, `width: var(--toc-w)`.
    - Props: `{ headings: MarkdownHeading[] }` (Astro's built-in `headings` export from MDX).
    - Renders a nested `<nav aria-label="On this page">` with `<a href="#slug">`. Active heading highlighted via IntersectionObserver (inline script).
    - Done when: scrolling within a chapter body highlights the corresponding TOC item with no observable jank.

11. **Create `src/components/layout/PageShell.astro`** — generic shell for home, all-courses, about, privacy, terms, 404:
    - `<TopNav />` + `<main id="main"><slot /></main>` + `<Footer />` (footer is a TODO for Session 3 — stub for now).
    - Main content column: `max-w-[var(--content-max)] mx-auto px-4 sm:px-5 md:px-6 lg:px-8`.
    - Done when: static pages render with proper content width at all breakpoints.

12. **Create `src/components/layout/ChapterShell.astro`** — shell for the three chapter routes:
    - CSS Grid:
      ```css
      grid-template-columns: 1fr;
      @media (min-width: 1024px) {
        grid-template-columns: var(--sidebar-w) 1fr;
      }
      @media (min-width: 1280px) {
        grid-template-columns: var(--sidebar-w) 1fr var(--toc-w);
      }
      ```
    - Includes TopNav + LeftSidebar + main (with tab bar + slot) + RightTOC.
    - Wrap the "shell" region (TopNav + tab bar) in `transition:persist="chapter-shell"` per RESEARCH.md Topic 14 and `.claude/plans/shared/routing-and-urls.md` Step 10.
    - Props: `{ course, chapter, activeTab: 'full' | 'revision' | 'flow' }`.
    - Done when: switching tabs leaves the shell visually stable; only the main content region cross-fades.

13. **Create `src/styles/prose.css`** — typography rules applied to `.prose` wrapper that holds rendered MDX:
    - Apply `var(--text-h1..h4)` to `h1..h4` inside `.prose`.
    - Set `max-width: var(--content-max)` on `.prose`.
    - Set `p { margin-block: 1em; }`, `ul/ol { padding-left: 1.5em; }`, link color via `--color-accent`.
    - Tables: wrap in `.prose table { width: 100%; border-collapse: collapse; }` + provide `.prose--scroll-x` wrapper for horizontal-scroll tables per spec §12.
    - Code blocks: see Step 14.
    - Done when: rendered MDX inside `<div class="prose">` matches the spec's visual hierarchy.

14. **Create `src/styles/code.css`** — Shiki + rehype-pretty-code styling:
    - `pre.shiki { overflow-x: auto; overscroll-behavior-x: contain; font-size: 14px; padding: 1em; border-radius: 8px; }` — spec §11.
    - `@media (min-width: 768px) { pre.shiki { font-size: 15px; } }`.
    - Dual-theme swap (RESEARCH.md Topic 9):
      ```css
      html.dark .shiki,
      html.dark .shiki span {
        color: var(--shiki-dark) !important;
        background-color: var(--shiki-dark-bg) !important;
      }
      ```
    - Line highlighting, line IDs (`#add`, `#del`, `#focus`), title bar, copy button positioning — all via attribute selectors per spec.
    - Done when: a sample code fence renders with correct fonts, scroll behavior, and switches both themes via the root class.

15. **Create `src/components/ui/TouchTarget.astro`** — utility wrapper for non-button touch targets:
    - Sets `min-width: 2.75rem; min-height: 2.75rem;` (44px per spec §4).
    - `<TouchTarget><Icon /></TouchTarget>` pattern for icon-only buttons where the visual icon is smaller than 44px.
    - Done when: axe-core reports no "target too small" issues on any page that uses it for icon buttons.

16. **Add device-testing checklist to `docs/CONTRIBUTING.md` or equivalent** — per spec §15, PR authors must test at 375px, 768px, 1024px, 1280px, 1920px widths. This plan does not create the doc; it reserves the checklist text for inclusion wherever it lands.

## 7. Component/Module API Design

### `src/components/layout/TopNav.astro`

```ts
export interface Props {
  currentPath?: string;       // for aria-current="page" matching
  variant?: 'default' | 'chapter'; // chapter shell may hide some nav items
}
```

### `src/components/layout/Drawer.astro`

```ts
export interface Props {
  id: string;                 // used by trigger to call .showModal()
  ariaLabel: string;
  side?: 'left' | 'right';    // default 'left'
}
```

Usage:
```astro
<button aria-controls="main-drawer" aria-expanded="false"
        onclick="document.getElementById('main-drawer').showModal()">
  <MenuIcon /> <span class="sr-only">Open menu</span>
</button>
<Drawer id="main-drawer" ariaLabel="Primary navigation">
  <nav>…</nav>
</Drawer>
```

### `src/components/layout/BottomSheet.astro`

Same shape as `Drawer` with `side: 'bottom'` implied.

### `src/components/layout/LeftSidebar.astro`

```ts
export interface Props {
  course: CollectionEntry<'courses'>;
  chapters: CollectionEntry<'chapters'>[];
  currentChapterId?: string;
}
```

### `src/components/layout/RightTOC.astro`

```ts
export interface Props {
  headings: MarkdownHeading[]; // Astro's { depth, slug, text }[]
  maxDepth?: number;           // default 3 — don't include h4+
}
```

### `src/components/layout/PageShell.astro`

```ts
export interface Props {
  // no props beyond layout composition
}
```

Slot: main page content.

### `src/components/layout/ChapterShell.astro`

```ts
export interface Props {
  course: CollectionEntry<'courses'>;
  chapter: CollectionEntry<'chapters'>;
  activeTab: 'full' | 'revision' | 'flow';
  headings: MarkdownHeading[];
}
```

Slot: main chapter content.

### `src/components/ui/ThemeToggle.astro`

No props. Emits `theme-change` CustomEvent on `document` when toggled.

## 8. Code Patterns

**Pattern: Breakpoint-aware utility classes.** Mobile-first, layer enhancements with `md:` / `lg:` / `xl:`:
```astro
<div class="flex flex-col gap-4 lg:flex-row">
  <aside class="w-full lg:w-64">…</aside>
  <main class="flex-1">…</main>
</div>
```

**Pattern: `100dvh` for full-height overlays.** Never `100vh` (breaks on mobile Safari when the address bar shows/hides — spec §8):
```css
.drawer { max-height: 100dvh; }
```

**Pattern: Native `<dialog>` for modals.**
```html
<dialog id="main-drawer">
  <button onclick="this.closest('dialog').close()">Close</button>
  …
</dialog>
```
Auto-focus trap, `::backdrop`, `Esc`-close are all native. Do NOT hand-roll focus trap.

**Pattern: Semantic tokens in Tailwind utilities.** Use the semantic names; they map to `var(--color-...)`:
```html
<div class="bg-surface text-text border border-border">…</div>
```

**Pattern: Clamp-scaled headings via classes.** Add a `.h1 .h2 .h3 .h4` utility set in `@layer components` that applies the `var(--text-hN)` font-size plus the line-height. Apply to native heading tags; keep content authors free of classes where possible (use `.prose h1 { font-size: var(--text-h1); }` in `prose.css`).

**Pattern: Touch target enforcement.** Any interactive element smaller than 44×44px visual must be wrapped in `<TouchTarget>` or have explicit `min-w-11 min-h-11`:
```astro
<TouchTarget><a href="…"><CloseIcon class="w-5 h-5" /></a></TouchTarget>
```

**Pattern: `prefers-reduced-motion` respect.** Every CSS transition/animation is gated by the global reduced-motion rule in `global.css` — do not write separate `@media (prefers-reduced-motion)` blocks in each component.

## 9. Testing Strategy

**Responsive manual checklist (required for any PR touching layout):**
- [ ] 375px (iPhone SE) — smallest common viewport
- [ ] 768px (iPad portrait)
- [ ] 1024px (iPad landscape / small laptop)
- [ ] 1280px (desktop)
- [ ] 1920px (large desktop)
- [ ] Pinch-zoom to 200% — content reflows, no horizontal page scroll
- [ ] Rotate device (emulation) — layout adapts
- [ ] DevTools responsive mode with touch cursor — all interactive elements tappable

**Automated:**
- Add a Playwright smoke test (later plan) with screenshots at the five breakpoints. This plan only wires the harness; actual test creation is Session 3+.

**Theme + motion:**
- Toggle `html.dark` in DevTools — palette switches without page reload.
- Set system to reduced motion — drawer and bottom-sheet transitions disabled.

**Pre-paint:**
- `localStorage.setItem('gyandev:theme','dark')`; hard reload — no flash of light mode.

**Touch targets:**
- axe-core reports no target-size violations (this check is wired in `.claude/plans/shared/accessibility.md`).

## 10. Rollout Plan

1. Steps 1–3: `global.css` + theme pre-paint + viewport meta. (This alone unblocks styling.)
2. Steps 4, 13, 14: ThemeToggle + prose + code styles.
3. Steps 5, 6, 7, 8: TopNav + Drawer + BottomSheet + SearchModal shell. (Header works; modals work in isolation.)
4. Steps 9, 10: LeftSidebar + RightTOC. (Real content rendering unblocked.)
5. Steps 11, 12: PageShell + ChapterShell. (Wires everything together.)
6. Step 15: TouchTarget utility. (Last because enforcement needs real components to enforce on.)
7. Step 16: Docs checklist. (Documentation-only.)

## 11. Risks and Mitigations

- **Risk: Native `<dialog>` behavior differs subtly across browsers (Safari focus-trap edge cases).**
  - Likelihood: medium
  - Impact: medium (a11y regression)
  - Mitigation: test on iOS Safari, macOS Safari, Chrome, Firefox. If a concrete bug surfaces, fall back to a dialog polyfill (`dialog-polyfill`) only for the affected browsers.

- **Risk: Tailwind v4's CSS-first approach breaks when a future integration still expects `tailwind.config.js` (e.g., a plugin library).**
  - Likelihood: low
  - Impact: low (scope to a future PR)
  - Mitigation: we're not using third-party Tailwind plugins in Phase 1; if one becomes necessary, re-evaluate.

- **Risk: CSS Grid collapse (sidebar column at < lg) causes layout shift visible to the user.**
  - Likelihood: low (transitions smoothly because sidebars are `display: none`, not animated width)
  - Impact: low
  - Mitigation: test at exact 1023→1024 threshold with DevTools responsive mode.

- **Risk: Pre-paint theme script blocks paint on slow devices.**
  - Likelihood: low (script is ~200 bytes of sync JS)
  - Impact: low
  - Mitigation: measure on a Moto G Power class device (per spec §15); the script must complete in < 5ms.

- **Risk: Typography clamp() formulas don't scale right on ultra-wide (≥ 1920px) monitors.**
  - Likelihood: medium (formulas from spec §5)
  - Impact: low (visual only)
  - Mitigation: verify at 1920px; add a `max` cap if H1 becomes uncomfortably large. Formula uses `max 2.5rem` which caps H1 at 40px — should be fine.

## 12. Done When

- [ ] `src/styles/global.css` contains `@import "tailwindcss"`, `@custom-variant dark`, `@theme` with all tokens, and a `@layer base` dark override.
- [ ] Theme pre-paint script (`src/scripts/theme-init.ts`) is emitted via `is:inline` in `BaseLayout.astro`.
- [ ] Viewport meta is exactly `width=device-width, initial-scale=1`; no max-scale.
- [ ] TopNav responds to breakpoint (hamburger at < md; full at md+).
- [ ] Drawer and BottomSheet open/close with native `<dialog>` semantics.
- [ ] LeftSidebar and RightTOC appear at correct breakpoints (lg, xl).
- [ ] PageShell renders home/about/privacy/terms/404 with correct content max-width.
- [ ] ChapterShell renders three chapter tabs with `transition:persist` on the shell.
- [ ] `prose.css` is imported into ChapterShell and applies clamp typography.
- [ ] `code.css` renders light/dark Shiki code blocks correctly.
- [ ] All interactive elements meet 44×44 touch target, validated by axe-core.
- [ ] Reduced-motion CSS rule is present and verified.

## 13. Open Questions

- [ ] **Should `SearchModal.astro` live in `layout/` or a new `search/` directory?** Currently placed in `layout/`; revisit when we wire Pagefind in a later session.
- [ ] **Font family choice.** Plan assumes Inter + Source Serif 4 + JetBrains Mono. Confirm with owner before wiring `@font-face`. (Open question carried from Session 1.)
- [ ] **Do we need a separate `print.css`?** Spec §14 lists print rules. Small enough to live in `global.css` under `@media print`. Default to the latter; revisit if rules grow.
- [ ] **Desktop-first ultra-wide.** If we add `3xl` (≥ 1920px) in future, where does it land — Tailwind's default scale has no 3xl, we'd need `@theme { --breakpoint-3xl: 1920px; }`. Defer per spec §17 open question.
- [ ] **Should `.prose` and the chapter shell main column use `container-type: inline-size` for container queries?** Would let us scale content independently of viewport. Not needed in Phase 1; evaluate if layouts grow complex.

## 14. References

- Spec: `.claude/specs/shared/responsive-breakpoints.md`
- Research: `.claude/plans/RESEARCH.md` Topics 4 (hydration), 5 (Tailwind v4), 8 (astro-mermaid + dual sink), 9 (Shiki CSS swap)
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — BaseLayout.astro
  - `.claude/plans/shared/accessibility.md` — focus, dialog, reduced motion, keyboard shortcuts
  - `.claude/plans/shared/performance.md` — font loading, critical CSS, bundle budgets
  - `.claude/plans/shared/seo.md` — SearchModal content wiring
- External:
  - [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme)
  - [Tailwind CSS — Dark mode](https://tailwindcss.com/docs/dark-mode)
  - [MDN — `<dialog>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
  - [MDN — Dynamic viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-percentage_lengths)
