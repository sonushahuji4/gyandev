---
title: GyanDev Phase 1 — Implementation Roadmap
status: final
created: 2026-04-20
session: 4
owner: sonushahuji4
supersedes: shared/website-overview.md (roadmap sections)
---

# Phase 1 Implementation Roadmap

This document is the single source of truth for executing Phase 1. It composes Sessions 1–3 into a sequenced, PR-shaped work plan and records the Session-4 cross-check ratifications that every implementation PR must respect.

Read before starting any implementation PR:

- [SESSION-LOG.md](./SESSION-LOG.md) — full decision history across 4 planning sessions.
- [RESEARCH.md](./RESEARCH.md) — 14 topic briefs + cross-cutting technical decisions.
- [00-infrastructure.md](./00-infrastructure.md) — binding infrastructure decisions (not a complete plan; see §11 of this roadmap).
- Shared plans under [shared/](./shared/) — routing, responsive, a11y, performance, seo, website-overview.
- Page plans under [pages/](./pages/) — 404, legal, about, all-courses, course-overview, home, chapter.

---

## 1. Executive Summary

**What we're building.** A content-first technical education site (GyanDev) on Astro 6 + MDX + Tailwind v4 + Cloudflare Pages. Every chapter has three synchronized views (Full Notes / Quick Revision / Flow Diagram) implemented as three routes sharing a persisted shell via `<ClientRouter />` + `transition:persist="chapter-shell"`.

**Scope of Phase 1.** Eleven route files (home, all-courses, course-overview, chapter × 3, about, privacy, terms, 404, courses index) backed by three content collections (`courses`, `chapters`, `chapterViews`) plus three data collections (`legal`, `site`, `featured`). No backend, no auth; `localStorage` holds progress + prefs. Pagefind for search, Giscus for comments (lazy), Shiki for highlighting, Mermaid on Flow route only, KaTeX for math, astro-og-canvas for per-page OG PNGs, `@astrojs/sitemap` for `sitemap-index.xml`, hand-rolled RSS/Atom/JSON Feed.

**Effort estimate.** 7 sprints, ~4–6 weeks at a single-contributor cadence. Chapter page dominates (≈14–18h). Schema enrichment is a single-PR coordination (must land first) to avoid merge conflicts across four page plans.

**Biggest risks.**
1. `astro-og-canvas` 0.9.x stability on Astro 6 at implementation time → fallback `astro-satori`.
2. Pagefind WASM under CSP (mitigated by ratified `'wasm-unsafe-eval'` in §8 below).
3. Mermaid re-init under `<ClientRouter />` swaps (spike in Sprint 5 before chapter ships).
4. Font licensing sign-off still outstanding (blocks Sprint 1 unless confirmed).
5. Schema-enrichment drift if four page plans land parallel PRs instead of one coordinated PR.

---

## 2. Session-4 Ratifications (binding)

Five contradictions / gaps were found in the cross-check. These ratifications override the per-plan wording where they conflict.

### R1. Unified `localStorage` / `sessionStorage` key scheme

**Rule.** All keys use `gyandev:v1:<domain>:<id-or-field>`. All envelopes are `{ v: 1, data: {...} }`. `src/lib/storage.ts` exposes builders; no plan or script constructs keys by string concatenation.

| Purpose | Canonical key |
|---|---|
| Theme pref | `gyandev:v1:prefs:theme` |
| Active tab pref | `gyandev:v1:prefs:activeTab` |
| Per-course read set | `gyandev:v1:progress:<courseSlug>` |
| Last-read pointer | `gyandev:v1:progress:lastRead` |
| Bookmarks | `gyandev:v1:bookmarks` |
| Scroll restoration map | `gyandev:v1:scroll` |
| Continue-card dismissal (sessionStorage) | `gyandev:v1:dismiss:continue` |

**Why.** Three prefix styles coexisted across plans (plain, dotted-version, colon-domain). Unifying on the colon-domain scheme with an explicit `v1` segment lets us diff-check key usage, centralize migration logic in `storage.ts`, and avoid misreads.

**How to apply.** Storage plan (§11.1 below) implements `progressKey(courseSlug)`, `prefsKey(field)`, `dismissKey(id)`, `lastReadKey()`, `bookmarksKey()`, `scrollKey()`. Update routing plan, responsive plan, a11y plan, home.md, all-courses.md, course-overview.md, chapter.md to import from `src/lib/storage.ts` instead of string literals. Touch every reference in a single grep-driven pass when `storage.ts` lands.

### R2. `includeSerif` prop wiring

**Rule.** `BaseLayout.astro` accepts `includeSerif?: boolean` (default false). It is forwarded to `<FontPreload includeSerif={includeSerif}>` inside `<head>`. `PageShell.astro` also accepts and forwards `includeSerif` to `BaseLayout`. Only `home.astro` sets `includeSerif={true}`.

**Why.** home.md proposed this as an extension to responsive-breakpoints.md; the wiring path was unspecified (PageShell vs BaseLayout). The performance plan's FontPreload assumes `includeSerif` but nobody owned plumbing it. One prop, three forwards.

**How to apply.** Update routing-and-urls.md §7 (BaseLayout Props) and responsive-breakpoints.md Step 11 (PageShell Props) to list `includeSerif?: boolean`. FontPreload in performance.md Step 3 already documents the head-level behavior.

### R3. `transition:persist="chapter-shell"` scope

**Rule.** The persisted shell region contains **TopNav + breadcrumbs + tab bar only**. The chapter `<h1>` lives inside `ChapterHeader` in the main content slot and swaps with each tab transition so that `view-transition-a11y.ts` can land focus on the fresh H1.

**Why.** routing-and-urls.md §3.4 said "header + tab bar + title region" while responsive-breakpoints.md Step 12 said "TopNav + tab bar"; the a11y focus-restoration contract requires H1 to swap. The narrower scope is correct.

**How to apply.** Update routing-and-urls.md §3.4 + Step 10 to "TopNav + breadcrumbs + tab bar (H1 swaps with content)". responsive-breakpoints.md Step 12 already matches. Reinforce in chapter.md ChapterShell section.

### R4. CSP adds `'wasm-unsafe-eval'`

**Rule.** The `script-src` directive in `public/_headers` includes `'wasm-unsafe-eval'` so Pagefind's WASM search engine runs under CSP.

Final CSP value (seo.md Step 16):
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://giscus.app; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://giscus.app; frame-src https://giscus.app; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

**Why.** seo plan's CSP didn't allow WASM; Pagefind will fail at runtime.

**How to apply.** Update seo.md Step 16. Add a CSP smoke-test CI step that opens `/search` headless and fails on any CSP violation.

### R5. CI workflow is `ci.yml` from the start

**Rule.** The single CI workflow lives at `.github/workflows/ci.yml`. Accessibility plan Step 11 creates it at that path (not `a11y.yml`); performance and seo plans append steps rather than renaming.

**Why.** Two plans implicitly renamed the file; a rename commit is wasteful and error-prone.

**How to apply.** Update accessibility.md Step 11 filename from `a11y.yml` → `ci.yml`. Update performance.md Step 14 and seo.md Step 21 to say "extend `ci.yml`" not "rename".

### R6. Content-collections file path

**Rule.** `src/content.config.ts` (root-level) is canonical. Astro 5+ Content Layer supports this location and all 7 plans use it. CLAUDE.md has already been aligned (commit `f72f8ce`).

### R7. `_redirects` owner

**Rule.** `public/_redirects` is exclusively owned by `routing-and-urls.md`. No other plan adds entries. www→apex is a Cloudflare Redirect Rule, not a `_redirects` entry.

### Remaining soft drifts (not ratified, tracked)

- Per-page component `CourseCard` (defined in all-courses.md, reused by home.md) → promote to `src/components/ui/CourseCard.astro` in Sprint 4 when the second consumer lands. Tracked below under §9 (Post-launch housekeeping).
- `ChapterRenderer` → promote to `src/components/content/ChapterRenderer.astro` in Sprint 5 (per chapter.md flag).
- Progress scripts consolidation (3 scripts → 1 `progress.ts` module) → Phase 1.5 housekeeping, not a Phase 1 blocker.

---

## 3. Dependency Graph

```
┌─────────────────────────────────────────────────┐
│          Sprint 0: Infrastructure               │
│   storage.ts • .env.example • CI skeleton       │
│   content.config.ts (stub) • BaseLayout stub    │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│            Sprint 1: Shared Primitives          │
│                                                 │
│   routing-and-urls (BaseLayout, routes, slugs)  │
│           │                                     │
│           ▼                                     │
│   responsive-breakpoints (tokens, shells, CSS)  │
│           │                                     │
│           ▼                                     │
│   accessibility (a11y primitives + CI axe/LHCI) │
│           │                                     │
│           ▼                                     │
│   performance (SmartImage, LazyScript, fonts)   │
│           │                                     │
│           ▼                                     │
│   seo (SEO, JsonLd, OG route, sitemap, feeds)   │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│   Sprint 2: Shell validators + editorial pages  │
│   404 (shell smoke test) → legal → about        │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│      Sprint 3: Schema enrichment + catalog      │
│   content.config.ts (courses + chapters done)   │
│   aggregate.ts + progress-hydrate.ts            │
│   all-courses page + CourseCard                 │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│           Sprint 4: Course + Home               │
│   course-overview (depends on Sprint-3 schema)  │
│   home (reuses CourseCard, adds featured)       │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│            Sprint 5: Chapter (capstone)         │
│   chapterViews collection • ChapterLayout       │
│   LeftSidebar • RightTOC • chapter-hydrate      │
│   Giscus + Mermaid + Pagefind integration       │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│            Sprint 6: Launch readiness           │
│   Footer • Deploy smoke tests • ops runbooks    │
│   Search Console • CF Redirect Rule • DNS       │
└─────────────────────────────────────────────────┘
```

---

## 4. PR-Shaped Work Breakdown

Each PR lists files touched, rough effort, blockers, and acceptance. Effort units: XS (< 1h), S (1–3h), M (3–6h), L (6–10h), XL (10h+).

### Sprint 0 — Infrastructure Bootstrap (4 PRs)

- **PR-0.1 `feat: add storage utility + .env.example + nvmrc` (M)**
  - `src/lib/storage.ts` (versioned envelope, key builders per §2.R1, migrations stub, `pagehide` flush, `storage`-event cross-tab).
  - `.env.example` with `PUBLIC_GOOGLE_VERIFY`, `PUBLIC_BING_VERIFY`, `PUBLIC_GISCUS_REPO`, `PUBLIC_GISCUS_REPO_ID`, `PUBLIC_GISCUS_CATEGORY_ID`.
  - `.nvmrc` (already exists — verify).
  - Unit tests for storage envelope + migration.
  - Blocks: nothing. Acceptance: `import { progressKey, lastReadKey, ... } from '~/lib/storage'` type-checks.

- **PR-0.2 `feat: CI skeleton (ci.yml)` (S)**
  - `.github/workflows/ci.yml` with Node 22 matrix, `npm ci`, `npm run check`, `npm run build`. Placeholder steps for contrast / axe / Lighthouse / schema / bundle (filled in later sprints).
  - `.github/pull_request_template.md` with a11y + perf + seo checklist stubs.
  - Acceptance: green CI on main.

- **PR-0.3 `feat: content collections stub` (S)**
  - `src/content.config.ts` with empty `courses` + `chapters` collections (routing plan Step 2). Keeps strict Zod basics for slug derivation.
  - `src/content/courses/` directory with `.gitkeep`.
  - Acceptance: `astro sync` succeeds.

- **PR-0.4 `feat: BaseLayout skeleton` (S)**
  - `src/layouts/BaseLayout.astro` with `title`, `description`, `canonical`, `noindex`, `robotsExtra`, and ratified `includeSerif` props.
  - No `<ClientRouter />` yet (Sprint 1).
  - Emits `<html lang="en" data-theme="light">`, `<meta name="viewport">`, skeleton head slots.
  - Acceptance: importable from any page stub.

### Sprint 1 — Shared Primitives (5 PRs, executed in order)

- **PR-1.1 `feat(shared): routing-and-urls` (L)** — 15 steps per routing-and-urls.md §6. Files: `astro.config.mjs`, `src/lib/paths.ts`, `src/lib/routes.ts`, BaseLayout canonical/robots, 11 route stubs, `public/_headers` (baseline security only — cache + CSP added in later PRs), `public/_redirects`, `scripts/validate-slugs.mjs`.
- **PR-1.2 `feat(shared): design tokens + responsive shells` (L)** — 16 steps per responsive-breakpoints.md. Files: `src/styles/global.css` (@theme, @custom-variant dark, @layer base dark overrides), `src/scripts/theme-init.ts`, `ThemeToggle`, `TopNav`, `Drawer`, `BottomSheet`, `SearchModal`, `LeftSidebar`, `RightTOC`, `PageShell` (with `includeSerif` per R2), `ChapterShell` (persist key per R3), `prose.css`, `code.css`, `TouchTarget`.
- **PR-1.3 `feat(shared): a11y primitives + CI gates` (L)** — 15 steps per accessibility.md. Files: `SkipLink`, `VisuallyHidden`, `LiveRegion`, `src/lib/a11y/announce.ts`, `keybindings.ts`, `view-transition-a11y.ts`, `TabList` + `TabLink` (with `disabled?: boolean` per Session-3 extension), `FigureDescribed`, BaseLayout mounts, `scripts/check-contrast.mjs`, `ci.yml` extensions (per R5).
- **PR-1.4 `feat(shared): perf helpers + cache headers` (M)** — 15 steps per performance.md. Files: fonts in `public/fonts/` (license sign-off gate — see §10), `src/styles/fonts.css`, `FontPreload` (wired for `includeSerif`), `CriticalCSS`, `SmartImage`, `LazyScript`, `GiscusLazy`, `_headers` cache entries, `scripts/check-bundle-size.mjs`, `.lighthouserc.js`, CI extensions.
- **PR-1.5 `feat(shared): seo + OG + sitemap + feeds + CSP` (L)** — 21 steps per seo.md. Files: `src/lib/seo/meta.ts`, `SEO`, `jsonld.ts` (with `websiteSchema`, `techArticleSchema`, `courseSchema`, `breadcrumbSchema`, `personSchema`, `aboutPageSchema`, `courseListSchema` — all factories in one PR to avoid follow-up), `JsonLd`, `Breadcrumbs`, `src/pages/og/[...slug].png.ts`, `/og/default.png`, sitemap config with filter (excludes `/revision`, `/flow`, `/404`, `/search`, coming-soon courses), `feeds.ts`, RSS/Atom/JSON Feed endpoints, `robots.txt`, `_headers` CSP (per R4), `scripts/validate-schema.mjs`, `submit-sitemap.mjs`, env vars.

### Sprint 2 — Shell validators + editorial pages (3 PRs, parallel-safe)

- **PR-2.1 `feat(page): 404` (S)** — 7 steps per 404.md. First page to land: smoke-tests the shell end-to-end. Adds `"404"` to `RESERVED_SLUGS`.
- **PR-2.2 `feat(page): legal (privacy + terms) + freshness check` (M)** — 11 steps per legal.md. Adds `legal` content collection + `LegalLayout` + `scripts/check-legal-freshness.mjs`.
- **PR-2.3 `feat(page): about + site data collection` (M)** — 14 steps per about.md. Adds `site` data collection + `AboutLayout` + `about.yml`. Depends on `personSchema` / `aboutPageSchema` landed in PR-1.5.

### Sprint 3 — Schema Enrichment + Catalog (2 PRs, PR-3.1 blocks PR-3.2)

- **PR-3.1 `feat: enrich courses + chapters schemas` (M)** — **Single coordinated PR.** Adds all fields required by all-courses, course-overview, chapter, home plans to `src/content.config.ts`. No page code changes in this PR. Includes: `courses` enrichment (title, description, order, status, difficulty, icon?, learningObjectives, prerequisites, related, updated), `chapters` enrichment (title, description, course ref, order, season, difficulty, type, readingMinutes, status, published, updated, tags). Seeds one real course (e.g., `javascript`) with ≥ 3 chapter `index.mdx` stubs so downstream sprints have test data.
- **PR-3.2 `feat(page): all-courses + aggregate + progress-hydrate` (L)** — 12 steps per all-courses.md. Files: `src/lib/courses/aggregate.ts`, `src/scripts/progress-hydrate.ts`, `CoursesHeader`, `CourseGrid`, `CourseCard`, `CompletionBanner`, `RequestCourseCTA`, `src/pages/courses/index.astro`. Adds `courseListSchema()` already landed in PR-1.5. Progress reads use `progressKey(courseSlug)` from `storage.ts`.

### Sprint 4 — Course + Home (2 PRs, parallel-safe once PR-3.2 lands)

- **PR-4.1 `feat(page): course-overview` (L)** — 17 steps per course-overview.md. Files: `src/lib/courses/bySlug.ts`, `src/scripts/course-overview-hydrate.ts`, 10 page components, noindex variant for coming-soon, progress widget with `role="progressbar"`, Resume CTA swap. Sitemap filter already excludes coming-soon per PR-1.5.
- **PR-4.2 `feat(page): home + featured collection` (L)** — 14 steps per home.md. Files: `featured` collection (`src/content/featured.yml`), `src/lib/home/featured.ts`, `src/lib/home/recent.ts`, `src/scripts/home-hydrate.ts`, `HomeHero`, `ContinueReadingCard`, `FeaturedStrip`, `ChapterCard`, `RecentlyUpdatedList`, `src/pages/index.astro`. Sets `includeSerif={true}` on PageShell. Promotes `CourseCard` to `src/components/ui/CourseCard.astro` (housekeeping — see §9).

### Sprint 5 — Chapter (capstone)

- **PR-5.0 `spike: Mermaid re-init under ClientRouter` (S)** — Risk-buy-down before PR-5.1. 2 hours max. Verify Mermaid SVGs re-render on `astro:page-load`. If broken, evaluate `rehype-mermaid` build-time SVG before committing to the 22-step main PR.
- **PR-5.1 `feat(page): chapter routes + layout + sidebars + hydrate` (XL)** — 22 steps per chapter.md. Files: `chapterViews` collection, `src/layouts/ChapterLayout.astro`, 10 page components under `src/components/pages/chapter/`, `ChapterRenderer` (promoted to `src/components/content/`), `src/lib/chapter/{prevNext,availabilityOf,getChapterContext}.ts`, `src/scripts/chapter-hydrate.ts`, `src/scripts/chapter-toc.ts`, three route files, `TabLink disabled` integration, Giscus mount, Mermaid on Flow only.
- **PR-5.2 `feat(ci): validate-content` (S)** — `scripts/validate-content.mjs`: rejects `mermaid` fences outside `flow.mdx`, H1s inside chapter body MDX, orphan revision/flow siblings. Wired to `npm run check:content` and CI.

### Sprint 6 — Launch Readiness (4 PRs, parallel-safe)

- **PR-6.1 `feat(layout): global footer` (S)** — Resolves legal.md §3.4 blocker. Footer links `/privacy`, `/terms`, `/about`, socials (from `about.yml`), RSS. Owned here since all three dependencies have landed.
- **PR-6.2 `feat(ops): deploy smoke tests` (M)** — `scripts/smoke-deploy.mjs` — post-deploy HTTP checks for canonical URLs, `sitemap-index.xml`, `/rss.xml`, `/og/default.png`, `/search` (Pagefind + CSP). Wire to GitHub Actions post-deploy job.
- **PR-6.3 `docs: runbooks` (M)** — `docs/A11Y.md`, `docs/PERF.md`, `docs/SEO.md` per shared plans; add `docs/DEPLOY.md` (Cloudflare Pages dashboard config, preview branches, env vars, rollback).
- **PR-6.4 `ops: DNS + Redirect Rules + Search Console` (external)** — Not a repo PR; runbook step. Owner: sonushahuji4. Sets up www→apex Redirect Rule, verifies Google / Bing / DNS, submits `sitemap-index.xml`.

---

## 5. Consolidated Launch Gates

Every bullet here must be green before tagging Phase 1 as shipped. Grouped by concern.

### 5.1 Build + routing

- `astro.config.mjs` has `trailingSlash: 'never'` + `build.format: 'file'`.
- All 11 Phase-1 routes build to flat `.html`; `dist/404.html` < 30 KB.
- `<ClientRouter />` in `BaseLayout.astro`; `transition:persist="chapter-shell"` on TopNav+breadcrumbs+tab bar only (per R3).
- `src/lib/paths.ts` exports `getChapterPaths()`; all three chapter routes use it.
- `src/lib/routes.ts` exports `SITE`, `courseUrl`, `chapterUrl`, `chapterRevisionUrl`, `chapterFlowUrl`, `canonicalFor`, `RESERVED_SLUGS`, `isReservedSlug`.
- `public/_headers` composed: routing baseline security + performance cache + seo CSP (with `'wasm-unsafe-eval'` per R4).
- `public/_redirects` exists (header comment only at launch).
- `scripts/validate-slugs.mjs` and `scripts/validate-content.mjs` pass.

### 5.2 Content + schema

- `src/content.config.ts` defines `courses`, `chapters`, `chapterViews`, `featured`, `legal`, `site`. All Zod-validated.
- ≥ 1 full course with ≥ 3 chapters (Full + Revision + Flow each) seeded.
- `about.yml` signed off by author; `featured.yml` has ≥ 1 entry; `privacy.mdx` + `terms.mdx` legal-reviewed.

### 5.3 Theming + styling

- `src/styles/global.css` contains `@import "tailwindcss"`, `@custom-variant dark`, `@theme`, `@layer base` dark overrides.
- Theme pre-paint script emitted `is:inline` in BaseLayout; sets both `html.dark` AND `html.dataset.theme` in one pass.
- Dual-theme Shiki CSS variable swap renders correctly in both modes.
- `prose.css` + `code.css` render correctly on chapter Full Notes.

### 5.4 Accessibility

- All 5 a11y primitives exist: `SkipLink`, `VisuallyHidden`, `LiveRegion`, `TabList`+`TabLink` (with `disabled`), `FigureDescribed`.
- Every page passes axe-core (0 serious/critical) and Pa11y.
- Lighthouse a11y ≥ 95 on home, all-courses, course-overview, one chapter, 404, about, legal.
- VoiceOver walkthrough recorded for home + chapter.
- Touch targets ≥ 44×44 everywhere (validated).
- `Mod+K`, `/`, `Esc`, prev/next arrow bindings work; guard uses `<main id="main">` dataset (per Session-3 extension).
- `view-transition-a11y.ts` restores scroll (keyed by `scrollKey()`) and lands focus on fresh `<h1>` after swap.

### 5.5 Performance

- Three variable fonts in `public/fonts/` with verified licenses (see §10 open question — this gates launch).
- `SmartImage` used everywhere new; no raw `<img>` in new code.
- `LazyScript` + `GiscusLazy` lazy-mount; Mermaid bundle only on `/flow` routes.
- Lighthouse: LCP < 2.5s, CLS < 0.1, TBT < 200ms on home + chapter.
- Bundle budgets: home JS < 5 KB gzipped; all-courses < 40 KB; course-overview < 50 KB; chapter Full Notes < 500 KB; Flow exempt.
- `check-bundle-size.mjs` runs in CI on every build.

### 5.6 SEO

- `buildMeta()` consumed by a single `<SEO />` component; no page writes its own `<meta>` directly.
- All JSON-LD factories exist: `websiteSchema`, `techArticleSchema`, `courseSchema`, `breadcrumbSchema`, `personSchema`, `aboutPageSchema`, `courseListSchema`.
- Revision/Flow routes emit `noindex, follow` + canonical → Full Notes; no JSON-LD on Revision/Flow.
- OG images generated per chapter + course + static page; `/og/default.png` exists.
- `sitemap-index.xml` excludes `/revision`, `/flow`, `/404`, `/search`, coming-soon courses; `lastmod` populated from frontmatter.
- `robots.txt` and `/rss.xml`, `/atom.xml`, `/feed.json` served with correct `Content-Type`.
- CSP has no DevTools violations on any page (including `/search`).
- Rich Results Test validates `TechArticle`, `Course`, `BreadcrumbList`, `ItemList`, `WebSite+SearchAction`, `Person`, `AboutPage`.
- OG preview renders cleanly in Facebook, Twitter/X, LinkedIn debuggers.

### 5.7 Storage + hydration

- `src/lib/storage.ts` exports all key builders per R1; no page/script constructs keys inline.
- All four hydrate scripts (`progress-hydrate`, `course-overview-hydrate`, `home-hydrate`, `chapter-hydrate`) read/write via storage builders.
- Chapter Mark-as-read writer → course-overview + all-courses + home readers all see consistent data in manual smoke test.
- `lastRead` envelope populated on first chapter visit; Continue card renders on home.

### 5.8 Third-party integrations

- Giscus: one thread per chapter (`mapping="specific"`, term = `<courseSlug>/<chapterSlugPath>`), lazy-mount via IntersectionObserver, theme sync via `postMessage`, `min-height: 240px` reservation, CSP allows origin.
- Pagefind: indexes only Full Notes (`<article data-pagefind-body data-pagefind-filter="course">`); search modal opens on `⌘K` + `/`.
- Mermaid: `autoTheme` keyed on `data-theme`; SVG re-inits on `astro:page-load` (spike PR-5.0 confirmed).
- Shiki: `github-light` + `github-dark-dimmed` with CSS variable swap.
- KaTeX: CSS inline; CSP `'unsafe-inline'` documented.

### 5.9 Ops

- Cloudflare Pages deploy from `main`; preview branches on PRs.
- `.env.example` complete; all `PUBLIC_*` vars set in CF dashboard.
- www→apex Redirect Rule configured in CF dashboard.
- Search Console + Bing Webmaster verified; `sitemap-index.xml` submitted.
- Deploy smoke test passes post-merge.
- Footer links all work (`/privacy`, `/terms`, `/about`, socials, RSS).
- `CONTRIBUTING.md` exists (avoid About-page 404).
- Rollback procedure documented; Cloudflare Pages native rollback tested once.

---

## 6. Open Questions — Resolution Table

Every open question accumulated across Sessions 1–3. Each marked as:

- **✅ ratified** — decision recorded here; implement accordingly.
- **🚧 blocker** — owner input required before relevant sprint starts.
- **⏭ deferred** — Phase 2 / Phase 1.5 backlog; does not block launch.

| # | Question | Status | Resolution / Owner |
|---|---|---|---|
| 1 | Revision/Flow content organization: extra fields vs third collection | ✅ ratified | `chapterViews` collection (chapter.md §3.3). Revisit after 5+ chapters authored. |
| 2 | Storage key prefix scheme | ✅ ratified | `gyandev:v1:<domain>:<id>` unified; see §2.R1. |
| 3 | `includeSerif` wiring path | ✅ ratified | BaseLayout + PageShell both accept; see §2.R2. |
| 4 | `transition:persist` scope | ✅ ratified | TopNav + breadcrumbs + tab bar; H1 swaps; see §2.R3. |
| 5 | CSP + Pagefind WASM | ✅ ratified | Add `'wasm-unsafe-eval'`; see §2.R4. |
| 6 | CI workflow filename | ✅ ratified | `ci.yml` from Sprint 1; see §2.R5. |
| 7 | `content.config.ts` path | ✅ ratified | Root-level `src/content.config.ts`; see §2.R6. |
| 8 | `_redirects` ownership | ✅ ratified | routing-and-urls.md exclusive; see §2.R7. |
| 9 | Font licensing (Inter + Source Serif 4 + JetBrains Mono) | 🚧 blocker | **Owner: sonushahuji4.** Confirm before PR-1.4 (performance). Fallback: system font stack. |
| 10 | `astro-og-canvas` 0.9.x Astro-6 compat | 🚧 blocker at implementation | Check npm at PR-1.5 start; fallback to `astro-satori`. |
| 11 | Cloudflare Redirect Rule www→apex ownership | 🚧 blocker at launch | **Owner: sonushahuji4.** Sprint 6 runbook. |
| 12 | Giscus EU/GDPR posture | ⏭ deferred | Phase 1 = auto-lazy-mount. Flip to single-click opt-in in Phase 1.5 if needed. |
| 13 | CSP nonce hardening | ⏭ deferred | Keep `'unsafe-inline'` in Phase 1 (theme pre-paint requires it). Phase 2 harden. |
| 14 | Author photo source | 🚧 blocker at PR-2.3 | **Owner: sonushahuji4.** Blocks About page completeness. |
| 15 | Social network list / Twitter vs X | 🚧 blocker at PR-2.3 | **Owner: sonushahuji4.** Populates `about.yml`. |
| 16 | `CONTRIBUTING.md` exists before launch | 🚧 blocker at launch | **Owner: sonushahuji4.** Simple file; Sprint 6. |
| 17 | `about.yml` editorial sign-off | 🚧 blocker at PR-2.3 | **Owner: sonushahuji4.** |
| 18 | Legal prose compliance review | 🚧 blocker at PR-2.2 | **Owner: sonushahuji4 + external counsel if applicable.** |
| 19 | Featured-chapter curation cadence | ⏭ deferred | Launch with 3 entries; refresh monthly. Documented in `docs/EDITORIAL.md` (Sprint 6). |
| 20 | Mermaid re-init under ClientRouter | 🚧 spike-gated | PR-5.0 spike in Sprint 5 before main chapter PR. |
| 21 | `TabLink disabled` focus affordance | ⏭ deferred | Phase 1 = non-focusable `<span>`. Revisit if screen-reader user report surfaces issue. |
| 22 | `readingMinutes` source | ⏭ deferred | Phase 1 = frontmatter required. Phase 1.5 = auto-computed from word count. |
| 23 | "Season 1/2" vs named sessions | ⏭ deferred | Default "Season N"; author can override in chapter frontmatter. |
| 24 | GitHub issue template URLs for 404 / all-courses CTAs | 🚧 blocker at launch | **Owner: sonushahuji4.** Create `.github/ISSUE_TEMPLATE/` files Sprint 6. |
| 25 | Cloudflare Web Analytics snippet | ⏭ deferred | Phase 2 ops decision. Adds CSP entry when wired. |
| 26 | KaTeX CSS CSP strategy | ⏭ deferred | Phase 2; currently `'unsafe-inline'` covers. |
| 27 | 404 featured-course source (hard-coded vs `featured.yml`) | ✅ ratified | Hard-code `nodejs` (or site's first course) in Phase 1. `featured.yml` is for featured chapters only. |
| 28 | `courseLabel` in `lastRead` envelope | ✅ ratified | = course's `title` field. Documented in `storage.ts` JSDoc and chapter-hydrate.ts writer. |
| 29 | `HomeHero` featured-course config | ⏭ deferred | Phase 1 hard-codes `nodejs`; Phase 2 extracts to `site.yml`-like config. |
| 30 | Progress scripts consolidation | ⏭ deferred | Phase 1.5 housekeeping (`src/scripts/progress.ts` with scope arg). |

---

## 7. File Ownership Matrix (authoritative)

Use this when two plans both touch a file. The owner's plan defines the baseline; subsequent plans only *extend*.

| File | Owner plan | Contributors |
|---|---|---|
| `public/_headers` | routing-and-urls (baseline) | performance (cache), seo (CSP) |
| `public/_redirects` | routing-and-urls | — |
| `src/layouts/BaseLayout.astro` | routing-and-urls | responsive (theme+viewport), a11y (SkipLink+LiveRegion+scripts), perf (FontPreload+includeSerif), seo (SEO+JsonLd) |
| `src/layouts/ChapterLayout.astro` | chapter | — |
| `src/layouts/LegalLayout.astro` | legal | — |
| `src/layouts/AboutLayout.astro` | about | — |
| `astro.config.mjs` | routing-and-urls | performance (inlineStylesheets+image), seo (sitemap filter+serialize) |
| `src/content.config.ts` | routing-and-urls (stub) | all-courses (courses+chapters enrichment via PR-3.1), chapter (chapterViews), legal (legal), about (site), home (featured) |
| `src/styles/global.css` | responsive-breakpoints | — |
| `.github/workflows/ci.yml` | accessibility (creates) | performance (+check:bundle), seo (+check:schema), routing (+validate:slugs), chapter (+check:content), legal (+check:legal) |
| `package.json` scripts.check | all owners append | Combined `"check"` = `validate:slugs && check:contrast && check:bundle && check:schema && check:content && check:legal && build` |
| `src/lib/storage.ts` | infrastructure (PR-0.1) | — (consumed by every hydrate script) |
| `src/components/ui/CourseCard.astro` | all-courses (initial) → home (promotes to ui/) | Sprint 4 housekeeping |
| `src/components/content/ChapterRenderer.astro` | chapter (creates at shared path directly) | — |

---

## 8. Consolidated Script Inventory

**Build-time Node ESM (`scripts/`):**

| Script | Plan | Purpose |
|---|---|---|
| `validate-slugs.mjs` | routing | Reserved slugs, `_redirects` format, orphan checks |
| `validate-content.mjs` | chapter | Mermaid fences only in `flow.mdx`; no H1 in chapter body MDX; orphan revision/flow |
| `check-contrast.mjs` | a11y | Contrast pairs against `contrast-pairs.json` |
| `check-bundle-size.mjs` | performance | Bundle budgets per route |
| `check-legal-freshness.mjs` | legal | `updated:` frontmatter vs git mtime |
| `validate-schema.mjs` | seo | JSON-LD well-formedness + required-field smoke |
| `submit-sitemap.mjs` | seo | Optional — ping Search Console |
| `smoke-deploy.mjs` | ops (PR-6.2) | Post-deploy HTTP checks |

**Runtime (`src/scripts/`):**

| Script | Plan | Purpose |
|---|---|---|
| `theme-init.ts` | responsive | Inline pre-paint; sets `.dark` + `data-theme` |
| `keybindings.ts` | a11y | Global key manager |
| `view-transition-a11y.ts` | a11y | Focus + scroll restoration |
| `progress-hydrate.ts` | all-courses | Course-card badge hydration |
| `course-overview-hydrate.ts` | course-overview | Chapter rows + progress widget |
| `home-hydrate.ts` | home | Continue card + ?q= + dismiss |
| `chapter-hydrate.ts` | chapter | Mark-as-read + bookmarks + active-tab + lastRead |
| `chapter-toc.ts` | chapter | IntersectionObserver TOC scroll-sync |

Phase-1.5 consolidation: merge the four hydrate scripts into `src/scripts/progress.ts` with `hydrateProgress(scope)` helper. Not a launch blocker.

---

## 9. Components Promoted to Shared Library

Three components start page-scoped and get promoted once a second consumer appears.

| Component | Initial location | Promote to | Promotion PR |
|---|---|---|---|
| `CourseCard` | `src/components/pages/all-courses/` (PR-3.2) | `src/components/ui/CourseCard.astro` | PR-4.2 (home) |
| `ChapterRenderer` | (never; create at shared path directly) | `src/components/content/ChapterRenderer.astro` | PR-5.1 |
| `ProgressWidget` | `src/components/pages/course-overview/` (PR-4.1) | `src/components/ui/ProgressWidget.astro` | Phase 1.5 (home reuses) |

**Not promoted (stay page-scoped):** `HomeHero`, `ChapterHeader`, `CourseHero`, `AboutHero`, `ErrorHero`, `LegalHeader`, etc. Each has exactly one consumer.

**Stubbed shared plans (`design-system.md`, `component-library.md`, `layout-conventions.md`) — status:** Session-2 folded these concerns into `responsive-breakpoints.md` and `accessibility.md`. The empty placeholders should be deleted or populated with a one-line redirect to the plans that absorbed them. Housekeeping for Sprint 0.

---

## 10. Blockers by Sprint

### Sprint 1 blocker

- **Font licensing sign-off** (Q#9). Without it, PR-1.4 can't land variable fonts. Fallback: launch with system font stack (Phase 1.5 adds custom fonts).

### Sprint 2 blockers

- **Legal prose review** (Q#18) — PR-2.2 can't ship `privacy.mdx` + `terms.mdx` without content.
- **Author photo + `about.yml` signoff** (Q#14, #15, #17) — PR-2.3 blocker.

### Sprint 5 blocker

- **Mermaid re-init spike** (Q#20) — PR-5.0 runs in Sprint 5; if Mermaid fails under ClientRouter, the chapter PR has to incorporate `rehype-mermaid` (build-time SVG) OR forgo persistent shell for Flow route.

### Sprint 6 blockers

- **Cloudflare Redirect Rule ownership** (Q#11) — launch-gate. sonushahuji4 owns.
- **`CONTRIBUTING.md`** (Q#16) — simple file, Sprint 6.
- **GitHub issue templates** (Q#24) — simple files, Sprint 6.

### Implementation-time check (Sprint 1)

- **`astro-og-canvas` 0.9.x availability** (Q#10) — confirm on `npm view astro-og-canvas` at PR-1.5 start. If not available, swap to `astro-satori` (flagged in seo.md).

---

## 11. Infrastructure Gap List

Session 1's `00-infrastructure.md` is a decisions memo, not a complete plan. Items that need coverage before launch — each folded into a PR in §4 but consolidated here for visibility:

### 11.1 Owned by Sprint 0 (PR-0.1 / PR-0.3 / PR-0.4)

- `src/lib/storage.ts` full implementation (versioned envelope, key builders, migrations stub, `pagehide` flush, `storage`-event cross-tab sync).
- `.env.example` with all `PUBLIC_*` vars.
- `src/content.config.ts` stub.
- `BaseLayout.astro` skeleton with ratified props.

### 11.2 Owned by Sprint 1 PRs

- All shared primitives, CI skeleton + gates, `_headers` composition, `_redirects`, sitemap, OG route, feeds, `robots.txt`.

### 11.3 Owned by Sprint 5 (chapter)

- Pagefind integration: the build hook, index config, search-modal wiring.
- Giscus wrapper component (`<Comments />` over `GiscusLazy` from performance plan).

### 11.4 Owned by Sprint 6 (launch-readiness)

- Global footer (PR-6.1).
- Deploy smoke tests (PR-6.2).
- `docs/A11Y.md`, `docs/PERF.md`, `docs/SEO.md`, `docs/DEPLOY.md` runbooks (PR-6.3).
- Cloudflare dashboard config, preview-branch config, DNS + Redirect Rule, Search Console / Bing verification (PR-6.4, external).

### 11.5 Deferred (Phase 1.5+)

- Author/new-chapter scaffolding script (`new-chapter` generator).
- Cloudflare Web Analytics snippet.
- RUM / Core Web Vitals field collection.
- CSP nonce hardening.
- Storage schema migrations beyond v1 (the table stub lands in PR-0.1; real migrations when `v2` is introduced).

---

## 12. Sprint Cadence Summary

| Sprint | Goal | Est. effort | PRs | Risk |
|---|---|---|---|---|
| 0 | Infrastructure bootstrap | 1–2 days | 4 (S/M) | Low |
| 1 | Shared primitives | 1.5 weeks | 5 (M/L) | Medium — font licensing |
| 2 | Shell validators + editorial | 3–4 days | 3 (S/M) | Medium — legal/about content |
| 3 | Schema + catalog | 3–4 days | 2 (M/L) | Low — schema lands once |
| 4 | Course overview + home | 1 week | 2 (L) | Low |
| 5 | Chapter capstone | 1.5 weeks | 3 (S/XL/S) | High — Mermaid spike |
| 6 | Launch readiness | 3–4 days | 4 (S/M) + external ops | Medium — CF Redirect Rule, content signoffs |
| **Total** | **Phase 1** | **~5 weeks** | **23 PRs** | |

Parallelization hotspot: Sprint 2 PRs (404, legal, about) can all land in parallel once Sprint 1 merges; Sprint 4 PRs (course-overview, home) can land in parallel once PR-3.2 merges.

---

## 13. Post-launch (Phase 1.5 + Phase 2) backlog

Captured for continuity; do not start until Phase 1 ships.

**Phase 1.5 (housekeeping + quick wins):**
- Consolidate hydrate scripts → `src/scripts/progress.ts` (Q#30).
- Named season support (Q#23).
- Auto-compute `readingMinutes` from word count (Q#22).
- View-availability dots on course-overview (course-overview.md Phase 1.5 flag).
- Move `Intl.RelativeTimeFormat` staleness guard (home.md §11).
- Promote `ProgressWidget` to shared (home consumer).
- Delete or redirect empty stubs: `shared/design-system.md`, `component-library.md`, `layout-conventions.md`.

**Phase 2 (structural):**
- `EditorialLayout` (merge `AboutLayout` + `LegalLayout`).
- CSP nonce hardening (remove `'unsafe-inline'` from script-src).
- Cloudflare Web Analytics + RUM (Q#25).
- `rehype-mermaid` build-time SVG (eliminate Mermaid runtime from Flow route).
- Feature-flag system for `featured-course` config (Q#29).
- Git-log–driven changelog on About (about.md §13).
- Newsletter integration.
- Interactive Mermaid diagrams.

---

## 14. References

- [SESSION-LOG.md](./SESSION-LOG.md) — decisions history
- [RESEARCH.md](./RESEARCH.md) — 14 technical briefs
- [00-infrastructure.md](./00-infrastructure.md) — binding infra decisions
- [shared/routing-and-urls.md](./shared/routing-and-urls.md)
- [shared/responsive-breakpoints.md](./shared/responsive-breakpoints.md)
- [shared/accessibility.md](./shared/accessibility.md)
- [shared/performance.md](./shared/performance.md)
- [shared/seo.md](./shared/seo.md)
- [shared/website-overview.md](./shared/website-overview.md) — superseded roadmap sections by this file
- [pages/404.md](./pages/404.md)
- [pages/legal.md](./pages/legal.md)
- [pages/about.md](./pages/about.md)
- [pages/all-courses.md](./pages/all-courses.md)
- [pages/course-overview.md](./pages/course-overview.md)
- [pages/home.md](./pages/home.md)
- [pages/chapter.md](./pages/chapter.md)
