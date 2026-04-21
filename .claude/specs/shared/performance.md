# Performance Spec — Placeholder (content coming)
Replace the contents of .claude/specs/shared/performance.md with this exact content:

---
title: GyanDev — Performance Budgets and Standards
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
applies_to: all pages
---

# Performance Budgets and Standards

Performance is a feature. A slow site loses readers before they reach the content. This spec defines the non-negotiable performance budgets every page must meet.

## 1. Why Performance Matters

- **Reader retention**: 53% of mobile users abandon sites that take >3s to load (Google)
- **SEO**: Core Web Vitals are a direct Google ranking factor since 2021
- **Reach**: Our audience includes developers in India, Southeast Asia, Africa — often on 3G/4G networks
- **Battery**: Heavy JS drains mobile batteries, excludes users with old devices

## 2. Core Web Vitals Targets (Non-Negotiable)

All measured at **p75 field data** via Chrome UX Report (CrUX) / Search Console:

| Metric | Target | What It Measures |
|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s | Time to render the largest visible element |
| **INP** (Interaction to Next Paint) | < 200ms | Responsiveness to user input |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability (no jumping layout) |

Additional metrics to monitor:
| Metric | Target |
|---|---|
| **FCP** (First Contentful Paint) | < 1.8s |
| **TTFB** (Time to First Byte) | < 0.8s |
| **TBT** (Total Blocking Time) | < 200ms |

## 3. Page Weight Budgets

Per-page limits enforced in CI:

| Resource | Budget | Notes |
|---|---|---|
| Total page weight | < 500KB | Excludes video/interactive media |
| JavaScript (first-party) | < 100KB gzipped | Astro ships near-zero JS by default |
| JavaScript (total, incl. third-party) | < 150KB gzipped | Including Giscus, Mermaid when loaded |
| CSS | < 30KB gzipped | Tailwind purged + critical CSS inlined |
| Fonts | < 80KB (woff2) | Max 2 weights preloaded |
| Images (per page) | < 200KB | Hero + diagrams combined |
| HTML | < 50KB gzipped | Chapter pages shouldn't be massive |

## 4. LCP Optimization

The LCP element on most pages is either:
- **Home page**: Hero tagline (text) or first course card image
- **Chapter page**: Chapter title (text) — easy target

### Rules
- **Preload** the LCP image if it's an image: `<link rel="preload" as="image" href="..." fetchpriority="high">`
- **Never lazy-load** the LCP element
- **Inline critical CSS** for above-the-fold content
- **Preconnect** to external font origins (if any): `<link rel="preconnect" href="...">`
- **Self-host fonts** — no Google Fonts runtime fetching (GDPR + perf)

### LCP checklist per page
- [ ] LCP element identified (use Lighthouse)
- [ ] Not blocked by render-blocking resources
- [ ] If image: optimized format (AVIF > WebP > JPEG)
- [ ] If text: font loaded with `font-display: swap`

## 5. INP Optimization

Interactions that commonly cause INP issues:
- Theme toggle (re-rendering, CSS recalc)
- Tab switcher (Full Notes ↔ Revision ↔ Flow)
- Search modal open
- Chapter navigation (prev/next)

### Rules
- **Avoid long tasks** — break up work with `scheduler.yield()` or `requestIdleCallback`
- **Debounce/throttle** scroll handlers (TOC highlighting) — max 60fps
- **Virtualize** long lists if > 100 items (not expected in Phase 1)
- **No blocking main thread** > 50ms per task
- **Lazy-hydrate** Astro islands — components load only when needed

### Specific optimizations
- Theme toggle: CSS custom properties only, no DOM re-rendering
- Tab switching: show/hide via `hidden` attribute, not remount
- Search: load Pagefind JS only on first ⌘K press

## 6. CLS Optimization

CLS happens when elements shift unexpectedly during load.

### Common causes we must prevent
- **Images without dimensions** → always set `width` and `height`
- **Web fonts loading** → use `font-display: swap` + preload
- **Ads/embeds loading** → reserve space with `min-height`
- **Dynamic content injection** → use skeleton placeholders

### Rules
- Every `<img>` has `width` and `height` attributes
- Every `<iframe>` (e.g., Giscus) has reserved height
- Skeleton screens for dynamic content (search results, comments)
- Never inject content above existing content (insert below only)

## 7. Image Optimization

### Format priority
1. **AVIF** (best compression, 95%+ browser support in 2026)
2. **WebP** (fallback for older browsers)
3. **JPEG/PNG** (fallback for Safari <14)

### Delivery pattern
```html
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="..." width="800" height="450" loading="lazy">
</picture>
```

### Responsive images
Always use `srcset` for content images:
```html
<img
  srcset="img-400.webp 400w, img-800.webp 800w, img-1600.webp 1600w"
  sizes="(max-width: 768px) 100vw, 800px"
  src="img-800.webp"
  alt="..."
  width="800" height="450"
  loading="lazy"
>
```

### Build-time optimization
- Astro's built-in `<Image>` component handles format conversion + sizing
- Never use raw `<img>` for content — use `<Image>` for automatic optimization
- SVG for diagrams (infinite scale, tiny file size)

## 8. Font Optimization

### Self-host always
- **No Google Fonts runtime fetching** (GDPR violation, 2022 Munich ruling)
- Use `@fontsource` packages or manually downloaded woff2
- Serve from same origin

### Loading strategy
```html
<link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin>
```

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;          /* variable font range */
  font-display: swap;            /* show fallback until loaded */
  font-style: normal;
}
```

### Rules
- Preload only **LCP-critical** fonts (1 weight, max 2)
- Variable fonts preferred (single file, all weights)
- Subset fonts to Latin + Latin Extended (no full Unicode range)
- `font-display: swap` — never `block` (causes invisible text)

## 9. JavaScript Optimization

### Astro-specific advantages
- Astro renders to static HTML by default — zero JS
- "Islands" architecture: interactive components opt-in via `client:*` directives
- Only ship JS for what's actually interactive

### Hydration strategy
| Directive | When to use |
|---|---|
| `client:load` | Interactive immediately (rare — e.g., theme toggle) |
| `client:idle` | Nice-to-have interactions (e.g., share buttons) |
| `client:visible` | Only when scrolled into view (e.g., Mermaid diagrams) |
| `client:media` | Only at certain breakpoints (e.g., mobile nav) |
| `client:only` | Client-only rendering (e.g., Giscus comments) |

### Rules
- **Default to no JS** — static HTML first
- **Measure per page**: Lighthouse "Total JavaScript" metric
- **Tree-shake imports**: `import { specific } from 'lib'` not `import * as lib`
- **Dynamic imports** for large deps (e.g., Mermaid loads only on flow pages)

## 10. CSS Optimization

### Critical CSS
Above-the-fold CSS must be inlined in `<head>`:
- Header styles
- Hero styles
- Typography basics
- Theme tokens (CSS variables)

Remaining CSS loads asynchronously.

### Tailwind purging
Tailwind v4 auto-purges unused utilities in production. Build output should be < 30KB gzipped.

### Rules
- **No CSS-in-JS** — adds runtime cost
- **No animation on main thread** — use `transform` and `opacity` only (GPU-accelerated)
- **Avoid `@import`** in CSS — blocks parallel loading
- **Minify** via Astro's built-in Vite pipeline

## 11. Caching Strategy

### Cloudflare Pages defaults
Static assets get long cache + immutable headers automatically.

### Custom headers via `public/_headers`
```
/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/images/*
  Cache-Control: public, max-age=31536000, immutable

/*
  Cache-Control: public, max-age=0, must-revalidate
```

### Service worker (Phase 2)
- Precache shell (header, footer, global CSS)
- Runtime cache for visited chapters
- Offline fallback page

## 12. Third-Party Services

Every third-party script is a performance cost. Current list:

| Service | Purpose | Weight | Loading |
|---|---|---|---|
| Giscus | Comments | ~40KB | Deferred, on-scroll |
| Cloudflare Analytics | Analytics | ~5KB | Async |
| Mermaid | Flow diagrams | ~300KB | Only on `/flow` pages, client:visible |

### Rules
- Load only when needed
- Defer non-critical scripts
- Monitor Core Web Vitals impact before adding any new service
- No tracking scripts (we use Cloudflare Analytics, cookie-less)

## 13. Build-Time Optimization

### Astro build pipeline
- Minifies HTML, CSS, JS
- Generates AVIF/WebP variants
- Creates responsive image sets
- Inlines critical CSS
- Generates sitemap

### Build time budget
| Build type | Target |
|---|---|
| Full production build | < 60s |
| Incremental dev build | < 2s |
| Hot module replacement | < 500ms |

If builds slow down significantly, profile with `astro build --verbose`.

## 14. Monitoring in Production

### Cloudflare Web Analytics
- Real User Monitoring (RUM) data
- Core Web Vitals dashboard
- No cookies, no PII
- Free

### Google Search Console
- Core Web Vitals report (field data)
- Pages with poor LCP/INP/CLS highlighted
- Weekly check-ins

### PageSpeed Insights (CI)
- Run on every deploy via GitHub Actions
- Lab scores for LCP/INP/CLS/FCP/TBT
- Fails build if scores drop below thresholds

### Sentry Performance (Phase 2)
- Tracks actual user experience
- Alerts on regressions
- Free tier: 10K events/month

## 15. Performance Testing

### Local testing
```bash
npm run build
npm run preview
# Open Lighthouse in Chrome DevTools
# Run "Performance" audit
```

### Network throttling
Test on simulated:
- **Slow 4G** (400Kbps, 400ms RTT) — rural markets
- **Fast 3G** (1.6Mbps, 150ms RTT) — emerging markets
- **Offline** — service worker behavior (Phase 2)

### Device testing
- Low-end Android (Moto G Power class)
- iPhone SE (2020) — smallest common viewport
- iPad (for tablet-specific issues)

### Pre-launch testing
- [ ] PageSpeed Insights: 90+ mobile, 95+ desktop
- [ ] Lighthouse Performance: 90+
- [ ] WebPageTest on 4G: LCP < 3s
- [ ] No render-blocking resources > 500ms
- [ ] CLS < 0.1 with font swap

## 16. Optimization Checklist (Per Page)

Before any page ships to production:

### Load optimization
- [ ] LCP image preloaded (if applicable)
- [ ] Fonts preloaded (LCP-critical only)
- [ ] Critical CSS inlined
- [ ] No render-blocking JS
- [ ] Third-party scripts deferred

### Asset optimization
- [ ] Images in AVIF/WebP with JPEG fallback
- [ ] Images have width/height attributes
- [ ] Below-fold images lazy-loaded
- [ ] No unused CSS (Tailwind purged)
- [ ] No unused JS (tree-shaken)

### Interaction optimization
- [ ] INP < 200ms on all interactive elements
- [ ] Theme toggle uses CSS vars only
- [ ] Tab switching uses CSS, not remount
- [ ] Search lazy-loaded on first trigger

### Stability
- [ ] CLS < 0.1 tested with throttled network
- [ ] Font swap doesn't cause layout shift
- [ ] Iframes (Giscus) have reserved height
- [ ] No content injection above existing content

## 17. Regression Prevention

### CI checks
- Lighthouse CI on every PR (fails build if budget exceeded)
- Bundle size monitoring (e.g., `bundlesize` package)
- Image size limits in pre-commit hook

### Weekly review
- Cloudflare Analytics: check Core Web Vitals trends
- Search Console: review pages flagged as "Poor" or "Needs Improvement"
- User reports: tag and triage performance complaints

## 18. Success Criteria

This spec is complete when:
- [ ] All page types meet CWV targets in CrUX field data
- [ ] Page weight budgets enforced in CI
- [ ] Font strategy documented and implemented
- [ ] Third-party scripts audited and deferred
- [ ] Monitoring dashboards set up
- [ ] Pre-launch checklist used for every page type

## 19. Open Questions

- [ ] Budget for PWA service worker (~30KB)? — Phase 2
- [ ] Should we use Cloudflare Image Resizing ($$)? — probably no, Astro built-in is sufficient
- [ ] HTTP/3 via Cloudflare? — enabled by default, no action needed
- [ ] Prefetching adjacent chapters? — test impact in Phase 2

## 20. References

- web.dev Core Web Vitals: https://web.dev/vitals/
- PageSpeed Insights: https://pagespeed.web.dev/
- Cloudflare Analytics: https://www.cloudflare.com/analytics/
- Astro Performance Guide: https://docs.astro.build/en/guides/performance/
- Plan: [plans/shared/performance.md](../../plans/shared/performance.md) *(to be created)*

After saving, do NOT commit. Do NOT create any other files. Just overwrite this file and confirm.