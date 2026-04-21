# GyanDev Planning — Session Log

This log tracks what each planning session accomplished. Each session reads this at start and appends at end.

---

## Session 1 — Research + Infrastructure

**Completed**: 2026-04-20
**Duration**: ~1 planning cycle
**Owner**: sonushahuji4

### What I Did

- Read all 6 shared specs in `.claude/specs/shared/` (website-overview, routing-and-urls, responsive-breakpoints, accessibility, performance, seo).
- Confirmed all 7 page specs exist under `.claude/specs/pages/` and skimmed the relevant ones (home, chapter, course-overview) for routing + component context.
- Confirmed all existing plan files (`00-infrastructure.md`, `README.md`, `shared/design-system.md`, `shared/layout-conventions.md`, `shared/component-library.md`) were empty placeholders before this session.
- Read `.claude/CLAUDE.md`, `package.json`, and `astro.config.mjs` to ground research in locked dependency versions.
- Researched 14 technical topics in parallel via four subagents (Astro core; styling + code/diagrams + View Transitions; search/comments/OG; deploy/sitemap/storage).
- Wrote `.claude/plans/RESEARCH.md` — 14 topics × (Question / Findings / Decision / Sources), plus Cross-Cutting Decisions, Open Questions, and consolidated Sources.
- Wrote the "Research-Informed Updates" section of `.claude/plans/00-infrastructure.md` (file was previously empty; the rest of the infrastructure plan is deferred to a later session).

### Key Decisions Made

1. **Two content collections (`courses` + `chapters`) with `reference()` cross-linking.** Not nested, not single collection. URLs derived from the `id` path (`javascript/01-event-loop`). Topic 1.
2. **Shared `getChapterPaths()` utility** in `src/lib/paths.ts` — single source of truth for all three chapter route files. Topic 2.
3. **MDX everywhere, component injection via `<Content components={{...}} />`.** Authors don't import common components per file. Topic 3.
4. **Minimal-JS hydration.** Inline `<script is:inline>` / vanilla `<script>` for theme toggle, bookmark button. `client:media` / `client:idle` / `client:visible` / `client:only` only for genuinely stateful surfaces. Topic 4.
5. **Tailwind v4 via `@tailwindcss/vite` — do NOT install `@astrojs/tailwind`.** Design tokens in CSS via `@theme`, dark mode via `@custom-variant dark` keyed on `.dark` class, overrides under `@layer base`. Topic 5.
6. **Pagefind indexes only Full Notes.** Wrap Full Notes body in `<article data-pagefind-body data-pagefind-filter="course">`; use `astro-pagefind` (shishkin) integration + Pagefind Component UI modal (ships ⌘K + ARIA). Topic 6.
7. **Giscus: one thread per chapter, view-independent.** `mapping="specific"` with `term={chapter.slug}`. Raw script (no `@giscus/react`). Lazy-mount via IntersectionObserver; theme sync via `postMessage` + MutationObserver on `<html>`. Topic 7.
8. **astro-mermaid `autoTheme` keys off `data-theme`, NOT `.dark`.** Theme toggle must set both `html.classList.dark` (Tailwind) and `html.dataset.theme` (mermaid) in one inline script. Topic 8.
9. **Shiki dual themes render as one tree with CSS-variable swap.** Current config (`github-light` + `github-dark-dimmed`) is correct for 2026. Just add `html.dark .shiki { color: var(--shiki-dark); ... }` CSS. Topic 9.
10. **OG images via `astro-og-canvas` + `OGImageRoute`, build-time.** Prescriptive layout enforces visual consistency for 50+ chapter cards. Caches across incremental builds. Topic 10.
11. **Sitemap: `filter` drops `/revision`, `/flow`, `/404`, `/search`; `serialize` populates `lastmod` from frontmatter, priority/changefreq by URL pattern.** Submit `sitemap-index.xml` to Search Console. Topic 11.
12. **Cloudflare Pages: `_redirects` for slug-rename 301s only; `_headers` for security + immutable cache.** Set `trailingSlash: 'never'` **+** `build.format: 'file'` in `astro.config.mjs` so Pages serves flat `.html` without a 308. www→apex handled at zone level via Redirect Rules (dashboard), NOT `_redirects`. CSP via HTTP header, never meta tag. Topic 12.
13. **localStorage via single typed utility (`src/lib/storage.ts`)** with versioned envelope `{ v, data }`, sequential migrations, in-memory fallback, debounced writes, `pagehide` flush, `storage`-event cross-tab sync. `CURRENT_VERSION = 1`; stub migrations table now. Topic 13.
14. **Chapter views are three separate routes with `<ClientRouter />` + `transition:persist="chapter-shell"`, NOT a single-route JS tab switcher.** Rationale: isolates Mermaid's ~1.5 MB runtime to the Flow route only; gives deep links, middle-click open, `<a>` keyboard navigation, and browser-native scroll restoration. Persist per-URL `scrollY` in `sessionStorage` as a workaround for documented scroll-restoration bugs. Topic 14.

### Handoff to Session 2

Session 2 should:

- **Read `.claude/plans/RESEARCH.md` FIRST** before writing any shared plans. The Cross-Cutting Decisions section locks the spine of every shared plan.
- **Pay special attention to:**
  - Topic 4 (hydration) → directly shapes component-library.md.
  - Topic 5 (Tailwind v4 `@theme` + `.dark` overrides) → shapes design-system.md.
  - Topic 14 (separate-routes + ClientRouter + scroll-restoration) → shapes layout-conventions.md.
  - Topic 9 (`html.dark .shiki` CSS variable swap) → MUST be included in design-system.md or a dedicated code-block styling section.
- **Be aware of these constraints** when writing plans:
  - Theme toggle sets TWO signals (`.dark` class + `data-theme` attribute). Design-system + component-library must both mention this.
  - MDX components are injected globally via `<Content components={{...}} />` in a `ChapterRenderer.astro` wrapper — the component-library plan must include this wrapper as the entry point for authored content.
  - Mermaid lives only on the Flow route. If component-library.md lists a `<Mermaid />` component, note it is Flow-only.
  - Pagefind indexing boundaries (`data-pagefind-body`, `data-pagefind-ignore="all"`) affect layout-conventions.md.
  - CSP in `_headers` must be extended to allow Giscus (`frame-src`, `connect-src` for `https://giscus.app`) and anything else that loads in an iframe.
- **Do NOT reopen Cross-Cutting Decisions without flagging in this log.**

### Blockers or Questions for User

No hard blockers. Open questions (recorded in RESEARCH.md §"Open Questions") that may need sonushahuji4's input before Session 3 / implementation:

- Revision/Flow content organization: extra loader fields vs a third `chapterViews` collection — likely defer until the first real chapter is authored.
- EU GDPR posture for Giscus: auto-lazy-mount vs single-click "Load comments" opt-in.
- Who owns the Cloudflare Redirect Rule setup for www → apex (ops task)?
- Font choice + licensing (Inter variable WOFF2 is the current assumption).
- KaTeX CSS strategy (`style-src 'unsafe-inline'` in CSP vs file-based styles) — Phase 2 decision.
- `astro-og-canvas` 0.9.x availability (stable Astro 6 support) at implementation time; otherwise fall back to `astro-satori`.
- Optional: evaluate `rehype-mermaid` for build-time SVG rendering to eliminate the ~1.5 MB Mermaid client runtime entirely.

### Files Modified

- **Created**: `.claude/plans/RESEARCH.md` — 14 research topics, cross-cutting decisions, open questions, consolidated sources.
- **Updated**: `.claude/plans/00-infrastructure.md` — populated with "Research-Informed Updates" section only (rest of infrastructure plan deferred to a later session).
- **Created**: `.claude/plans/SESSION-LOG.md` — this file.

No files under `src/`, `astro.config.mjs`, `package.json`, or content were modified. No dependencies installed. No commits created.

---

## Session 2 — Shared Plans

**Completed**: 2026-04-20
**Owner**: sonushahuji4

### What I Did

- Read Session 1 handoff (RESEARCH.md, 00-infrastructure.md, SESSION-LOG.md — all from this conversation).
- Wrote 6 shared plans in dependency order:
  1. `.claude/plans/shared/routing-and-urls.md`
  2. `.claude/plans/shared/responsive-breakpoints.md`
  3. `.claude/plans/shared/accessibility.md`
  4. `.claude/plans/shared/performance.md`
  5. `.claude/plans/shared/seo.md`
  6. `.claude/plans/shared/website-overview.md` (roadmap)
- Each plan follows the mandated 14-section structure (Overview → Spec Reference → Technical Approach → File Structure → Dependencies → Implementation Steps → Component/Module API → Code Patterns → Testing Strategy → Rollout Plan → Risks and Mitigations → Done When → Open Questions → References).
- Every plan cites RESEARCH.md topics by number and cross-links sibling plans.

### Key Decisions Made

Most decisions inherit from Session 1; Session 2 turned them into concrete file paths, component APIs, and implementation steps. New clarifications this session:

1. **File ownership when multiple plans touch the same file** (codified in the website-overview roadmap §11):
   - `_headers` — routing owns security headers, performance owns cache-control, seo owns CSP.
   - `BaseLayout.astro` — routing owns canonical/robots props + `<ClientRouter />`; a11y owns `<SkipLink />` + `<LiveRegion />`; performance owns `<FontPreload />` + theme pre-paint; seo owns `<SEO />` + `<JsonLd />`.
2. **Shared CI workflow at `.github/workflows/ci.yml`.** One workflow runs `validate:slugs`, `check:contrast`, `check:bundle`, `check:schema`, axe-core, Pa11y, Lighthouse. Each gate defined in its owning plan; composition lives in the a11y plan, extended by performance + seo.
3. **Component taxonomy under `src/components/`**: `a11y/`, `layout/`, `perf/`, `seo/`, `ui/`. Five buckets; every new component lands in one of them.
4. **Utility module taxonomy under `src/lib/`**: `paths.ts`, `routes.ts`, `storage.ts`, `a11y/`, `seo/`. Utilities grouped by domain.
5. **Native `<dialog>` + `@custom-variant dark` + single inline theme-init script** are non-negotiable patterns — plans reference these as the default so every component uses them.
6. **Scripts directory taxonomy** (`scripts/`): `validate-slugs.mjs`, `check-contrast.mjs`, `check-bundle-size.mjs`, `validate-schema.mjs`, `submit-sitemap.mjs`. Plus `src/scripts/theme-init.ts`, `keybindings.ts`, `view-transition-a11y.ts` for runtime.
7. **Per-route OG image generation** via `astro-og-canvas` OGImageRoute — emits `/og/<slug>.png` at build. Committed `/og/default.png` as fallback.
8. **CSP baseline** — `'unsafe-inline'` for `script-src` in Phase 1 (required for theme pre-paint); harden to nonces/hashes in Phase 2. Explicitly flagged as a debt item.

### Handoff to Session 3

Session 3 should:

- **Read all 6 shared plans before writing any page plan.** Every page plan is a composition of primitives defined in the shared plans — no page plan should re-invent SEO, layout, a11y, or perf patterns.
- **Follow the dependency order:** page plans depend on layouts, which depend on shared plans. Page plans should call out which shared components they compose (PageShell vs ChapterShell, which primitives, which JSON-LD schemas).
- **Reference shared patterns explicitly** when writing pages:
  - For meta/OG/JSON-LD → `<SEO />` + `<JsonLd />` via `buildMeta()` + schema factories (seo plan §8).
  - For chapter tabs → `<TabList>` + `<TabLink>` (a11y plan §8).
  - For images → `<SmartImage>` (performance plan §8).
  - For third-party embeds → `<LazyScript>` (performance plan §8).
  - For layout → `<PageShell>` for simple pages, `<ChapterShell>` for chapter routes (responsive plan §12).
- **Do NOT write new shared components in Session 3.** If a page needs a new primitive, either extend an existing shared plan or flag for Session 4. Small page-specific components (e.g., `CourseCard.astro`, `ChapterRow.astro`) are fine and live under `src/components/<page>/`.
- **Be aware of these constraints:**
  - Mermaid only on `/flow` routes — if chapter MDX fences appear in other views, CI will flag (see performance plan open question).
  - `<h1>` lives in the layout, not in MDX — authors start MDX content at `h2`.
  - Full Notes is canonical; Revision/Flow must pass `noindex: true` + Full Notes URL as canonical.
  - Pagefind indexes only Full Notes — wrap Full Notes body in `<article data-pagefind-body data-pagefind-filter="course">`; Revision/Flow do NOT have this attribute.
  - Theme pre-paint + `data-theme` attribute is law — chapter shells must not introduce their own theme handling.
  - Tab nav between Full/Revision/Flow must use real `<a href>` (TabLink) — never click-handler routing.

### Blockers or Questions for User

Carried from Session 1; nothing new this session blocks Session 3. Open questions:

- Font choice + licensing confirmation (affects Sprint 1).
- `astro-og-canvas` stable Astro 6 version at implementation time.
- Cloudflare Redirect Rule ownership for www→apex (ops).
- Giscus EU GDPR posture for Phase 1.
- KaTeX CSS strategy (`style-src 'unsafe-inline'` stays in CSP for Phase 1 — documented).

### Files Created

- `.claude/plans/shared/routing-and-urls.md`
- `.claude/plans/shared/responsive-breakpoints.md`
- `.claude/plans/shared/accessibility.md`
- `.claude/plans/shared/performance.md`
- `.claude/plans/shared/seo.md`
- `.claude/plans/shared/website-overview.md`

### Files Modified

- `.claude/plans/SESSION-LOG.md` — this append.

No source files, config, or content touched. No dependencies installed. No commits created.

---

## Session 3 — Page Plans

**Completed**: 2026-04-20
**Owner**: sonushahuji4

### What I Did

- Read Session 1 handoff (RESEARCH.md) and Session 2 handoff (six shared plans: routing-and-urls, responsive-breakpoints, accessibility, performance, seo, website-overview).
- Read all seven page specs under `.claude/specs/pages/`.
- Wrote seven page plans in the prescribed dependency order — simplest warm-up first, most complex last:
  1. `.claude/plans/pages/404.md`
  2. `.claude/plans/pages/legal.md`
  3. `.claude/plans/pages/about.md`
  4. `.claude/plans/pages/all-courses.md`
  5. `.claude/plans/pages/course-overview.md`
  6. `.claude/plans/pages/home.md`
  7. `.claude/plans/pages/chapter.md`
- Every plan follows the 14-section structure established in Session 2 (Overview → Spec Reference → Technical Approach → File Structure → Dependencies → Implementation Steps → Component/Module API → Code Patterns → Testing Strategy → Rollout Plan → Risks and Mitigations → Done When → Open Questions → References).
- Each plan:
  - Specifies the exact `.astro` path under `src/pages/` in §4 (File Structure).
  - Lists custom components used (both consumed from shared plans and new to create) in §7.
  - Identifies which components to promote to the shared component library (flagged in §7 under "New components flagged for component library").
  - Includes meta tag requirements per `shared/seo.md` (`<SEO>` consumer + JSON-LD factories).
  - Includes a11y requirements per `shared/accessibility.md` (skip link inherited, semantic headings, tablist on chapter, progressbar on course-overview, aria-disabled on unpublished cards).
  - Includes performance targets per `shared/performance.md` (LCP, CLS, bundle budget, SmartImage, LazyScript).
  - Specifies sample content needed in §10 (Rollout Plan).
- Chapter plan additionally includes the three spec-required deep dives:
  - 3-Tab Architecture (§3 + §6 Steps 1–18): three routes, shared `getChapterPaths()`, `chapterViews` collection for Revision+Flow, per-tab content fetch, Coming-soon degradation, activeTab pref in localStorage, pref carries to next chapter via footer `href` rewrite.
  - Sidebar + TOC (§6 Steps 11–13): chapter-tree LeftSidebar by season, RightTOC with IntersectionObserver, MobileTOCTrigger bottom sheet.
  - Giscus Integration (§6 Step 15 + §8): wraps existing `GiscusLazy`, term = `<courseSlug>/<chapterSlugPath>`, theme sync via `postMessage`, lazy-mount via IntersectionObserver (inherited from performance plan), `min-height: 240px` reservation for CLS prevention.

### Key Decisions Made

1. **`ChapterShell` and `PageShell` (Session 2) are the only layout containers.** I explicitly chose NOT to create `ErrorLayout.astro` (for 404) or a separate `AboutLayout` vs `LegalLayout` abstraction today — `PageShell` handles all three prose variants, and deduping `AboutLayout` + `LegalLayout` into a shared `EditorialLayout` is flagged as a Phase 2 housekeeping item. Prevents premature abstraction across plans.

2. **Chapter views organized as a third content collection (`chapterViews`), not extra fields on `chapters`.** Closes Session 1 Open Question #1 for Phase 1. Rationale in `chapter.md` §3.3: cleaner typing, explicit per-view metadata, obvious "missing view" signal (entry absent → Coming-soon). Revisit if author experience becomes awkward.

3. **No JSON-LD on Revision/Flow routes.** Only Full Notes emits `TechArticle` + `BreadcrumbList`. Revision/Flow are `noindex`, so structured data has no audience. Reduces maintenance. Flagged as a small extension to seo.md §3.1.

4. **Active-tab pref is best-effort UX, not a correctness gate.** `localStorage['gyandev:v1.prefs.activeTab']` is read by `chapter-hydrate.ts` to rewrite prev/next `href` suffixes. If the target chapter doesn't have the pref'd view, the link degrades to Full. Server always renders Full-link hrefs; hydration refines.

5. **Course-overview + all-courses + home share a progress-hydration runtime pattern.** One `src/scripts/progress-hydrate.ts` (defined in `all-courses.md`) is extended by `course-overview-hydrate.ts` and `home-hydrate.ts`. Session 4 should consider consolidating into a single `src/scripts/progress.ts` module with helpers; for now, three focused scripts keep concerns clear.

6. **`CourseCard` cross-use from home.md creates pressure to promote to shared `src/components/ui/`.** Flagged as Session 4 housekeeping. For Phase 1 land, home imports from `src/components/pages/all-courses/` — acceptable coupling.

7. **Schema enrichment (`courses` + `chapters` + `chapterViews`) lands ONCE, not per page plan.** All-courses.md specifies the full enrichment; course-overview / chapter / home plans reference back rather than re-specifying. Session 4 should confirm this as a coordinated Sprint 1 change to avoid merge conflicts.

8. **Sitemap `filter` must exclude coming-soon courses.** Extension to seo.md §6 Step 12 flagged in `course-overview.md` §6 Step 17. Belt-and-suspenders with the page's own `noindex`.

9. **`PageShell` gains a small `includeSerif?: boolean` prop** so the home page can preload the Source Serif 4 font for its display headline without every other page paying that cost. Minor extension to responsive-breakpoints.md Step 11 flagged in `home.md` §6 Step 12.

10. **`TabLink` gains a `disabled?: boolean` prop** for Coming-soon tab states — renders as `<span role="tab" aria-disabled="true">` instead of a real link. One-line extension to a11y.md Step 6 flagged in `chapter.md` §7.

11. **`personSchema()` + `aboutPageSchema()` added to `jsonld.ts`.** Small extension to seo.md §6 Step 3 / §7 API — flagged in `about.md` §6 Step 10.

12. **`courseListSchema()` added to `jsonld.ts`.** For `/courses` page ItemList JSON-LD. Flagged in `all-courses.md` §6 Step 3.

13. **`courseSchema()` added to `jsonld.ts`.** For course-overview page. Flagged in `course-overview.md` §6 Step 3 (though the seo.md plan already anticipates it).

14. **localStorage contract for "Continue Reading".** Home reads `gyandev:v1.progress.lastRead`; chapter-hydrate.ts writes it. Both plans explicitly document the envelope `{ v, data: { courseSlug, chapterSlug, chapterTitle, readingMinutes, courseLabel } }`. Needs ratification in infrastructure's `storage.ts` schema — flagged as open question in both plans.

15. **`validate-content.mjs` as a new CI validator.** Rejects `mermaid` fences outside `flow.mdx`, H1s in chapter body MDX, and orphan Revision/Flow siblings. Extends `validate-slugs.mjs` (routing plan §6 Step 13).

### New Components Flagged for Component Library

Session 4 should update `.claude/plans/shared/component-library.md` (currently empty) with these. Grouped by where they belong in the shared library:

- **layouts/**: `EditorialLayout` (Phase 2 consolidation of `AboutLayout` + `LegalLayout`).
- **content/**: `ChapterRenderer` — the MDX component map wrapper, reusable for any future prose route.
- **ui/**:
  - `CourseCard` — consumed by `all-courses.md` + `home.md`; promote to shared path.
  - `ChapterCard` — consumed by `home.md`; promote if chapter.md's prev/next cards reuse it.
  - `ProgressWidget` — consumed by `course-overview.md`; extend to home + chapter later.
- **a11y/** (extensions to existing components):
  - `TabLink` gains `disabled?: boolean` prop.
- **pages/errors/**: `ErrorHero` — reusable for future 410/500 pages in Phase 2.
- **seo/** (new factories in `jsonld.ts`): `personSchema`, `aboutPageSchema`, `courseListSchema`, `courseSchema`, `chapterViewSchema` (optional — currently decided against).

Page-scoped components (NOT for the component library, live under `src/components/pages/<page>/`):
- 404 page: `RecoveryLinks`, `ReportLink`.
- Legal: `LegalHeader`, `LegalTOC`, `LegalContact`.
- About: `AboutHero`, `AuthorBio`, `SocialLinks`, `LicenseBlock`, `ContributeBlock`, `ChangelogList`.
- All Courses: `CoursesHeader`, `CourseGrid`, `CompletionBanner`, `RequestCourseCTA`.
- Course Overview: `CourseHero`, `LearningObjectives`, `Prerequisites`, `ChapterList`, `ChapterRow`, `ComingSoonHero`, `RelatedCourses`, `ContributeLinks`, `CourseSidebar`.
- Home: `HomeHero`, `ContinueReadingCard`, `FeaturedStrip`, `RecentlyUpdatedList`.
- Chapter: `ChapterHeader`, `ChapterActions`, `ChapterFooter`, `ComingSoonView`, `LeftSidebar`, `RightTOC`, `MobileTOCTrigger`, `MermaidCaption`.

### Shared-Plan Extensions Flagged (for Session 4 coordination)

Minor deltas to Session 2 plans surfaced while writing page plans. These are appends, not contradictions — Session 4 should fold them in or create an addendum:

- **seo.md §3.1 / §6 Step 3** — add `personSchema`, `aboutPageSchema`, `courseListSchema`, `courseSchema` factories to `jsonld.ts`. Decision: omit per-view JSON-LD on Revision/Flow.
- **seo.md §6 Step 12** — sitemap `filter` must exclude coming-soon courses.
- **responsive-breakpoints.md §6 Step 11** — `PageShell` gains `includeSerif?: boolean` prop, forwarded to `<FontPreload>`.
- **accessibility.md §6 Step 6** — `TabLink` gains `disabled?: boolean` prop; disabled state renders as `<span role="tab" aria-disabled="true">` with sr-only "Coming soon".
- **routing-and-urls.md §6 Step 13** — `validate-slugs.mjs` extended (or a sibling `validate-content.mjs` added) to reject Mermaid fences outside `flow.mdx` and H1s inside chapter body MDX.
- **infrastructure plan (future)** — `src/lib/storage.ts` schema should ratify:
  - `gyandev:v1.progress.lastRead` envelope (home ↔ chapter contract).
  - `gyandev:progress:<courseId>` envelope `{ v, data: { read: string[] } }` (chapter writer, all-courses/course-overview readers).
  - `gyandev:v1.prefs.activeTab` value domain `'full' | 'revision' | 'flow'`.
  - `gyandev:bookmarks` shape.

### Cross-Plan Coordination Notes

1. **Schema enrichment lands ONCE.** `content.config.ts` changes are specified in `all-courses.md` §6 Step 1 + `legal.md` Step 1 + `about.md` Step 1 + `chapter.md` Step 1. Session 4 should merge these into a single Sprint-1 PR rather than four stepped changes.
2. **Progress hydration runtime** has three scripts that share a concept. Consider consolidating in Session 4 or during Sprint 2 implementation.
3. **Footer wiring**: global footer is still a stub (responsive plan §6 Step 11). Session 4 should assign ownership — likely home plan or a small addendum to responsive plan — so that `/privacy`, `/terms`, `/about`, and socials render in the footer before launch.
4. **`CourseCard` promotion** is the cleanest Session 4 housekeeping item — once home + all-courses both use it, move to `src/components/ui/`.

### Handoff to Session 4

Session 4 should:

- **Read Sessions 1, 2, and 3 handoffs before anything else.** All ratified decisions live in SESSION-LOG.md + RESEARCH.md + the shared and page plans.
- **Cross-check all plans for consistency.** Specific hot spots:
  - Schema enrichment across all-courses/course-overview/chapter/home/legal/about plans.
  - `storage.ts` envelope shapes referenced by multiple plans but owned by none yet.
  - `_headers` ownership split (routing: security; performance: cache; seo: CSP) — verify no contradictions in the baseline string.
  - `BaseLayout.astro` prop surface (routing owns canonical/robots; seo owns title/description/ogImage/jsonLd/article; a11y owns SkipLink/LiveRegion mount; responsive owns theme pre-paint + viewport; performance owns FontPreload).
  - Progress scripts consistency: `gyandev:v1.progress.lastRead` vs `gyandev:progress:<courseId>` naming (mismatched prefixes today).
- **Build `PHASE-1-ROADMAP.md`**: the final implementation roadmap composing Sessions 1 + 2 + 3. Should include:
  - Sprint breakdown (see `.claude/plans/shared/website-overview.md` §10 for the current sprint table; refine).
  - Per-PR work units, not per-plan.
  - Dependency graph between PRs.
  - Launch-gate checklist consolidated from every plan's "Done When" section.
  - Answer to the "Open Questions" that are still unanswered vs ratified.
- **Ratify or defer remaining Open Questions.** Full list accumulated across Sessions 1–3 is the union of §13 sections; many are Phase 2. Session 4 should mark each as (a) blocker for Phase 1 (needs owner input), (b) ratified (add decision to SESSION-LOG), (c) deferred (Phase 2 backlog).
- **Identify any contradictions between shared and page plans.** I did not find hard contradictions during Session 3; the "extensions flagged" list above is where small deltas exist.
- **Write any addenda to shared plans** needed to fold in the flagged extensions — OR explicitly accept that page plans carry these as one-off deltas that implementation PRs will resolve.

### Blockers or Questions for User

No hard blockers. Open questions carried + new from Session 3:

**Carried from Sessions 1–2 (still unresolved):**
- Font licensing sign-off (Inter + Source Serif 4 + JetBrains Mono).
- `astro-og-canvas` 0.9.x stable Astro 6 availability at implementation time.
- Cloudflare Redirect Rule ownership for www→apex (ops).
- Giscus EU GDPR posture (auto-lazy vs single-click opt-in).
- CSP nonce-based hardening (Phase 2).

**New from Session 3:**
- Author photo inclusion + source (about.md §13).
- Social network list + Twitter vs X branding (about.md §13).
- `CONTRIBUTING.md` creation before launch to avoid 404 from About's Contribute block.
- `about.yml` editorial sign-off (author bio / socials accuracy).
- Legal prose compliance review owner (privacy/terms — GDPR/CCPA/DPDPA).
- Featured-chapter curation responsibility + cadence.
- Mermaid re-init behavior under ClientRouter (smoke-test before chapter plan ships).
- `TabLink disabled` affordance — non-focusable span vs focusable-but-announced alternatives (screen reader user test).
- `readingMinutes` source — frontmatter required (current Zod) vs auto-computed from word count (Phase 1.5).
- Session names vs "Season 1/2" default (author preference).
- GitHub issue template URLs for "Broken link" (404) and "Course request" (all-courses) exist or need creating.

### Files Created

- `.claude/plans/pages/404.md`
- `.claude/plans/pages/legal.md`
- `.claude/plans/pages/about.md`
- `.claude/plans/pages/all-courses.md`
- `.claude/plans/pages/course-overview.md`
- `.claude/plans/pages/home.md`
- `.claude/plans/pages/chapter.md`

### Files Modified

- `.claude/plans/SESSION-LOG.md` — this append.

No source files, config, or content touched. No dependencies installed. No commits created.

---

## Session 4 — Cross-Check + Phase 1 Roadmap

**Completed**: 2026-04-20
**Owner**: sonushahuji4

### What I Did

- Read Sessions 1–3 handoffs end-to-end.
- Dispatched three parallel subagents to digest the plans:
  1. Shared-plans digest — consolidated steps, done-when gates, file ownership, package deps, component + utility inventories.
  2. Page-plans digest — page summaries, done-when gates, schema enrichment coordination, storage keys, runtime scripts, page components, CI requirements, shared-plan deltas.
  3. Hot-spot forensic cross-check — verified the five hot spots called out in Session-3 handoff plus three additional audits (`<ClientRouter />` persist scope, CSP allowlists, `_redirects` ownership).
- Composed `.claude/plans/PHASE-1-ROADMAP.md` — the authoritative Phase 1 implementation roadmap (14 sections, 23 PRs across 7 sprints).

### Key Ratifications (binding — fold into shared + page plans)

1. **Unified storage key scheme**: `gyandev:v1:<domain>:<id-or-field>`. Envelopes `{ v: 1, data }`. `src/lib/storage.ts` exposes builders — no inline string concatenation. Resolves three-prefix drift across responsive, a11y, home, all-courses, course-overview, chapter.
2. **`includeSerif` wiring**: both `BaseLayout.astro` and `PageShell.astro` accept the prop; FontPreload consumes it in the head. Only home sets `true`. Resolves gap where responsive, performance, home each described different wiring paths.
3. **`transition:persist="chapter-shell"` scope**: TopNav + breadcrumbs + tab bar ONLY. H1 swaps with content so focus-restoration lands on a fresh H1. Narrows routing-and-urls.md §3.4's "title region" phrasing.
4. **CSP adds `'wasm-unsafe-eval'`** for Pagefind. Final seo.md Step 16 value updated.
5. **CI workflow named `ci.yml` from Sprint 1** (not `a11y.yml` later renamed).
6. **`src/content.config.ts` is canonical** (root-level, not `src/content/config.ts`). Confirmed already aligned in commit f72f8ce.
7. **`public/_redirects` owner**: routing-and-urls.md exclusive.
8. **`courseLabel` in `lastRead` envelope** = course's `title` field.
9. **404 featured course**: hard-code Phase 1 (`nodejs` or first course). `featured.yml` is for chapters, not courses.

### Cross-Check Verdicts

- `_headers` ownership (baseline/cache/CSP three-way split): ✅ consistent.
- `BaseLayout` prop surface: ⚠️ resolved via R2 above.
- Storage key naming: 🔴 → ✅ resolved via R1 above.
- Schema enrichment coordination: ✅ consistent (single PR-3.1 lands courses+chapters enrichment).
- Progress scripts: ✅ consistent (reader/writer contracts compatible once keys unified).
- `<ClientRouter />` persist: ⚠️ → ✅ resolved via R3 above.
- CSP allowlists: ⚠️ → ✅ resolved via R4 above.
- `_redirects` ownership: ✅ consistent.

### Open Questions — Status Summary

Roadmap §6 has the full 30-item table. Summary:
- **Ratified (11)**: Q#1, #2, #3, #4, #5, #6, #7, #8, #27, #28 + storage-consolidation deferral.
- **Blockers for Phase 1 (8)**: Q#9 (font licensing), #10 (astro-og-canvas availability at PR-1.5 start), #11 (CF Redirect Rule), #14 (author photo), #15 (socials), #16 (CONTRIBUTING.md), #17 (about.yml signoff), #18 (legal prose review), #20 (Mermaid spike PR-5.0), #24 (GitHub issue templates).
- **Deferred to Phase 1.5 / Phase 2 (11)**: Q#12, #13, #19, #21, #22, #23, #25, #26, #29, #30 + empty-shared-plans cleanup.

### Additional Gaps Flagged (folded into roadmap)

- Empty stub files `shared/design-system.md`, `shared/component-library.md`, `shared/layout-conventions.md` — Session 2 folded their concerns into the 6 plans it wrote; housekeeping item to delete or leave redirect stubs (Phase 1.5).
- Global footer ownership — legal.md §3.4 flagged as TODO but no owner. Roadmap assigns to PR-6.1 in Sprint 6.
- Deploy smoke tests — not in any shared plan. Roadmap assigns to PR-6.2.
- `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/` — needed to avoid 404s from About + all-courses CTAs. Roadmap assigns to Sprint 6.
- Cloudflare Pages dashboard runbook + rollback procedure — missing from shared plans. Roadmap adds PR-6.3.
- `.env.example` consolidated file — never owned. Roadmap assigns to PR-0.1.
- `src/lib/storage.ts` — decision locked in infra §10 but no plan owned implementation. Roadmap assigns to PR-0.1.

### Sprint Structure (final)

- 0 — Infrastructure bootstrap (4 PRs, 1–2 days)
- 1 — Shared primitives (5 PRs, 1.5 weeks)
- 2 — Shell validators + editorial pages (3 PRs, 3–4 days)
- 3 — Schema enrichment + catalog (2 PRs, 3–4 days)
- 4 — Course overview + home (2 PRs, 1 week)
- 5 — Chapter capstone (3 PRs incl. spike, 1.5 weeks)
- 6 — Launch readiness (4 PRs + external ops, 3–4 days)

Total: ~5 weeks, 23 PRs.

### Handoff to Implementation

- Read `.claude/plans/PHASE-1-ROADMAP.md` before starting any PR.
- Apply §2 ratifications everywhere they apply — do not re-argue them.
- Sprint 1 is sequential (PR-1.1 → PR-1.5). Sprints 2, 4 are parallel-safe within. Sprints 3, 5 are gated by prior PRs.
- Before Sprint 1 starts, resolve Q#9 (font licensing). Fallback exists (system stack) if not ready.
- Before PR-1.5, check `npm view astro-og-canvas` availability (Q#10). Fallback: `astro-satori`.
- PR-5.0 spike is mandatory before PR-5.1 (chapter) to de-risk Mermaid under ClientRouter.

### Blockers or Questions for User

No hard blockers for the planning phase. Implementation-phase blockers consolidated in roadmap §10 and §6 — sonushahuji4 owns Q#9, #11, #14, #15, #16, #17, #18, #24 and should sequence those alongside sprint starts.

### Files Created

- `.claude/plans/PHASE-1-ROADMAP.md`

### Files Modified

- `.claude/plans/SESSION-LOG.md` — this append.

No source files, config, or content touched. No dependencies installed. No commits created.
