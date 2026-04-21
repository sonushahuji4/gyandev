# Performance runbook

Owner plan: [shared/performance.md](../.claude/plans/shared/performance.md). This document is the operational companion — what to check per page, what the hydration contract is, and how to triage a Core Web Vitals regression.

## Per-page checklist

Before merging a new page or a large content addition, confirm each:

- **LCP element identified.** There is exactly one `<SmartImage priority>` per page on the hero / first-paint element (if the page has an image-dominant LCP). For text-dominant LCP (legal, about, 404), no image needs `priority` — confirm the serif display headline renders without layout shift.
- **Fonts preloaded correctly.** `BaseLayout.astro` mounts `<FontPreload includeSerif={…}>`. Only `home.astro` sets `includeSerif={true}` — Instrument Serif is the home-hero display font. Do not preload JetBrains Mono; it loads lazily via `@font-face` swap.
- **Images use `<SmartImage>`.** Never raw `<img>` in new code. Run `grep -rn "<img " src/` before opening the PR — zero results expected.
- **Above-the-fold CSS fits `global.css`.** Astro inlines it via `inlineStylesheets: 'auto'`. If a page needs extra inline rules, use `<CriticalCSS styles={…}>` — do not add a new `<link rel="stylesheet">`.
- **Third-party embeds wrapped in `<LazyScript>`.** Anything that loads a remote script (giscus, analytics, embeds) must defer until intersection — see the pattern under "LazyScript" below.
- **`npm run check` passes locally.** That chain runs `validate:slugs`, `check:contrast`, and `astro build` — which triggers the `postbuild` bundle-size script enforcing the spec §3 budgets.
- **Lighthouse mobile + desktop recorded.** Attach screenshots to the PR for any page-scope change; CI asserts the thresholds but numbers-in-the-PR speed up review.

## Core Web Vitals budgets

Lab thresholds enforced in CI (`.lighthouserc.js`):

| Metric | Budget | Asserted as |
|---|---|---|
| Performance score | ≥ 0.90 | error |
| Accessibility score | ≥ 0.95 | error |
| SEO score | ≥ 0.95 | error |
| Best-practices score | ≥ 0.90 | warn |
| Largest Contentful Paint | < 2500 ms | error |
| Cumulative Layout Shift | < 0.1 | error |
| Total Blocking Time | < 200 ms | error |

Field budgets (p75, tracked post-launch via Cloudflare Web Analytics): LCP 2.5 s, INP 200 ms, CLS 0.1, FCP 1.8 s, TTFB 0.8 s.

Per-route bundle budgets (`scripts/check-bundle-size.mjs`):

| Bucket | Budget |
|---|---|
| Total page (HTML + referenced JS/CSS/fonts/images) | 500 KB |
| JS total | 100 KB |
| CSS total | 30 KB |
| Fonts total (per page) | 80 KB |
| Images total (per page) | 200 KB |
| HTML (gzipped) | 50 KB |

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

## Regression triage

When CI fails a CWV assertion or `check:bundle` bucket, work the following steps in order.

1. **Identify the regressed bucket.** The `check-bundle-size.mjs` output lists `htmlGz / js / css / fonts / images / total` per route, with any offender flagged. Lighthouse CI's report (uploaded as artifact) highlights which metric fell out of budget and points at the offending element.
2. **Attribute the change.** `git diff` the relevant bundle since the previous green build. Was a new dependency added to `package.json`? A new component hydrated with `client:load` instead of `client:visible`? A new unoptimised image?
3. **Fix at the source.** Do NOT increase the budget. Budgets tune only when a deliberate, reviewed trade-off is recorded in `performance.md`.
4. **Common offenders & fixes:**
    - **JS budget overrun:** a new `client:load` import. Audit the new island's hydration directive — nine times out of ten it should be `client:visible` or `client:idle`. If a heavy dependency was added, see whether an existing one already covers the use case.
    - **CSS budget overrun:** Tailwind JIT usually keeps this tight. Overruns almost always come from an imported third-party stylesheet (e.g. KaTeX) or an unused `@import`. Remove the import or scope it to the route that actually needs it via a page-level `<CriticalCSS>`.
    - **LCP regression:** the LCP image lost its `priority`, or the LCP element changed (e.g. a heavier font became the first paint). Use Lighthouse's "Largest Contentful Paint element" section in the report.
    - **CLS regression:** an iframe, ad slot, or image lost its `width`/`height` reservation. `<SmartImage>` enforces this; raw `<img>` is the usual culprit.
    - **TBT regression:** a long task during hydration. Break the offending island into smaller pieces or move the expensive work to `requestIdleCallback`.
5. **Verify locally.** `npm run build && npx lhci autorun` reproduces the CI verdict without waiting on the job.
6. **If the regression is a genuine product need** (e.g. new hero image that is intentionally high-res): raise it in the PR description, update the spec/plan where the trade-off is recorded, and only then adjust the budget in one place (`BUDGETS` constant in `scripts/check-bundle-size.mjs` or `.lighthouserc.js`).

## Things this doc does NOT cover

- **Field RUM / Cloudflare Web Analytics.** Wired post-launch per PHASE-1-ROADMAP Q#25.
- **Service worker / PWA offline.** Deferred to Phase 2.
- **Prefetching adjacent chapters.** Flagged in `performance.md` open questions; add only after A/B measurement.
