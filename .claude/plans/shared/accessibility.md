---
title: Accessibility — Implementation Plan
status: draft
spec: .claude/specs/shared/accessibility.md
created: 2026-04-20
session: 2
estimated_effort: 10–12 hours
dependencies:
  - .claude/plans/00-infrastructure.md
  - .claude/plans/RESEARCH.md (Topics 4, 14)
  - .claude/plans/shared/routing-and-urls.md (BaseLayout)
  - .claude/plans/shared/responsive-breakpoints.md (shell components)
---

# Implementation Plan: Accessibility

## 1. Overview

This plan delivers the WCAG 2.2 Level AA baseline as code: skip link, language attribute, focus management across View Transitions, keyboard shortcuts, the three-tab ARIA pattern used by every chapter, and automated CI gates (axe-core + Pa11y + Lighthouse a11y score). Every subsequent plan and page can rely on the components and hooks defined here rather than re-implementing focus traps, live regions, or keybindings. Outputs: five reusable a11y primitives, one keybinding system, a GitHub Actions workflow, and a manual-test checklist embedded in the PR template.

## 2. Spec Reference

See `.claude/specs/shared/accessibility.md`. Load-bearing requirements:

- §2 WCAG 2.2 Level AA floor. Three 2.2 additions called out: 2.4.11 (focus not obscured), 2.5.7 (drag alternatives), 2.5.8 (target size).
- §3 Semantic HTML + single `<h1>` per page + no level skips.
- §4 Keyboard shortcuts: Tab/Shift+Tab, Enter/Space, Esc closes overlays, `/` focuses search, `⌘K` opens search modal, `←`/`→` prev/next chapter.
- §5 Focus indicator: 2px outline, 3:1 contrast, never removed without replacement.
- §6 Color + contrast: 4.5:1 body text, 3:1 large and UI components, both themes must pass.
- §7 Images: alt rules per type; complex diagrams use figure + aria-describedby.
- §10 Tab panel pattern for three-tab chapter. Live regions for dynamic updates.
- §11 `<html lang="en">`.
- §13 Support 200% zoom.
- §15 Testing protocol: axe-core, Lighthouse, Pa11y in CI; manual keyboard + screen reader per page type.

## 3. Technical Approach

**3.1 Framework-free a11y primitives.** Per RESEARCH.md Topic 4, we avoid framework islands where possible. A11y primitives (skip link, focus trap wrapper, live region) ship as `.astro` components that emit static HTML + small inline scripts.

**3.2 Native `<dialog>` for modals.** Already established by `.claude/plans/shared/responsive-breakpoints.md`. Native `<dialog>` gives us focus trap + backdrop + Esc-close + correct modal semantics for free, meeting WCAG 2.4.11 (focus not obscured by sticky elements) when paired with `scroll-padding-top`.

**3.3 View Transitions focus restoration.** Per RESEARCH.md Topic 14, `<ClientRouter />` has documented scroll and focus quirks. We attach `astro:page-load` and `astro:after-swap` handlers that:
- Restore scroll per URL from `sessionStorage`.
- Move focus to `<h1>` (or `#main`) on forward navigation to announce the new page to screen readers.
- Preserve focus on same-page anchor navigation (don't steal focus mid-action).

**3.4 Three-tab chapter ARIA.** The chapter tab bar is a `role="tablist"` with three `role="tab"` links. Since each tab is a real route (`<a href>`), we use the "tabs without panels" variant — `aria-selected` + `aria-current="page"` on the active tab; no `aria-controls` because the panel is the whole `<main>`, not a hidden DOM element.

**3.5 Keybinding manager.** One `src/scripts/keybindings.ts` module owns all global shortcuts. Components register handlers instead of attaching their own `keydown` listeners. Prevents conflicts, makes shortcuts discoverable, and surfaces a single source of truth for a future "keyboard shortcuts help" modal (Phase 2).

**3.6 Axe + Pa11y + Lighthouse in CI.** One GitHub Actions workflow runs three checks on every PR against the preview build. Gates merge on all three passing. The workflow is defined here; individual page plans may extend it but cannot relax it.

**3.7 Contrast validation at dev time.** We store all color tokens with documented contrast ratios in a comment block in `global.css`. The CI workflow includes a node script `scripts/check-contrast.mjs` that parses the CSS, reads the semantic token pairs, and computes WCAG contrast — fails PR if any pair drops below the required ratio.

## 4. File Structure

```
src/
  components/
    a11y/
      SkipLink.astro                               [create]
      VisuallyHidden.astro                         [create — .sr-only alternative that's component-wrapped]
      LiveRegion.astro                             [create — aria-live announcer]
      TabList.astro                                [create — the three-tab chapter pattern]
      TabLink.astro                                [create — child of TabList]
      FigureDescribed.astro                        [create — figure with short alt + long aria-describedby]
  scripts/
    keybindings.ts                                 [create — global keyboard shortcut manager]
    view-transition-a11y.ts                        [create — focus + scroll handlers]
  lib/
    a11y/
      announce.ts                                  [create — programmatic screen reader announcements]
scripts/
  check-contrast.mjs                               [create — CSS token contrast check]
.github/
  workflows/
    a11y.yml                                       [create — axe + Pa11y + Lighthouse]
  pull_request_template.md                         [modify — add a11y checklist]
```

Modifications to existing plan files:

- `src/layouts/BaseLayout.astro` — add SkipLink, LiveRegion mount, keybindings script import.
- `src/components/layout/ChapterShell.astro` — use `TabList` + three `TabLink` children.
- `src/styles/global.css` — append contrast-token documentation block.

## 5. Dependencies

**External (already installed):** none directly used for a11y.

**External (to add):**
- `@axe-core/cli` (devDependency) — for local & CI axe scans.
- `pa11y-ci` (devDependency) — batch Pa11y.
- `@lhci/cli` (devDependency) — Lighthouse CI runner.
- `playwright` (devDependency) — headless browser for axe + Lighthouse CI.
- Node built-in: none beyond `node:fs`, `node:path`, `node:process`.

**Internal:**
- Every layout and component consumes the a11y primitives.

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — BaseLayout, ClientRouter wiring.
- `.claude/plans/shared/responsive-breakpoints.md` — native dialog pattern, reduced-motion CSS.
- `.claude/plans/shared/performance.md` — Lighthouse CI shares the same runner.

## 6. Implementation Steps (Ordered)

1. **Create `src/components/a11y/SkipLink.astro`.** First focusable element on every page:
   ```astro
   ---
   const href = '#main';
   ---
   <a href={href} class="skip-link">Skip to main content</a>
   <style>
     .skip-link {
       position: absolute;
       top: -40px;
       left: 8px;
       padding: 8px 12px;
       background: var(--color-accent);
       color: var(--color-accent-fg);
       border-radius: 4px;
       z-index: 100;
       text-decoration: none;
     }
     .skip-link:focus { top: 8px; }
   </style>
   ```
   - Mount inside `BaseLayout.astro` as the first child of `<body>`.
   - Done when: pressing Tab on a fresh page shows the skip link; pressing Enter jumps to `<main id="main">` and moves focus there.

2. **Create `src/components/a11y/VisuallyHidden.astro`.**
   - Renders a `<span class="sr-only"><slot /></span>`. Pairs with `.sr-only` utility class in `global.css`:
     ```css
     .sr-only {
       position: absolute; width: 1px; height: 1px;
       padding: 0; margin: -1px; overflow: hidden;
       clip: rect(0,0,0,0); white-space: nowrap; border: 0;
     }
     ```
   - Add `.sr-only` to `global.css` in `@layer utilities`.
   - Done when: VisuallyHidden content is not visible but is read by VoiceOver.

3. **Create `src/components/a11y/LiveRegion.astro` + `src/lib/a11y/announce.ts`.**
   - `LiveRegion.astro` renders `<div id="a11y-announcer" aria-live="polite" aria-atomic="true" class="sr-only"></div>`.
   - Mount once in `BaseLayout.astro`.
   - `announce.ts`:
     ```ts
     export function announce(message: string, opts?: { assertive?: boolean }) {
       const el = document.getElementById('a11y-announcer');
       if (!el) return;
       el.setAttribute('aria-live', opts?.assertive ? 'assertive' : 'polite');
       el.textContent = '';
       queueMicrotask(() => { el.textContent = message; });
     }
     ```
   - Consumers: bookmark toggle ("Bookmark added"), theme toggle ("Dark mode on"), search modal open ("Search opened, type to begin"), View Transitions page-load (announces new `<title>`).
   - Done when: toggling theme announces via VoiceOver.

4. **Create `src/scripts/keybindings.ts`** — global keybinding manager:
   ```ts
   type Binding = { keys: string; when?: () => boolean; run: (e: KeyboardEvent) => void };
   const bindings: Binding[] = [];

   export function registerBinding(b: Binding) {
     bindings.push(b);
   }

   function match(e: KeyboardEvent, keys: string) {
     // parse 'Meta+K', 'Ctrl+K', '/', 'Escape', 'ArrowLeft', 'g h'
     // support platform-aware Cmd vs Ctrl via 'Mod' alias
     // return true/false
   }

   document.addEventListener('keydown', (e) => {
     // ignore if target is editable (input, textarea, contenteditable)
     const t = e.target as HTMLElement;
     if (t.closest('input, textarea, [contenteditable="true"]')) {
       if (e.key !== 'Escape') return; // Esc always works
     }
     for (const b of bindings) {
       if (match(e, b.keys) && (!b.when || b.when())) {
         e.preventDefault();
         b.run(e);
         return;
       }
     }
   });
   ```
   - Register default bindings:
     - `Mod+K` + `/` → open search modal (`document.getElementById('search-modal').showModal()`).
     - `Escape` → close topmost open `<dialog>`.
     - `ArrowLeft` / `ArrowRight` → navigate prev/next chapter (when `document.body.dataset.page === 'chapter'`).
   - Import `keybindings.ts` from `BaseLayout.astro` with `import '../scripts/keybindings.ts';`.
   - Done when: pressing `⌘K` on any page opens the search modal; pressing `/` does the same; pressing Esc with a modal open closes it; prev/next arrows navigate between chapters on chapter routes only.

5. **Create `src/scripts/view-transition-a11y.ts`** — focus + scroll restoration for `<ClientRouter />`:
   ```ts
   const KEY = 'gyandev:scroll';
   // Save scroll before swap
   document.addEventListener('astro:before-swap', () => {
     try {
       const map = JSON.parse(sessionStorage.getItem(KEY) || '{}');
       map[location.pathname] = window.scrollY;
       sessionStorage.setItem(KEY, JSON.stringify(map));
     } catch {}
   });
   // Restore scroll + move focus after swap
   document.addEventListener('astro:page-load', () => {
     try {
       const map = JSON.parse(sessionStorage.getItem(KEY) || '{}');
       const y = map[location.pathname];
       if (typeof y === 'number') window.scrollTo(0, y);
     } catch {}
     // Move focus to h1 or #main so screen readers announce new page
     const main = document.getElementById('main');
     const h1 = main?.querySelector('h1');
     const target = (h1 || main) as HTMLElement | null;
     if (target) {
       target.setAttribute('tabindex', '-1');
       target.focus({ preventScroll: true });
     }
     // Announce page title
     import('../lib/a11y/announce').then(({ announce }) => {
       announce(document.title, { assertive: false });
     });
   });
   ```
   - Import from `BaseLayout.astro`.
   - Done when: clicking a chapter tab moves focus to the new page's `<h1>` and announces the title.

6. **Create `src/components/a11y/TabList.astro` + `TabLink.astro`** — three-tab chapter pattern:
   ```astro
   // TabList.astro
   ---
   export interface Props { label: string; }
   const { label } = Astro.props;
   ---
   <nav role="tablist" aria-label={label} class="tablist">
     <slot />
   </nav>
   ```
   ```astro
   // TabLink.astro
   ---
   export interface Props {
     href: string;
     active: boolean;
     label: string;
   }
   const { href, active, label } = Astro.props;
   ---
   <a
     role="tab"
     href={href}
     aria-selected={active}
     aria-current={active ? 'page' : undefined}
     tabindex={active ? 0 : -1}
   >{label}</a>
   ```
   - Wire arrow-key focus movement within the tablist via a small inline script (Left/Right moves focus to sibling tab; Enter follows the link).
   - Consumed by `ChapterShell.astro`:
     ```astro
     <TabList label="Chapter views">
       <TabLink href={chapterUrl(course, chapter)} active={activeTab === 'full'} label="Full Notes" />
       <TabLink href={chapterRevisionUrl(course, chapter)} active={activeTab === 'revision'} label="Quick Revision" />
       <TabLink href={chapterFlowUrl(course, chapter)} active={activeTab === 'flow'} label="Flow Diagram" />
     </TabList>
     ```
   - Done when: axe reports no ARIA issues on the tab bar; Left/Right arrows move focus across tabs; Enter navigates.

7. **Create `src/components/a11y/FigureDescribed.astro`** — figure with accessible description:
   ```astro
   ---
   export interface Props { title: string; description?: string; id?: string; }
   const { title, description, id = `fig-${Math.random().toString(36).slice(2,8)}` } = Astro.props;
   ---
   <figure>
     <div role="img" aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined}>
       <slot />
     </div>
     <figcaption id={`${id}-t`}>{title}</figcaption>
     {description && <p id={`${id}-d`} class="sr-only">{description}</p>}
   </figure>
   ```
   - Consumed by MDX components for Mermaid diagrams and complex SVGs.
   - Done when: VoiceOver reads the title + description when focused on the figure.

8. **Update `src/layouts/BaseLayout.astro`**:
   - First child of `<body>`: `<SkipLink />`.
   - Before closing `</body>`: `<LiveRegion />`.
   - In `<head>` after ClientRouter: `<script>import '../scripts/keybindings.ts'; import '../scripts/view-transition-a11y.ts';</script>` (or static imports from the frontmatter so Astro bundles them).
   - `<html lang="en">` (should already be there from responsive plan; verify).
   - Done when: every rendered page shows SkipLink on first Tab, has the announcer mounted, and has keybindings active.

9. **Add contrast-documented tokens to `src/styles/global.css`** — expand the `@theme` comment:
   ```css
   /*
    * Contrast pairs (WCAG AA):
    *   --color-text vs --color-bg        — body:   light 16.2:1, dark 14.1:1  ✓ 4.5:1
    *   --color-text-muted vs --color-bg  — muted:  light 5.1:1,  dark 4.9:1   ✓ 4.5:1
    *   --color-accent vs --color-bg      — UI:     light 4.3:1,  dark 4.6:1   ✓ 3:1
    *   --color-accent-fg vs --color-accent — on-accent: light 5.9:1, dark 7.3:1 ✓ 4.5:1
    */
   ```
   - These are claims — Step 10 validates them.

10. **Create `scripts/check-contrast.mjs`** — Node ESM:
    - Parses `src/styles/global.css` extracting `@theme` and `.dark` blocks.
    - Uses a small embedded WCAG contrast implementation (no dependency) — reads `oklch` / `hex` / `rgb`.
    - Validates declared pairs from a `contrast-pairs.json` config file:
      ```json
      [
        { "fg": "--color-text",        "bg": "--color-bg",     "min": 4.5 },
        { "fg": "--color-text-muted",  "bg": "--color-bg",     "min": 4.5 },
        { "fg": "--color-accent",      "bg": "--color-bg",     "min": 3.0 },
        { "fg": "--color-accent-fg",   "bg": "--color-accent", "min": 4.5 }
      ]
      ```
    - Checks both light (@theme) and dark (`.dark {}`) scopes.
    - Exits 1 on any failure with human-readable line.
    - Add `"check:contrast": "node scripts/check-contrast.mjs"` to `package.json`.
    - Done when: tweaking a token to fail contrast causes the script to exit 1 with a clear message.

11. **Create `.github/workflows/a11y.yml`** — GitHub Actions:
    ```yaml
    name: a11y
    on:
      pull_request:
      push: { branches: [main] }
    jobs:
      a11y:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with: { node-version: '22' }
          - run: npm ci
          - run: npm run check:contrast
          - run: npm run validate:slugs
          - run: npm run build
          - run: npx playwright install --with-deps chromium
          - run: npx @axe-core/cli http://localhost:4321 --exit
            env: { CI: true }
          - uses: treosh/lighthouse-ci-action@v12
            with:
              urls: |
                http://localhost:4321/
                http://localhost:4321/courses
                http://localhost:4321/about
              configPath: '.lighthouserc.js'
              uploadArtifacts: true
          - run: npx pa11y-ci --sitemap http://localhost:4321/sitemap-index.xml
    ```
    - Companion config files:
      - `.pa11yci.json` — config with `defaults: { standard: 'WCAG2AA', runners: ['axe'] }`.
      - `.lighthouserc.js` — asserts `accessibility: 0.95` minimum, `categories:best-practices: 0.9`.
    - The workflow starts the dev server via `astro preview &` (or `npx serve dist`) before running tools. (Concrete server command resolved during implementation — `astro preview` pairs well with `wait-on`.)
    - Done when: the workflow runs on a PR, fails on any axe violation, fails if Lighthouse a11y < 95.

12. **Modify `.github/pull_request_template.md`** — add a11y checklist:
    ```markdown
    ### Accessibility checklist
    - [ ] Keyboard navigated the affected pages without a mouse
    - [ ] Verified focus indicator visible on every interactive element
    - [ ] Tested in both light and dark themes
    - [ ] Tested at 200% browser zoom
    - [ ] VoiceOver / NVDA walkthrough completed for new components
    - [ ] Automated a11y CI green
    ```
    - Done when: every new PR shows the checklist for reviewer signoff.

13. **Image authoring pattern (documentation only here).** Publish a short "image alt rules" section in the future `docs/AUTHORING.md` (not created in this plan — reserved for Session 3+):
    - Decorative → `alt=""`, no caption, no description.
    - Meaningful image → `alt="description"`.
    - Complex diagram → use `<FigureDescribed title="..." description="...">`.

14. **Focus management wiring for native `<dialog>` overlays** — responsive-breakpoints.md defines the dialogs; this plan defines the focus-restoration script:
    - When a trigger opens a `<dialog>`, remember the trigger element: `const opener = document.activeElement;`
    - On `dialog.close()` event, `opener?.focus()`.
    - Native `<dialog>` does this automatically in most cases, but the dialog's own `close()` programmatic call does not restore focus reliably in Safari — add a small universal listener in `keybindings.ts`.

15. **Add `docs/A11Y.md`** — one-page runbook listing (a) manual test checklist per page type, (b) tooling links (VoiceOver cheatsheet, NVDA download, axe DevTools). Keep short. Not strictly needed for Phase 1 ship but helps reviewers; defer if time-constrained.

## 7. Component/Module API Design

### `src/components/a11y/SkipLink.astro`
No props. Fixed `href="#main"`. Slot: none (label is fixed text).

### `src/components/a11y/VisuallyHidden.astro`
Slot: content to hide visually but expose to AT.

### `src/components/a11y/LiveRegion.astro`
No props. Renders the singleton announcer. Mount exactly once.

### `src/components/a11y/TabList.astro`
```ts
interface Props { label: string }
```
Slot: `<TabLink>` children.

### `src/components/a11y/TabLink.astro`
```ts
interface Props { href: string; active: boolean; label: string }
```

### `src/components/a11y/FigureDescribed.astro`
```ts
interface Props { title: string; description?: string; id?: string }
```
Slot: the visual content (svg, img, mermaid, etc.).

### `src/scripts/keybindings.ts`
```ts
type Binding = {
  keys: string;              // 'Mod+K', 'Escape', 'ArrowLeft', '/'
  when?: () => boolean;      // gate by page state
  run: (e: KeyboardEvent) => void;
};
export function registerBinding(b: Binding): void;
// Default bindings auto-registered at module load.
```

### `src/lib/a11y/announce.ts`
```ts
export function announce(message: string, opts?: { assertive?: boolean }): void;
```

## 8. Code Patterns

**Pattern: Semantic heading hierarchy.** One `<h1>` per page. Never skip levels. Enforced in CI via a pa11y rule:
```astro
<main id="main">
  <h1>{chapter.title}</h1>
  <h2>{section.title}</h2>
  <h3>{subsection.title}</h3>
</main>
```

**Pattern: Icon-only buttons require `aria-label`.**
```astro
<button aria-label="Toggle theme" aria-pressed={isDark}>
  <ThemeIcon aria-hidden="true" />
</button>
```

**Pattern: Images with alt text.**
```astro
<!-- Decorative -->
<img src="..." alt="" />
<!-- Meaningful -->
<img src="..." alt="Event loop phases diagram" width={800} height={450} />
<!-- Complex -->
<FigureDescribed title="Event loop phases" description="Timers, pending callbacks, poll, check, close callbacks, in order.">
  <svg>…</svg>
</FigureDescribed>
```

**Pattern: Announcing UI state changes.**
```ts
import { announce } from '../lib/a11y/announce';
announce('Dark mode on');
```

**Pattern: Tab panel convention (three-tab chapter).** Use "tabs without panels" variant because each tab is a full page route. Do NOT use `aria-controls` — the panel is the entire `<main>`, which is already in the accessibility tree via landmark navigation.

**Pattern: Keybinding registration.**
```ts
import { registerBinding } from '../scripts/keybindings';
registerBinding({
  keys: 'Mod+K',
  run: () => document.getElementById('search-modal')?.showModal(),
});
```

**Pattern: Reduced motion.** Do not write per-component reduced-motion CSS — the global rule in `global.css` handles it. Exception: truly essential motion (e.g., loading spinners) may opt back in within a `@media (prefers-reduced-motion: no-preference)` block.

## 9. Testing Strategy

**Automated CI (blocking):**
- `npm run check:contrast` — static CSS token check.
- `@axe-core/cli` — scans rendered HTML for axe rules (fails on serious/critical).
- `pa11y-ci` — scans every URL in sitemap against WCAG2AA.
- Lighthouse CI — asserts a11y score ≥ 95.

**Manual per PR:**
- Keyboard-only navigation through affected pages.
- Focus indicator visible everywhere.
- 200% zoom test.
- Screen reader walkthrough (VoiceOver on macOS; NVDA for Windows QA before release).

**Per-release (every ~2 weeks):**
- One full site keyboard traversal.
- One VoiceOver traversal of home + one chapter.
- Windows High Contrast mode visual check on 3 pages.

**Manual tests NOT in CI (document only):**
- Real user testing with disabled users (spec §15, quarterly, paid). This is a process commitment; no code changes here.

## 10. Rollout Plan

1. Steps 1–3: primitives (SkipLink, VisuallyHidden, LiveRegion + announce).
2. Steps 4–5: keybindings + view-transition-a11y scripts.
3. Step 6: TabList + TabLink (required for Session 3 chapter page).
4. Step 7: FigureDescribed.
5. Step 8: BaseLayout wiring.
6. Steps 9–10: contrast docs + validator script.
7. Step 11: CI workflow. (Requires Steps 1–8 to be in place first so CI has something to scan.)
8. Step 12: PR template.
9. Steps 13–15: docs.

## 11. Risks and Mitigations

- **Risk: Lighthouse a11y score fluctuates due to external factors (font load time affecting contrast detection).**
  - Likelihood: low
  - Impact: medium (flaky CI)
  - Mitigation: fix fonts to self-hosted preload (`.claude/plans/shared/performance.md`); set Lighthouse run-count to 3 with median aggregation.

- **Risk: `<ClientRouter />` focus restoration races with View Transitions animations.**
  - Likelihood: medium
  - Impact: medium
  - Mitigation: `astro:page-load` fires after the transition's `animationend`; use `preventScroll: true` on `focus()` to avoid scroll jump. If bugs surface, delay focus move via `requestAnimationFrame` twice.

- **Risk: Third-party iframe (Giscus) hosts inaccessible content we can't fix.**
  - Likelihood: low (Giscus has decent a11y)
  - Impact: medium
  - Mitigation: Giscus is lazy-mounted below fold and behind a clear heading `<h2 id="comments">Comments</h2>`; keyboard users can skip past it. If complaints surface, replace with alternative.

- **Risk: Keybinding conflicts with native browser shortcuts (⌘K is Chrome's address bar).**
  - Likelihood: medium
  - Impact: low (we call `e.preventDefault()` only inside `<main>` context; outside inputs, native shortcut still reaches browser before our handler unless user's focus is in-page)
  - Mitigation: respect `e.target` editable-element check; for `⌘K`, only take over when focus is outside text inputs.

- **Risk: Native `<dialog>` focus trap is imperfect in Safari.**
  - Likelihood: medium (known issues with `<dialog>` historically)
  - Impact: medium
  - Mitigation: use `dialog-polyfill` conditionally for Safari < 15.4 (auto-detect via `'HTMLDialogElement' in window`). Our minimum support is modern browsers per CLAUDE.md — defer polyfill unless we see real reports.

- **Risk: Single `<h1>` rule violated when page template uses one and MDX content has another.**
  - Likelihood: high
  - Impact: medium (SEO + a11y)
  - Mitigation: MDX authors write starting from h2 inside chapter bodies — the layout owns the h1 (chapter title). Document in authoring guide. Extend `validate-slugs.mjs` to also lint MDX heading levels.

## 12. Done When

- [ ] All 5 a11y primitives exist: SkipLink, VisuallyHidden, LiveRegion, TabList+TabLink, FigureDescribed.
- [ ] `announce()` callable from any client script.
- [ ] `keybindings.ts` handles `Mod+K`, `/`, `Esc`, prev/next chapter.
- [ ] `view-transition-a11y.ts` restores scroll and moves focus to `<h1>` on page swap.
- [ ] BaseLayout mounts SkipLink (first), LiveRegion (end), and imports both scripts.
- [ ] `.github/workflows/a11y.yml` passes on main.
- [ ] PR template has the a11y checklist.
- [ ] Every page passes axe-core with zero serious/critical issues.
- [ ] Lighthouse a11y ≥ 95 on home, all-courses, course-overview, one chapter Full Notes.
- [ ] One full VoiceOver walkthrough completed and recorded in issue tracker.
- [ ] Contrast script validates all documented pairs.

## 13. Open Questions

- [ ] **`g h`-style two-stroke shortcuts (GitHub convention).** Spec §4 lists "g then h → home" as optional. Worth implementing in `keybindings.ts` for power users? Defer; add if user feedback requests it.
- [ ] **Dyslexia-friendly font toggle (Atkinson Hyperlegible).** Spec §18 flags for Phase 2. Don't implement in Phase 1 but leave the `gyandev:fontFamily` localStorage slot reserved.
- [ ] **Dedicated accessibility statement page at `/a11y`.** Spec §18 recommends. Nice-to-have; defer to Session 3 if page plans have room.
- [ ] **WCAG 2.2 SC 2.5.7 (drag alternatives).** We currently have swipe-to-dismiss on drawer + bottom sheet. Fallbacks (X button, backdrop click) already exist — this is compliant. Document in A11Y.md.
- [ ] **Custom focus ring color via user pref.** Spec §18 flags. Low priority; defer.
- [ ] **Does `announce()` need a queue to handle rapid successive messages?** If two actions fire within microtask tick, second overwrites first. Current impl is intentional (stale announcements unhelpful); revisit if QA finds missed announcements.

## 14. References

- Spec: `.claude/specs/shared/accessibility.md`
- Research: `.claude/plans/RESEARCH.md` Topics 4 (hydration + inline scripts), 14 (ClientRouter scroll/focus quirks)
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — BaseLayout, ClientRouter
  - `.claude/plans/shared/responsive-breakpoints.md` — native dialog, reduced-motion CSS
  - `.claude/plans/shared/performance.md` — Lighthouse CI, font loading
  - `.claude/plans/shared/seo.md` — SearchModal Pagefind content wiring
- External:
  - [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
  - [ARIA Authoring Practices — Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
  - [axe-core rules](https://dequeuniversity.com/rules/axe/)
  - [Pa11y documentation](https://pa11y.org/)
  - [Astro View Transitions Router API](https://docs.astro.build/en/reference/modules/astro-transitions/)
