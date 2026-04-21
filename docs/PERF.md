# Performance runbook

Owner plan: [shared/performance.md](../.claude/plans/shared/performance.md). This document is the operational companion — what to check per page, what the hydration contract is, how to monitor in production, and how to triage a Core Web Vitals regression.

## Overview

Targets, at p75 field data:

| Metric | Budget |
|---|---|
| Largest Contentful Paint (LCP) | < 2.5 s |
| Interaction to Next Paint (INP) | < 200 ms |
| Cumulative Layout Shift (CLS) | < 0.1 |
| First Contentful Paint (FCP) | < 1.8 s |
| Time to First Byte (TTFB) | < 0.8 s |

Lab thresholds (Lighthouse CI) are tighter so that a green CI run predicts a green field. If the field p75 slips, raise the alarm in `docs/PERF.md#regression-investigation-protocol` — don't move the lab budget.

## Per-page bundle budgets

Per-route budgets enforced by `scripts/check-bundle-size.mjs` (spec §3, `BUDGETS` constant):

| Bucket | Budget |
|---|---|
| Total page (HTML + referenced JS/CSS/fonts/images) | 500 KB |
| JS total | 100 KB |
| CSS total | 30 KB |
| Fonts total (per page) | 80 KB |
| Images total (per page) | 200 KB |
| HTML (gzipped) | 50 KB |

Per-page JS targets (stricter than the 100 KB ceiling — informational, not enforced):

| Route | Target JS |
|---|---|
| `/` (home) | < 5 KB gzipped |
| `/courses` (all-courses) | < 40 KB |
| `/courses/[course]` (overview) | < 50 KB |
| `/courses/[course]/[chapter]` (Full Notes) | < 500 KB total page; JS closer to 50 KB |
| `/courses/[course]/[chapter]/flow` | exempt from 100 KB JS rule — Mermaid runtime lives here |

Flow is the only route allowed to exceed the 100 KB JS bucket. Mermaid is ~1.5 MB unminified; that's the explicit trade-off for the diagram view and the reason the flow route is a separate URL (`00-infrastructure.md` §6).

## Monitoring stack

| Surface | Tool | When |
|---|---|---|
| Pre-merge lab | Lighthouse CI (`.lighthouserc.cjs`) | Every PR |
| Pre-merge bundle | `scripts/check-bundle-size.mjs` as `postbuild` + explicit CI step | Every PR |
| Post-deploy smoke | `scripts/smoke-deploy.mjs` (PR-6.2) | Every merge to `main` |
| Field RUM | Cloudflare Web Analytics | Post-launch, review weekly |
| Field CWV | Search Console → Experience → Core Web Vitals | Post-launch, review weekly |
| Field CWV (granular) | PageSpeed Insights → field data tab | Per-incident |

Cloudflare Web Analytics is the live p75 source once launched; Search Console lags by ~28 days (CrUX window). Use PageSpeed Insights for a specific URL check — it pulls from the same CrUX dataset but is easier to deep-link.

## Per-page checklist

Before merging a new page or a large content addition, confirm each:

- **LCP element identified.** There is exactly one `<SmartImage priority>` per page on the hero / first-paint element (if the page has an image-dominant LCP). For text-dominant LCP (legal, about, 404), no image needs `priority` — confirm the serif display headline renders without layout shift.
- **Fonts preloaded correctly.** `BaseLayout.astro` mounts `<FontPreload includeSerif={…}>`. Only `home.astro` sets `includeSerif={true}` — Instrument Serif is the home-hero display font. Do not preload JetBrains Mono; it loads lazily via `@font-face` swap.
- **Images use `<SmartImage>`.** Never raw `<img>` in new code. Run `grep -rn "<img " src/` before opening the PR — zero results expected.
- **Above-the-fold CSS fits `global.css`.** Astro inlines it via `inlineStylesheets: 'auto'`. If a page needs extra inline rules, use `<CriticalCSS styles={…}>` — do not add a new `<link rel="stylesheet">`.
- **Third-party embeds wrapped in `<LazyScript>`.** Anything that loads a remote script (giscus, analytics, embeds) must defer until intersection — see the pattern under "LazyScript" below.
- **`npm run check` passes locally.** That chain runs `validate:slugs`, `check:contrast`, `check:csp`, `check:content`, `check:legal`, `astro build` — which triggers the `postbuild` bundle-size script enforcing the spec §3 budgets.
- **Lighthouse mobile + desktop recorded.** Attach screenshots to the PR for any page-scope change; CI asserts the thresholds but numbers-in-the-PR speed up review.

## Pre-deploy checklist

Run this before tagging a release or merging a page-scope PR to `main`:

1. `npm run check` — the full validate + build + postbuild chain. Non-negotiable gate.
2. `npm run check:lhci` — Lighthouse CI locally against `dist/`. Faster than waiting on Actions for the verdict.
3. Visually diff the changed pages in `npm run preview` at mobile width (375×667) and desktop (1440×900). Look for shifts, wrong-priority images, broken fonts.
4. Verify no new render-blocking resources: DevTools Coverage → Start recording, load the page, stop → any > 50 KB unused CSS/JS is a regression.
5. Verify images are `<SmartImage>`, not raw `<img>`. `grep -rn "<img " src/` in the PR diff.
6. Record Lighthouse perf + CWV numbers in the PR description.

## Core Web Vitals budgets (lab)

Lab thresholds enforced in CI (`.lighthouserc.cjs`):

| Metric | Budget | Asserted as |
|---|---|---|
| Performance score | ≥ 0.90 | error |
| Accessibility score | ≥ 0.95 | error |
| SEO score | ≥ 0.90 | error |
| Best-practices score | ≥ 0.90 | error |
| Largest Contentful Paint | < 2500 ms | error |
| Cumulative Layout Shift | < 0.1 | error |
| Total Blocking Time | < 200 ms | error |

## Hydration contract

Every interactive element on the site hydrates via exactly one of the mechanisms below. Picking the right one is the single biggest lever on the 100 KB JS budget — a `client:load` on a component that only needs `client:visible` typically doubles a page's initial JS. If you are adding a new interactive component, match it to the table and flag any new row in the PR description.

| Component | Hydration | Why |
|---|---|---|
| Theme toggle | Inline `<script is:inline>` (no framework wrapper) | Pre-paint set must run before hydration; also needed sync to avoid FOUC. 0 KB framework-side. |
| Bookmark button | Vanilla `<script>` (no framework wrapper) | Stateless DOM mutation; no framework needed. 0 KB. |
| Mobile nav drawer | `client:media="(max-width: 768px)"` | Desktop never hydrates the drawer — the one user segment that needs it pays its cost. |
| Mermaid flow diagrams | `client:visible` (fallback `client:only` if SSR fails) | Large library; only `/flow` routes have a `mermaid` fence. Below-the-fold on most flow pages. |
| Giscus comments | `<GiscusLazy>` (IntersectionObserver) | Third-party iframe; far below the fold; GDPR posture revisited in Phase 1.5. |
| Pagefind search modal | `client:idle` + dynamic `import()` on first open | Search UI irrelevant for most sessions; defer its runtime until the tab is idle. |

Spec §9 is the source of truth; this table mirrors it for glanceability during review.

## LazyScript pattern

Any new third-party script goes through `LazyScript`:

```astro
<LazyScript rootMargin="300px">
  <div slot="placeholder" style="min-height: 400px;" />
  <template slot="script" data-lazy-script>
    <script src="https://example.com/widget.js" async></script>
  </template>
</LazyScript>
```

Requirements:

- The `<template>` must carry `data-lazy-script` — the inline observer uses that selector.
- The placeholder must reserve enough vertical space to match the loaded iframe — otherwise the widget pushes subsequent content down and bumps CLS.
- `rootMargin` trades off bandwidth vs. readiness. Comments section below a long chapter: 400 px. Embedded widget at the bottom of a short page: 200 px.
- If `IntersectionObserver` is unavailable, `LazyScript` injects immediately — degraded UX beats missing UX.

## Common perf issues + fixes

### Fonts causing FOUT / FOIT

Symptom: text reflows ~200 ms after first paint, or blank text until the font downloads. Causes and fixes:

1. **Font not preloaded for an LCP-critical page.** Add `includeSerif={true}` only on `home.astro` — other pages use Inter which is always preloaded in `BaseLayout.astro`.
2. **Preloading a font that is not used above the fold.** The browser will fetch it on the critical path and delay LCP for nothing. Remove the preload; the `@font-face swap` will pick it up lazily.
3. **`font-display` missing or set to `block`.** All faces in `src/styles/fonts.css` must declare `font-display: swap`. `auto` and `block` both allow invisible text up to 3 s.
4. **Variable font file > 80 KB.** Subset more aggressively — Latin-only first, then Latin-Extended only if the character set needs it.

### Third-party script blocking

Symptom: TBT regressed in Lighthouse; a long task > 200 ms appears in the DevTools Performance tab. Causes and fixes:

1. **Script added with a raw `<script src>` instead of `<LazyScript>`.** Wrap it; see the LazyScript pattern above.
2. **`async` missing on a legitimately eager script.** If the script really must run on load, it still needs `async` to avoid blocking the parser.
3. **Analytics added inline rather than via Cloudflare Web Analytics.** CF's script is lazy-loaded, served from first-party edge, and counts as zero KB to our budget. Do not add Google Analytics or Segment.

### Mermaid bundle on non-flow routes

Symptom: `check:bundle` flags JS budget on `/courses/*/index.html` or `/courses/*/revision.html`. Likely cause: an author wrote a ```mermaid fence in `index.mdx` or `revision.mdx`. `scripts/validate-content.mjs` is meant to catch this and reject the MDX at CI time — if it slipped through, fix the validator first, then remove the fence.

If the fence is legitimately needed outside the flow route, do not relax the validator. Re-author the content so the diagram lives in `flow.mdx` and the other views link to the flow tab.

### Giscus CLS

Symptom: CLS jumps when the comments section scrolls into view. Cause: the Giscus iframe loads to a different height than the placeholder.

Fix in `GiscusLazy.astro` — adjust the placeholder `min-height` to match the loaded iframe height for the typical thread size (240 px for short threads; raise to 400 px once chapters have > 10 comments). `IntersectionObserver rootMargin="400px"` gives the iframe a chance to load before it scrolls into the viewport, reducing the visible shift.

### LCP image not prioritized

Symptom: Lighthouse "Largest Contentful Paint element" audit shows an image that is not marked `priority`. Fix: one and only one `<SmartImage priority>` per page. The layout itself never sets `priority` — the page decides which image is LCP.

### CSS budget overrun

Symptom: `check:bundle` prints `route X exceeds CSS budget`. Cause: almost always an imported third-party stylesheet (KaTeX is the historical offender) or an unused `@import` left behind after a refactor.

Fix: remove the import, or scope it to the one route that needs it via a page-level `<CriticalCSS styles={…}>`. Do not add the stylesheet to `global.css`.

## Regression investigation protocol

When CI fails a CWV assertion, or post-deploy field data slips, work this in order.

### 1. Confirm the regression is real

- Lab: a single Lighthouse run can flake by ±5%. Check the run count — `.lighthouserc.cjs` sets `numberOfRuns: 3` with median aggregation. If one of three runs failed but the median passed, the assertion is correctly green. If the median failed, it's real.
- Field: wait for ≥ 7 days of data before calling a CrUX regression real. One bad day after a deploy can still land the p75 within budget.

### 2. Attribute the change

- Lab regression on a specific PR: `git diff` the offending bundle. Was a new dependency added? A `client:load` substituted for `client:visible`? A new unoptimized image?
- Field regression without a PR trigger: open Search Console → Core Web Vitals → Poor URLs. Check whether one URL or many. If many, suspect an asset or config change. If one, suspect content (a large image, a new embed).

### 3. Pull the data

Checklist for a field investigation:

- **Search Console → Core Web Vitals** (Mobile + Desktop tabs). Trend charts and the "Poor URLs" group name the affected URLs.
- **PageSpeed Insights** against one affected URL. The "Field data" section shows p75 numbers + distribution. The "Diagnose performance issues" section mirrors Lighthouse.
- **Lighthouse CI history** — GitHub Actions artifact from a recent run, uploaded to `temporary-public-storage`. The per-metric timeline tells you when the regression started.
- **Cloudflare Web Analytics → Core Web Vitals** (post-launch). Live p75 across the whole site, filterable by URL.

### 4. Fix at the source

Do not raise the budget. Work from the list under "Common perf issues + fixes" above; each one points at a root cause.

### 5. Verify locally

```sh
npm run build && npx lhci autorun --config=.lighthouserc.cjs
```

Reproduces the CI verdict without waiting on the job. Runs are fast (~30 s per URL).

## Regression triage (per-budget playbook)

Legacy section kept for the CI failure case — use this when `check:bundle` or a specific metric fails.

1. **Identify the regressed bucket.** The `check-bundle-size.mjs` output lists `htmlGz / js / css / fonts / images / total` per route, with any offender flagged. Lighthouse CI's report (uploaded as artifact) highlights which metric fell out of budget and points at the offending element.
2. **Attribute the change.** `git diff` the relevant bundle since the previous green build.
3. **Fix at the source.** Do NOT increase the budget. Budgets tune only when a deliberate, reviewed trade-off is recorded in `performance.md` — see "Budget adjustment process" below.
4. **Common offenders & fixes:**
    - **JS budget overrun:** a new `client:load` import. Audit the new island's hydration directive — nine times out of ten it should be `client:visible` or `client:idle`.
    - **CSS budget overrun:** see "CSS budget overrun" above.
    - **LCP regression:** the LCP image lost its `priority`, or the LCP element changed.
    - **CLS regression:** an iframe, ad slot, or image lost its `width`/`height` reservation. `<SmartImage>` enforces this; raw `<img>` is the usual culprit.
    - **TBT regression:** a long task during hydration. Break the offending island into smaller pieces or move the expensive work to `requestIdleCallback`.
5. **Verify locally.** `npm run build && npx lhci autorun` reproduces the CI verdict.

## Budget adjustment process

Budgets are not tuned to make CI pass. They are tuned when a deliberate product trade-off is made. The process:

1. **Document the trade-off in the PR description.** Why is the new weight / metric worth the cost? What user-visible improvement buys back the regression?
2. **Update the owner plan.** The relevant section of [shared/performance.md](../.claude/plans/shared/performance.md) — spec §3 for bundle budgets, §2 for CWV targets — is updated in the same PR. This keeps the spec and the CI in lock-step.
3. **Update exactly one config file.**
    - Bundle budget → `BUDGETS` constant in `scripts/check-bundle-size.mjs`.
    - CWV assertion → corresponding entry in `.lighthouserc.cjs` `assertions`.
    - Never duplicate a budget across files.
4. **Get a second reviewer.** Budget changes are architecture changes. Require approval from someone who was not the author of the change that exceeded the old budget.
5. **Re-run the field monitor for two weeks.** If field p75 slips after the new budget lands, revert the budget and the feature.

The one-way door: raising a budget is cheap; the feature that prompted it usually stays. Raise only when the cost is understood and accepted, not as a way to unblock a merge.

## Things this doc does NOT cover

- **Field RUM / Cloudflare Web Analytics.** Wired post-launch per PHASE-1-ROADMAP Q#25.
- **Service worker / PWA offline.** Deferred to Phase 2.
- **Prefetching adjacent chapters.** Flagged in `performance.md` open questions; add only after A/B measurement.
- **CSP nonce hardening.** Phase 2; Phase 1 ships `'unsafe-inline'` + `'wasm-unsafe-eval'` with the trade-off recorded in `_headers`.

## Resources

- [web.dev — Core Web Vitals](https://web.dev/vitals/) — the normative definitions + current thresholds.
- [web.dev — Optimize LCP](https://web.dev/articles/optimize-lcp) / [Optimize INP](https://web.dev/articles/optimize-inp) / [Optimize CLS](https://web.dev/articles/optimize-cls).
- [PageSpeed Insights](https://pagespeed.web.dev/) — per-URL field + lab view.
- [CrUX Dashboard](https://g.co/chromeuxdash) — origin-level CrUX without Search Console.
- [Astro — Assets & Images](https://docs.astro.build/en/guides/images/).
- [Astro — inlineStylesheets](https://docs.astro.build/en/reference/configuration-reference/#buildinlinestylesheets).
- [Lighthouse CI docs](https://github.com/GoogleChrome/lighthouse-ci).
- [Cloudflare Pages — Headers](https://developers.cloudflare.com/pages/configuration/headers/).
