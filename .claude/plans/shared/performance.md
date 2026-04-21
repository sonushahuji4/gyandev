---
title: Performance — Implementation Plan
status: draft
spec: .claude/specs/shared/performance.md
created: 2026-04-20
session: 2
estimated_effort: 10–12 hours
dependencies:
  - .claude/plans/00-infrastructure.md
  - .claude/plans/RESEARCH.md (Topics 4, 8, 10, 12, 14)
  - .claude/plans/shared/routing-and-urls.md
  - .claude/plans/shared/responsive-breakpoints.md
  - .claude/plans/shared/accessibility.md
---

# Implementation Plan: Performance

## 1. Overview

This plan operationalizes the CWV budgets: LCP < 2.5s, INP < 200ms, CLS < 0.1. It delivers (a) a self-hosted font pipeline with preload, (b) image handling conventions backed by Astro's `<Image>`, (c) a critical-CSS inline strategy, (d) the hydration budget already ratified in Session 1 (a minimal-JS approach with component-by-component directives), (e) a bundle-size CI gate, (f) Cloudflare cache headers, and (g) a Lighthouse-CI runner shared with the a11y plan. It does NOT set up Sentry or Cloudflare Analytics dashboards — that's Phase 2 operations work flagged in open questions.

## 2. Spec Reference

See `.claude/specs/shared/performance.md`. Load-bearing requirements:

- §2 CWV targets at p75 field data (LCP 2.5s, INP 200ms, CLS 0.1) + FCP 1.8s, TTFB 0.8s, TBT 200ms.
- §3 Page weight budgets (total < 500KB, JS < 100KB gz first-party, CSS < 30KB gz, fonts < 80KB, images < 200KB, HTML < 50KB gz).
- §4 LCP optimization: preload LCP image, inline critical CSS, preconnect font origins, self-host fonts.
- §5 INP optimization: break long tasks, debounce scroll handlers, lazy-hydrate islands.
- §6 CLS optimization: width/height on all images, font-display swap, reserved space for iframes, skeletons for dynamic content.
- §7 Image: AVIF → WebP → JPEG, responsive srcset, Astro `<Image>` mandatory.
- §8 Font: self-host, `font-display: swap`, subset to Latin + Latin Extended, variable fonts preferred.
- §9 JS: Astro islands, correct hydration directive per component.
- §10 CSS: inline critical, Tailwind purge (v4 auto), no CSS-in-JS, GPU-only animations.
- §11 Caching: `/_headers` with immutable for hashed assets.
- §12 Third-party: Giscus lazy, Cloudflare Analytics async, Mermaid only on /flow.
- §15 Testing: Lighthouse, WebPageTest simulated 4G, device testing.
- §17 Regression prevention: Lighthouse CI, bundlesize, pre-commit image check.

## 3. Technical Approach

**3.1 Self-hosted fonts via woff2 preload.** Per spec §8 we self-host. We use a single variable font file per family (Inter, Source Serif 4, JetBrains Mono) with `font-display: swap`. Only the LCP-critical weight(s) are preloaded — body text (Inter Regular) on every page; display serif on home only.

**3.2 Image pipeline: Astro `<Image>` component for everything.** Per spec §7 and RESEARCH.md Topic 4, never use raw `<img>` for content images. The Astro `<Image>` component generates AVIF + WebP variants at build time, emits `srcset`, and enforces `width`/`height`. SVG diagrams stay as `<svg>` inline (no `<Image>` for them).

**3.3 Hydration budget, already ratified.** The per-component hydration strategy from RESEARCH.md Topic 4 and `00-infrastructure.md` §7 is law. This plan does not re-decide; it verifies:
- Theme toggle → inline `<script is:inline>` + vanilla handler (0 JS shipped framework-side).
- Bookmark button → vanilla `<script>` (0 JS shipped framework-side).
- Mobile nav drawer → `client:media`.
- Mermaid → `client:visible` (or `client:only` if SSR fails).
- Giscus → lazy-mount via IntersectionObserver wrapper.
- Search modal → `client:idle` with dynamic-import Pagefind runtime on first open.

**3.4 Critical CSS inlining.** Astro 4+ inlines styles of small stylesheets automatically (`experimental.inlineStylesheets` is now stable). We opt into `inlineStylesheets: 'auto'` (default) and audit. The `global.css` bundle should end up under ~30KB gz after Tailwind v4 purges — within budget. If it grows, we carve out a `critical.css` file that contains only above-the-fold rules and inline that via a layout slot.

**3.5 Scroll restoration utility (coupling with a11y plan).** Per RESEARCH.md Topic 14, View Transitions scroll restoration is flaky. The `view-transition-a11y.ts` script from the a11y plan already handles it. We don't duplicate here; we reference.

**3.6 Bundle size CI gate.** `scripts/check-bundle-size.mjs` runs after `astro build` and inspects `dist/` directory, computes gzipped totals per-route and enforces budgets from spec §3. Fails build if any route exceeds. Output is a human-readable table with per-route breakdown.

**3.7 Cache-Control strategy via `_headers`.** Set once, cached forever:
- `/_astro/*` and `/fonts/*` — `max-age=31536000, immutable` (safe: hashed filenames for `_astro`; fonts change rarely).
- `/og/*` — `max-age=2592000` (30 days; OG images rebuilt on each deploy but unhashed, so shorter).
- `/*.html` — `no-cache` at browser, edge-cached by Cloudflare default.

**3.8 Lighthouse CI shared config.** The `.lighthouserc.js` from the a11y plan adds performance assertions:
- `categories:performance: 0.9` (mobile).
- `largest-contentful-paint: 2500ms`.
- `cumulative-layout-shift: 0.1`.
- `total-blocking-time: 200ms`.

**3.9 Mermaid bundle isolation.** Per RESEARCH.md Topic 8 + 14, Mermaid only loads on `/flow` routes. This is enforced by (a) `<Mermaid />` MDX component only imported into the flow.astro template, and (b) `astro-mermaid` auto-injects its script only on pages with ```mermaid fences. Smoke test: build the site, grep `dist/` for `mermaid` references — should only appear under `/courses/*/*/flow.html` and associated chunks.

## 4. File Structure

```
astro.config.mjs                                   [modify — confirm inlineStylesheets default, image config]
public/
  fonts/
    Inter-Variable.woff2                           [add — font asset]
    SourceSerif4-Variable.woff2                    [add]
    JetBrainsMono-Variable.woff2                   [add]
  _headers                                          [modify — add cache-control rules]
src/
  components/
    perf/
      FontPreload.astro                            [create — emits <link rel="preload"> for LCP fonts]
      CriticalCSS.astro                            [create — slot for page-specific critical CSS]
      LazyScript.astro                             [create — IntersectionObserver script injector]
      GiscusLazy.astro                             [create — comments wrapper using LazyScript pattern]
    ui/
      SmartImage.astro                             [create — thin wrapper over Astro <Image>]
  styles/
    fonts.css                                      [create — @font-face declarations]
scripts/
  check-bundle-size.mjs                            [create]
  generate-perf-report.mjs                         [create — post-build Lighthouse summary]
.lighthouserc.js                                   [create — shared with a11y plan, extended here]
docs/
  PERF.md                                          [create — per-page performance checklist]
```

## 5. Dependencies

**External (already installed):** Astro ships `<Image>`/`<Picture>` components natively; sharp included.

**External (to add):**
- `@fontsource-variable/inter` — alternative to hand-downloading; provides woff2 + unicode subsetting. OR hand-place `.woff2` files in `public/fonts/`. Default: hand-place (simpler ownership, no extra package).
- `@lhci/cli` — already added in a11y plan.
- Node built-in `node:zlib` for gzip measurement.

**Internal:**
- Uses `BaseLayout.astro`, `global.css` from earlier plans.

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — `BaseLayout.astro` slots.
- `.claude/plans/shared/responsive-breakpoints.md` — `global.css` tokens, main column layout (impacts LCP element identification).
- `.claude/plans/shared/accessibility.md` — Lighthouse CI runner, `view-transition-a11y.ts` scroll restore.

## 6. Implementation Steps (Ordered)

1. **Place font files in `public/fonts/`** — Variable woff2 for Inter, Source Serif 4, JetBrains Mono. License check required before committing (open question). Subset to Latin + Latin-Ext if files exceed 80KB/each.

2. **Create `src/styles/fonts.css`**:
   ```css
   @font-face {
     font-family: 'Inter';
     src: url('/fonts/Inter-Variable.woff2') format('woff2-variations');
     font-weight: 100 900;
     font-display: swap;
     font-style: normal;
   }
   @font-face {
     font-family: 'Source Serif 4';
     src: url('/fonts/SourceSerif4-Variable.woff2') format('woff2-variations');
     font-weight: 200 900;
     font-display: swap;
     font-style: normal;
   }
   @font-face {
     font-family: 'JetBrains Mono';
     src: url('/fonts/JetBrainsMono-Variable.woff2') format('woff2-variations');
     font-weight: 100 800;
     font-display: swap;
     font-style: normal;
   }
   ```
   - Import from `global.css` at the top: `@import './fonts.css';`.
   - Done when: fonts load; DevTools Network tab shows `Transferred` size under 80KB per font.

3. **Create `src/components/perf/FontPreload.astro`** — emits preload links:
   ```astro
   ---
   export interface Props { includeSerif?: boolean; }
   const { includeSerif = false } = Astro.props;
   ---
   <link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin>
   {includeSerif && (
     <link rel="preload" href="/fonts/SourceSerif4-Variable.woff2" as="font" type="font/woff2" crossorigin>
   )}
   ```
   - Mount in `BaseLayout.astro` `<head>`. Home passes `includeSerif={true}`; other pages default (false).
   - JetBrainsMono is NOT preloaded — code blocks load after critical content.
   - Done when: DevTools "Preload" column shows Inter; Serif preloads only on home.

4. **Create `src/components/perf/CriticalCSS.astro`** — a reserved slot in `BaseLayout.astro` for page-specific critical CSS (future extension):
   ```astro
   ---
   export interface Props { styles?: string; }
   const { styles } = Astro.props;
   ---
   {styles && <style set:html={styles} />}
   ```
   - Used only if a specific page type needs extra above-the-fold CSS beyond `global.css`. Empty for most pages.
   - Done when: component exists; default empty is verified via page source.

5. **Verify `astro.config.mjs` image + inline defaults.** Add explicit config only where defaults differ from our goals:
   ```js
   export default defineConfig({
     // existing...
     image: {
       service: { entrypoint: 'astro/assets/services/sharp' }, // default, explicit
     },
     build: {
       inlineStylesheets: 'auto', // default since Astro 4; explicit
       format: 'file',
     },
   });
   ```
   - Done when: `npm run build` produces a `dist/` with AVIF+WebP for any `<Image>` used, and CSS < 4KB is inlined into HTML.

6. **Create `src/components/ui/SmartImage.astro`** — convenience wrapper over Astro `<Image>`:
   ```astro
   ---
   import { Image, type LocalImageProps } from 'astro:assets';
   export interface Props extends LocalImageProps {
     priority?: boolean;  // maps to fetchpriority="high" + loading="eager"
   }
   const { priority, loading, ...rest } = Astro.props;
   ---
   <Image
     {...rest}
     loading={priority ? 'eager' : (loading ?? 'lazy')}
     fetchpriority={priority ? 'high' : undefined}
     decoding="async"
   />
   ```
   - LCP image on home/course-overview passes `priority={true}`.
   - Below-the-fold default is lazy.
   - Done when: `<SmartImage priority>` on a hero renders `<img loading="eager" fetchpriority="high">`.

7. **Create `src/components/perf/LazyScript.astro`** — IntersectionObserver-based script injector, reusable for any lazy-mounted third party:
   ```astro
   ---
   export interface Props {
     rootMargin?: string; // default '200px'
     id?: string;         // unique id for the placeholder
   }
   const { rootMargin = '200px', id = 'lazy-' + Math.random().toString(36).slice(2,8) } = Astro.props;
   ---
   <div id={id} data-lazy-root={rootMargin}>
     <slot name="placeholder" />
   </div>
   <slot name="script" />
   <script is:inline define:vars={{ id }}>
     (() => {
       const root = document.getElementById(id);
       if (!root) return;
       const rootMargin = root.dataset.lazyRoot || '200px';
       const io = new IntersectionObserver((entries) => {
         if (entries.some(e => e.isIntersecting)) {
           io.disconnect();
           // Clone the <template> inside and insert
           const tpl = root.querySelector('template[data-lazy-script]');
           if (tpl) root.appendChild(tpl.content.cloneNode(true));
         }
       }, { rootMargin });
       io.observe(root);
     })();
   </script>
   ```
   - Consumers pass the actual 3rd-party `<script>` inside a `<template data-lazy-script>` in the `script` slot.
   - Done when: a test page with a `<LazyScript>` + template does not fetch the script until the container is near viewport.

8. **Create `src/components/perf/GiscusLazy.astro`** — lazy Giscus wrapper, per RESEARCH.md Topic 7:
   ```astro
   ---
   export interface Props { term: string; }
   const { term } = Astro.props;
   ---
   <section id="comments" aria-labelledby="comments-heading">
     <h2 id="comments-heading">Comments</h2>
     <LazyScript rootMargin="400px">
       <div slot="placeholder" class="giscus-skeleton" style="min-height: 240px;" />
       <template slot="script" data-lazy-script>
         <script src="https://giscus.app/client.js"
                 data-repo={import.meta.env.PUBLIC_GISCUS_REPO}
                 data-repo-id={import.meta.env.PUBLIC_GISCUS_REPO_ID}
                 data-category-id={import.meta.env.PUBLIC_GISCUS_CATEGORY_ID}
                 data-mapping="specific"
                 data-term={term}
                 data-strict="1"
                 data-theme="preferred_color_scheme"
                 data-loading="lazy"
                 crossorigin="anonymous" async></script>
       </template>
     </LazyScript>
     <script is:inline>
       // Sync theme on toggle — see RESEARCH.md Topic 7
       document.addEventListener('theme-change', (e) => {
         const iframe = document.querySelector('iframe.giscus-frame');
         if (!iframe) return;
         iframe.contentWindow.postMessage(
           { giscus: { setConfig: { theme: e.detail.theme === 'dark' ? 'dark_dimmed' : 'light' } } },
           'https://giscus.app'
         );
       });
     </script>
   </section>
   ```
   - `theme-change` event is fired by `ThemeToggle.astro` (see responsive-breakpoints plan Step 4).
   - Done when: Giscus iframe does not appear in Network tab until page is scrolled within 400px of the comments section.

9. **Modify `public/_headers`** — add cache-control for `/og/*`, `/_astro/*`, `/fonts/*`, HTML baseline. Final file (seo.md may extend):
   ```
   /*
     X-Frame-Options: DENY
     X-Content-Type-Options: nosniff
     Referrer-Policy: strict-origin-when-cross-origin
     Permissions-Policy: geolocation=(), microphone=(), camera=()
     Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
     Cache-Control: public, max-age=0, must-revalidate

   /_astro/*
     Cache-Control: public, max-age=31536000, immutable

   /fonts/*
     Cache-Control: public, max-age=31536000, immutable
     Access-Control-Allow-Origin: *

   /og/*
     Cache-Control: public, max-age=2592000
   ```
   - CSP is added by seo.md plan.

10. **Create `scripts/check-bundle-size.mjs`** — Node ESM, runs as `postbuild`:
    - Walks `dist/` for `.html`, `.css`, `.js`, `.woff2`, `.avif`, `.webp` files.
    - Per route (= each `.html`), computes:
      - HTML gz size.
      - Sum of referenced CSS/JS/font/image asset sizes (parse `<link>` and `<script>` and `<img>`).
    - Compare against budgets (spec §3); fail if any route exceeds.
    - Output: `{ route, html, css, js, fonts, images, total }[]` table.
    - Budgets encoded as constants; tuning lives in one place:
      ```js
      const BUDGETS = {
        totalPage: 500_000,
        js: 100_000,
        css: 30_000,
        fontsPerPage: 80_000,
        imagesPerPage: 200_000,
        htmlGz: 50_000,
      };
      ```
    - Add `"check:bundle": "node scripts/check-bundle-size.mjs"` + extend `check` script.
    - Done when: intentionally adding a large library to a page causes CI to fail with a clear "route X exceeds JS budget" message.

11. **Create `.lighthouserc.js`** (shared with a11y plan, extended here):
    ```js
    module.exports = {
      ci: {
        collect: {
          staticDistDir: './dist',
          numberOfRuns: 3,
          settings: {
            preset: 'desktop',
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
          },
        },
        assert: {
          assertions: {
            'categories:performance': ['error', { minScore: 0.9 }],
            'categories:accessibility': ['error', { minScore: 0.95 }],
            'categories:best-practices': ['warn', { minScore: 0.9 }],
            'categories:seo': ['error', { minScore: 0.95 }],
            'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
            'total-blocking-time': ['error', { maxNumericValue: 200 }],
          },
        },
        upload: { target: 'temporary-public-storage' },
      },
    };
    ```
    - Desktop-first; add mobile run as a second job after baseline greens.
    - Done when: Lighthouse CI runs against `dist/` and asserts pass.

12. **Modify `astro.config.mjs` integrations to confirm per-component hydration** (declarative; no code change — this is the contract we honor when writing components in later sessions):
    - Theme toggle: no framework wrapper, just inline scripts.
    - Bookmark: no framework wrapper, just inline scripts.
    - Mermaid: `client:visible` on its Astro island wrapper.
    - Giscus: wrapped in `<GiscusLazy>` (already lazy via IntersectionObserver).
    - Search: Pagefind UI mounted via `client:idle` on the modal's island wrapper.
    - Mobile drawer: `client:media="(max-width: 768px)"` on its island (if it needs state).
    - Document this contract in `docs/PERF.md`.

13. **Add `"postbuild": "node scripts/check-bundle-size.mjs"`** to `package.json` so bundle-size check runs on every `npm run build` locally as well as CI.

14. **Extend `.github/workflows/a11y.yml` (rename to `ci.yml`)** — add performance assertions to the same workflow (cheaper than two workflows):
    - Move Lighthouse step into the shared workflow.
    - Add `npm run check:bundle` step.
    - Rename file to `.github/workflows/ci.yml` and job name to `verify`.

15. **Create `docs/PERF.md`** — runbook:
    - Per-page performance checklist (LCP identified, fonts preloaded, images optimized, no unused JS).
    - "How to add a new third-party script" guide (use `LazyScript` pattern; measure with Lighthouse).
    - Regression triage steps.

## 7. Component/Module API Design

### `src/components/perf/FontPreload.astro`
```ts
interface Props { includeSerif?: boolean; }
```

### `src/components/perf/CriticalCSS.astro`
```ts
interface Props { styles?: string; }
```

### `src/components/perf/LazyScript.astro`
```ts
interface Props { rootMargin?: string; id?: string; }
```
Slots: `placeholder` (visible until intersection), `script` (actual 3rd-party markup wrapped in a `<template data-lazy-script>`).

### `src/components/perf/GiscusLazy.astro`
```ts
interface Props { term: string; }
```

### `src/components/ui/SmartImage.astro`
```ts
interface Props extends LocalImageProps { priority?: boolean; }
```
Authors pass all standard `<Image>` props plus optional `priority` for LCP images.

### `scripts/check-bundle-size.mjs`
Exit 0 on pass, 1 on any budget violation. No flags in Phase 1.

## 8. Code Patterns

**Pattern: Mark the LCP image.** Exactly one per page — add `priority`:
```astro
<SmartImage src={heroImage} alt="..." width={1200} height={600} priority />
```

**Pattern: Below-fold images default lazy.**
```astro
<SmartImage src={secondarySection} alt="..." width={800} height={450} />
```

**Pattern: Third-party embeds use `<LazyScript>`.**
```astro
<LazyScript rootMargin="300px">
  <div slot="placeholder" style="min-height: 400px;" />
  <template slot="script" data-lazy-script>
    <script src="https://example.com/widget.js" async></script>
  </template>
</LazyScript>
```

**Pattern: Font preload is LCP-critical only.** Don't preload code-block font — fewer preloads means higher-priority resources win:
```astro
<FontPreload includeSerif={isHomePage} />
<!-- Do NOT preload JetBrains Mono -->
```

**Pattern: GPU-accelerated animation only.** Use `transform` + `opacity` exclusively. Do not animate `top`/`left`/`width`/`height`/`margin`:
```css
.drawer-enter { transform: translateX(-100%); }
.drawer-enter-active { transform: translateX(0); transition: transform 200ms ease-out; }
```

**Pattern: Reserved space for iframes.** Always set `min-height` before the iframe loads:
```astro
<section style="min-height: 400px;">
  <iframe src="..."></iframe>
</section>
```

**Pattern: Debounced scroll handlers.** For TOC highlight (~16ms throttle = 60fps):
```ts
let pending = false;
window.addEventListener('scroll', () => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    // update TOC active heading
  });
}, { passive: true });
```

## 9. Testing Strategy

**Automated CI (blocking):**
- `npm run check:bundle` — per-route budget enforcement.
- Lighthouse CI mobile + desktop — CWV assertions (LCP, CLS, TBT).
- CI must catch a regression within one PR of introduction.

**Local development:**
- `npm run build && npm run preview` + Chrome DevTools Lighthouse.
- `npm run check` runs validate-slugs, validate-content, check-contrast, check-bundle, build.

**Pre-launch (per spec §15):**
- PageSpeed Insights mobile + desktop.
- WebPageTest on Slow 4G: LCP < 3s.
- Manual device test on low-end Android (Moto G Power class) + iPhone SE (2020).

**Ongoing (Phase 2):**
- Cloudflare Web Analytics Core Web Vitals trend dashboard.
- Search Console CWV report weekly.

**Not tested in CI, documented in PERF.md:**
- Real-user monitoring (RUM) — Cloudflare provides this; no code change needed.

## 10. Rollout Plan

1. Step 1: font assets (blocking all downstream).
2. Steps 2–3: font CSS + preload component.
3. Step 4: CriticalCSS slot (stub only; actual usage deferred).
4. Step 5: astro.config.mjs confirmations.
5. Step 6: SmartImage wrapper.
6. Steps 7–8: LazyScript + GiscusLazy (unblocks chapter page wiring in Session 3).
7. Step 9: _headers cache rules.
8. Steps 10, 13: bundle-size script + postbuild hook.
9. Step 11: Lighthouse config.
10. Steps 12, 14: hydration contract + CI extension.
11. Step 15: PERF.md docs.

## 11. Risks and Mitigations

- **Risk: Font files exceed the 80KB budget after subsetting.**
  - Likelihood: medium (variable fonts with Latin Extended can be 60–120KB)
  - Impact: low (budget overrun, not a user-visible perf issue)
  - Mitigation: subset aggressively (Latin only if Latin Ext is too big); or use `@fontsource-variable/inter` which subsets by default.

- **Risk: Astro `<Image>` build time balloons as content grows.**
  - Likelihood: medium for 50+ chapters each with hero images
  - Impact: medium (CI slow)
  - Mitigation: Astro caches in `node_modules/.astro/image`; cache survives across CI runs if we configure cache-dir action. At ~10 chapters currently, not an issue.

- **Risk: Mermaid loads on non-/flow pages due to authoring mistake (e.g., a ```mermaid fence in Full Notes).**
  - Likelihood: medium
  - Impact: high (violates 100KB JS budget)
  - Mitigation: `validate-content.mjs` (future script hint) rejects ```mermaid fences outside `flow.mdx`. Flag as open question for Session 3.

- **Risk: Lighthouse CI flakes on CI runners (slow VMs).**
  - Likelihood: medium (known Lighthouse CI issue)
  - Impact: medium
  - Mitigation: `numberOfRuns: 3` with median aggregation; budgets set with small margin (e.g., LCP budget 2500ms — if we're routinely at 2400ms we're fine).

- **Risk: Giscus lazy-mount fails in some browsers, breaking comment UX.**
  - Likelihood: low (IntersectionObserver universal in modern browsers)
  - Impact: low (fallback: user doesn't see comments; no crash)
  - Mitigation: fallback in `LazyScript.astro` — if `IntersectionObserver` not available, inject immediately. Detection in the inline script.

- **Risk: Cache invalidation for `/og/*` images — user sees stale OG when we update a chapter title.**
  - Likelihood: medium
  - Impact: low (social share shows old title until cache expires)
  - Mitigation: 30-day TTL is already chosen for this trade-off; if becomes painful, switch to hashed filenames in the OG pipeline (seo.md plan).

- **Risk: `transition:persist="chapter-shell"` leaks DOM state (e.g., an open dropdown) across tab switches.**
  - Likelihood: medium
  - Impact: low (visual bug)
  - Mitigation: ensure nothing in the persisted region has hydration-persisted open state. If it does, use `transition:persist-props` to refresh on swap.

## 12. Done When

- [ ] Three variable fonts in `public/fonts/` with licenses verified.
- [ ] `fonts.css` declares `@font-face` for all three with `font-display: swap`.
- [ ] `FontPreload` mounts Inter on every page and Serif on home.
- [ ] `astro.config.mjs` has `inlineStylesheets: 'auto'` and `build.format: 'file'`.
- [ ] `SmartImage` is the only image component used in new code (verified by grep).
- [ ] `LazyScript` and `GiscusLazy` exist and lazy-mount as expected.
- [ ] `public/_headers` has long-cache rules for assets and no-cache for HTML.
- [ ] `check-bundle-size.mjs` exists and runs on every build.
- [ ] `.lighthouserc.js` asserts CWV budgets and perf ≥ 90.
- [ ] CI workflow runs bundle check + Lighthouse against `dist/`.
- [ ] Sample Lighthouse report on home + chapter shows LCP < 2.5s, CLS < 0.1, TBT < 200ms (lab).

## 13. Open Questions

- [ ] **Font licensing:** Inter (OFL), Source Serif 4 (OFL), JetBrains Mono (OFL). All permissive. Confirm inclusion acceptable with owner before committing binaries. Carried from Session 1 open questions.
- [ ] **Subsetting level:** Latin only (smaller) vs Latin + Latin Extended (supports more names and foreign words). Default: Latin Extended for inclusivity; revisit if fonts exceed budget.
- [ ] **Cloudflare Web Analytics snippet** — minimal JS (~5KB), async. This plan does not add the snippet; it's ops config. Flag for launch checklist.
- [ ] **Service worker (Phase 2).** Spec §11 mentions a PWA SW for offline; defer entirely.
- [ ] **Prefetching adjacent chapters.** Spec §17 flag. Astro `<Link>` can prefetch on hover; add as a later performance optimization with A/B measurement.
- [ ] **CSP for inline scripts.** Theme pre-paint uses `is:inline`; if CSP restricts `script-src`, we need a nonce. Coordinate with seo.md CSP rules. Current default: allow `'self'` + `'unsafe-inline'` for styles only (KaTeX) — for scripts we may need to add nonces or hashes. Flag for seo.md plan review.
- [ ] **Budget for `astro-og-canvas` build time.** Large chapter count will take minutes on first build; caches across builds. Measure after Session 3 first 10 chapters exist.

## 14. References

- Spec: `.claude/specs/shared/performance.md`
- Research: `.claude/plans/RESEARCH.md` Topics 4 (hydration), 8 (Mermaid bundle isolation), 10 (OG caching), 12 (Cloudflare cache headers), 14 (View Transitions perf)
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — BaseLayout, `<ClientRouter />`
  - `.claude/plans/shared/responsive-breakpoints.md` — global.css tokens
  - `.claude/plans/shared/accessibility.md` — Lighthouse CI (shared), scroll restoration
  - `.claude/plans/shared/seo.md` — `_headers` CSP, OG pipeline
- External:
  - [web.dev — Core Web Vitals](https://web.dev/vitals/)
  - [Astro — Assets & Images](https://docs.astro.build/en/guides/images/)
  - [Astro — inlineStylesheets](https://docs.astro.build/en/reference/configuration-reference/#buildinlinestylesheets)
  - [Lighthouse CI docs](https://github.com/GoogleChrome/lighthouse-ci)
  - [Cloudflare Pages — Headers](https://developers.cloudflare.com/pages/configuration/headers/)
