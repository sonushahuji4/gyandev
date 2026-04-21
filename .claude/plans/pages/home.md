---
title: Home Page — Implementation Plan
status: draft
spec: .claude/specs/pages/home.md
created: 2026-04-20
session: 3
estimated_effort: 6–8 hours
dependencies:
  - .claude/plans/shared/routing-and-urls.md
  - .claude/plans/shared/responsive-breakpoints.md
  - .claude/plans/shared/accessibility.md
  - .claude/plans/shared/performance.md
  - .claude/plans/shared/seo.md
  - .claude/plans/pages/all-courses.md (schema enrichment + CourseCard + aggregate.ts + progress-hydrate)
  - .claude/plans/pages/course-overview.md (ProgressWidget if lifted)
---

# Implementation Plan: Home Page

## 1. Overview

The homepage at `/` composes five stacked sections: hero (brand + primary CTA), an optional "Continue where you left off" card hydrated from localStorage, the course grid (same `CourseCard` component used by `/courses`), a curated "Featured Reads" strip, and a "Recently Updated" list computed at build time from chapter `updated` dates. Content discovery runs on static data (courses collection + `src/content/featured.yml`); continue-reading and dismissal are tiny inline scripts that flip server-rendered hidden DOM visible based on localStorage. LCP is the hero headline (text-only). No framework islands. Ships `WebSite` + `SearchAction` JSON-LD. Target LCP < 2.0s (tighter than site-wide default).

## 2. Spec Reference

See `.claude/specs/pages/home.md`. Load-bearing requirements:

- §3 Five sections top-to-bottom: Hero → Continue Reading (conditional) → All Courses → Featured Reads → Recently Updated → Footer.
- §3.1 Hero: display heading, tagline, primary CTA to featured course, secondary CTA to `/courses`.
- §3.2 Continue Reading: renders only if `gyandev:v1.progress.lastRead` exists in localStorage; dismissible (sessionStorage).
- §3.3 Course grid: 3/2/1 columns at lg/md/mobile; same card anatomy as all-courses.
- §3.4 Featured: 5–6 hand-picked chapters in `src/content/featured.yml`.
- §3.5 Recently Updated: top 5 chapters by `updated` desc; "new" vs "updated" dot distinction.
- §5 Responsive behavior per breakpoints.
- §6 Data sources: Hero hard-coded, Continue Reading from localStorage, Courses from collection, Featured from YAML, Recent from collection.
- §7 Meta + OG image `/og/home.png`.
- §8 JSON-LD: `WebSite` with `SearchAction`.
- §9 Perf: LCP < 2.0s, CLS < 0.05, first course card interactive < 1s.
- §10 A11y: single H1, card elements are `<a>` with descriptive text, dismiss button has aria-label.
- §11 States: no courses / no featured / no recent / no progress → hide respective sections.

## 3. Technical Approach

**3.1 LCP is the hero headline (text).** Serif display text. No hero image. Loading Inter + Source Serif 4 font preload (FontPreload with `includeSerif={true}` per spec §3.1 and performance plan Step 3). Because text-LCP is extremely fast, hitting sub-2s is straightforward on Cloudflare Pages.

**3.2 Continue Reading is progressive enhancement, not SSR.** The server renders the Continue card with `hidden` attribute AND empty content. A single inline script:
1. Reads `localStorage['gyandev:v1.progress.lastRead']` (envelope: `{ v, data: { courseSlug, chapterSlug, chapterTitle, readingMinutes } }`).
2. If present AND not dismissed in `sessionStorage`, populates the card content and removes `hidden`.
3. Dismiss button writes a `sessionStorage` flag and hides the card.

LCP isn't affected (hero is above Continue Reading in the document flow). CLS isn't affected because the card reserves `min-height` during its hidden state — OR more cleanly, the card is `display: none` until hydration, and ignored for layout. Decision: `display: none` via `hidden` HTML attr (standard). Short flicker on hydration is acceptable; appears only for returning users.

**3.3 Featured chapters YAML.** `src/content/featured.yml` is a flat list of `{ courseId, chapterSlug }` refs. Page frontmatter calls `getEntries(featured.refs)` to resolve. If any ref resolves to a missing chapter, log a build warning and skip it. Add a `scripts/validate-featured.mjs` (optional, Phase 1 nice-to-have) to fail CI if featured.yml points to a non-existent chapter.

**3.4 Recently Updated from chapter collection.** One call to `getCollection('chapters', (c) => c.data.status === 'published')`, sort by `updated` desc, slice to 5. For each entry compute `isNew` as `(now - entry.data.published) < 7 days`. The dot color differs (new = accent, updated = muted) purely by CSS class.

**3.5 Reuse `CourseCard` from all-courses plan.** Don't re-invent. Import `src/components/pages/all-courses/CourseCard.astro`. Because the same component is used, promote it to `src/components/ui/CourseCard.astro` via a Session 4 housekeeping PR — flagged in §13. For Phase 1, reach across `pages/all-courses/`. The first course card in the home's grid is the LCP candidate on return visits without Continue card (rare); still set `priority` on first 3.

**3.6 `WebSite` + `SearchAction` JSON-LD.** The `SearchAction` has `"potentialAction": { "@type": "SearchAction", "target": { "@type": "EntryPoint", "urlTemplate": "https://gyandev.org/?q={search_term_string}" }, "query-input": "required name=search_term_string" }`. Because Pagefind renders via the `SearchModal` (not via a `/?q=` URL param), we can either:
- Option A: NOT wire `/?q=` routing → SearchAction is aspirational / misleading.
- Option B: Add a `/?q=` interceptor that opens `SearchModal` with the pre-filled query.

Decision: **Option B** (lightweight). The homepage adds a tiny inline script that checks `URLSearchParams.get('q')` on `astro:page-load` and if present, opens `SearchModal` pre-filled. Aligns SearchAction with real UX and costs ~10 lines of JS.

**3.7 Featured strip on horizontal-scroll at mobile.** Spec §5 "horizontal scroll optional". Implement as CSS-only `overflow-x: auto; scroll-snap-type: x mandatory` on mobile, grid on desktop. No JS.

## 4. File Structure

```
src/
  pages/
    index.astro                                     [modify stub → /]
  content/
    featured.yml                                    [create — { refs: [{ courseId, chapterSlug }] }]
  components/
    pages/
      home/
        HomeHero.astro                              [create — H1 + tagline + CTAs]
        ContinueReadingCard.astro                   [create — hidden, JS-shown]
        FeaturedStrip.astro                         [create — 5–6 chapter cards]
        ChapterCard.astro                           [create — used by Featured; possibly Recent later]
        RecentlyUpdatedList.astro                   [create — top-5 <ol>]
  lib/
    home/
      featured.ts                                   [create — resolve featured.yml → CollectionEntry[] ]
      recent.ts                                     [create — top-N chapters by updated]
  scripts/
    home-hydrate.ts                                 [create — Continue card + SearchAction query-string]
```

**Existing components reused (cross-plan):**
- `src/components/pages/all-courses/CourseCard.astro` (flag for promotion to ui/).
- `src/components/pages/all-courses/CourseGrid.astro`.

**Sample content required:**
- At least 1 published course with ≥ 5 chapters (so Featured can pick 5–6 and Recent has data).
- `src/content/featured.yml` with 5–6 entries.

## 5. Dependencies

**External:** none new.

**Internal — consumed:**
- `src/layouts/BaseLayout.astro`, `PageShell`, `SEO`, `JsonLd`.
- `src/components/ui/SmartImage.astro`.
- `src/components/perf/FontPreload.astro` — with `includeSerif={true}`.
- `src/lib/routes.ts` — `canonicalFor()`, `chapterUrl()`, `courseUrl()`.
- `src/lib/courses/aggregate.ts` (all-courses) — `getCourseStatsMap()`.
- `src/components/pages/all-courses/CourseCard.astro` + `CourseGrid.astro`.
- `src/scripts/progress-hydrate.ts` (all-courses) — for course cards' progress badges.

**Internal — new:**
- Five components under `src/components/pages/home/`.
- `src/lib/home/featured.ts`, `recent.ts`.
- `src/scripts/home-hydrate.ts`.
- `src/content/featured.yml`.

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — `/` stub, BaseLayout.
- `.claude/plans/shared/responsive-breakpoints.md` — PageShell, breakpoints.
- `.claude/plans/shared/accessibility.md` — H1, aria-label dismiss, keybindings for SearchModal.
- `.claude/plans/shared/performance.md` — FontPreload `includeSerif`, stricter LCP budget.
- `.claude/plans/shared/seo.md` — `WebSite` + `SearchAction` JSON-LD (already in seo plan §6 Step 3).
- `.claude/plans/pages/all-courses.md` — CourseCard, CourseGrid, aggregate.ts, progress-hydrate.ts.

## 6. Implementation Steps (Ordered)

1. **Add `featured` data collection to `src/content.config.ts`:**
   ```ts
   featured: defineCollection({
     loader: file('src/content/featured.yml'),
     schema: z.object({
       refs: z.array(z.object({
         courseId: z.string(),
         chapterSlug: z.string(),
       })).min(1).max(12),
     }),
   }),
   ```

2. **Create `src/content/featured.yml`** — start with a minimal file referencing the seeded sample chapter(s). If only 1 chapter exists at launch, include it once; the UI will still render (or gracefully show fewer).

3. **Create `src/lib/home/featured.ts`:**
   ```ts
   import { getEntry } from 'astro:content';
   import type { CollectionEntry } from 'astro:content';

   export async function resolveFeatured(refs: { courseId: string; chapterSlug: string }[]):
     Promise<CollectionEntry<'chapters'>[]> {
     const entries = await Promise.all(refs.map(async (r) => {
       const id = `${r.courseId}/${r.chapterSlug}/index`;     // match glob pattern
       const e = await getEntry('chapters', id);
       if (!e) console.warn('[featured] Missing chapter:', id);
       return e;
     }));
     return entries.filter(Boolean) as CollectionEntry<'chapters'>[];
   }
   ```

4. **Create `src/lib/home/recent.ts`:**
   ```ts
   import { getCollection, type CollectionEntry } from 'astro:content';
   export async function getRecentChapters(limit = 5): Promise<CollectionEntry<'chapters'>[]> {
     const all = await getCollection('chapters', (c) => c.data.status === 'published');
     return [...all]
       .sort((a, b) => +b.data.updated - +a.data.updated)
       .slice(0, limit);
   }
   export function isRecentlyNew(c: CollectionEntry<'chapters'>, nowMs = Date.now(), days = 7): boolean {
     return nowMs - +c.data.published < days * 86400000;
   }
   ```

5. **Create `src/components/pages/home/HomeHero.astro`:**
   - No props.
   - Renders optional small badge, H1 (display heading — two lines), tagline paragraph, two CTAs.
   - Primary CTA `<a href={courseUrl('nodejs')}>Start with Node.js →</a>`.
   - Secondary CTA `<a href="/courses">All courses</a>`.
   - If "featured course" concept is dynamic, a `featuredCourseSlug` prop OR read from a config file. Phase 1: hardcode `nodejs`. Flag for future config.
   - Done when: H1 is the document LCP element and focus lands here on page-load.

6. **Create `src/components/pages/home/ContinueReadingCard.astro`:**
   - No props at SSR time.
   - Renders skeleton `<section id="continue-card" hidden aria-labelledby="continue-h">` with H2 "Continue where you left off", empty slots for chapter title / course / reading time, and a "Resume →" link whose `href` is filled in by JS, plus a dismiss `<button aria-label="Dismiss resume card">×</button>`.
   - Hydrated by `home-hydrate.ts`.

7. **Create `src/components/pages/home/ChapterCard.astro`:**
   - Props: `{ chapter: CollectionEntry<'chapters'>; course: CollectionEntry<'courses'>; priority?: boolean }`.
   - Full-card `<a>` linking to `chapterUrl(courseSlug, chapterSlug)`.
   - Contents: course name (small, muted), H3 chapter title, 2-line description (`-webkit-line-clamp: 2`), meta row `{difficulty} · {readingMinutes} min`.
   - Optional thumbnail image (Phase 2). Phase 1 is text-only.

8. **Create `src/components/pages/home/FeaturedStrip.astro`:**
   - Props: `{ chapters: CollectionEntry<'chapters'>[]; courseMap: Map<string, CollectionEntry<'courses'>> }`.
   - Renders a `<section aria-label="Featured chapters">` with H2 "Featured Reads" and a horizontally-scrolling `<ul>` of `<ChapterCard>` on mobile; grid of 3 columns on `lg+`.
   - Accessibility: wrap the scroll region with `tabindex="0"` and label — or rely on keyboard arrow keys to scroll (standard browser behavior for overflow scrolls once focused).

9. **Create `src/components/pages/home/RecentlyUpdatedList.astro`:**
   - Props: `{ entries: Array<{ chapter: CollectionEntry<'chapters'>; isNew: boolean; course: CollectionEntry<'courses'> }> }`.
   - Renders H2 "Recently Updated" + `<ol class="recent-list">` of rows:
     ```html
     <li class="recent-row">
       <span class="dot" class:list={[isNew ? 'dot-new' : 'dot-updated']} aria-hidden="true"></span>
       <a href={chapterUrl(courseSlug, chapterSlug)}>{chapter.data.title}</a>
       — <span class="sr-only">{isNew ? 'new' : 'updated'} </span>
       <time datetime={updated.toISOString()}>{relativeTime(updated)}</time>
     </li>
     ```
   - `relativeTime(date)` computes "2 days ago" / "1 week ago" via `Intl.RelativeTimeFormat` at build time (deterministic enough for Phase 1; builds are daily-ish).
   - Dot colors via `--color-accent` (new) vs `--color-text-muted` (updated).

10. **Create `src/scripts/home-hydrate.ts`:**
    ```ts
    function hydrateContinue() {
      const card = document.getElementById('continue-card') as HTMLElement | null;
      if (!card) return;
      const dismissed = sessionStorage.getItem('gyandev:dismiss:continue') === '1';
      if (dismissed) { card.hidden = true; return; }
      try {
        const raw = localStorage.getItem('gyandev:v1.progress.lastRead');
        if (!raw) return;
        const env = JSON.parse(raw);
        const d = env?.data;
        if (!d?.courseSlug || !d?.chapterSlug) return;
        card.querySelector('.course')!.textContent = d.courseLabel ?? d.courseSlug;
        card.querySelector('.title')!.textContent = d.chapterTitle ?? 'Resume';
        card.querySelector('.meta')!.textContent = (d.readingMinutes ?? 0) + ' min read';
        const a = card.querySelector<HTMLAnchorElement>('a.resume');
        if (a) a.href = '/courses/' + d.courseSlug + '/' + d.chapterSlug;
        card.hidden = false;
      } catch {}
    }
    function wireDismiss() {
      document.getElementById('continue-dismiss')?.addEventListener('click', () => {
        sessionStorage.setItem('gyandev:dismiss:continue', '1');
        document.getElementById('continue-card')?.toggleAttribute('hidden', true);
      });
    }
    function hydrateSearchQuery() {
      const q = new URL(location.href).searchParams.get('q');
      if (!q) return;
      const modal = document.getElementById('search-modal') as HTMLDialogElement | null;
      if (!modal || typeof modal.showModal !== 'function') return;
      modal.showModal();
      const input = modal.querySelector<HTMLInputElement>('input[type="search"]');
      if (input) { input.value = q; input.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    function run() { hydrateContinue(); wireDismiss(); hydrateSearchQuery(); }
    run();
    document.addEventListener('astro:page-load', run);
    ```
    - Imported from page via `<script>import '../scripts/home-hydrate';</script>`.

11. **Replace `src/pages/index.astro`:**
    ```astro
    ---
    import { getCollection, getEntry } from 'astro:content';
    import PageShell from '../components/layout/PageShell.astro';
    import HomeHero from '../components/pages/home/HomeHero.astro';
    import ContinueReadingCard from '../components/pages/home/ContinueReadingCard.astro';
    import CourseGrid from '../components/pages/all-courses/CourseGrid.astro';
    import FeaturedStrip from '../components/pages/home/FeaturedStrip.astro';
    import RecentlyUpdatedList from '../components/pages/home/RecentlyUpdatedList.astro';
    import { websiteSchema } from '../lib/seo/jsonld';
    import { canonicalFor } from '../lib/routes';
    import { getCourseStatsMap } from '../lib/courses/aggregate';
    import { resolveFeatured } from '../lib/home/featured';
    import { getRecentChapters, isRecentlyNew } from '../lib/home/recent';

    const courses = (await getCollection('courses'))
      .filter((c) => c.data.status === 'published')
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
    const stats = await getCourseStatsMap();

    const featuredEntry = await getEntry('featured', 'featured');
    const featured = featuredEntry ? await resolveFeatured(featuredEntry.data.refs) : [];

    const recent = await getRecentChapters(5);
    const courseMap = new Map(courses.map((c) => [c.id.split('/')[0], c]));
    const recentDecorated = recent.map((chapter) => ({
      chapter,
      isNew: isRecentlyNew(chapter),
      course: courseMap.get(chapter.data.course.id) ?? courses[0],
    }));

    const canonical = canonicalFor('/');
    const jsonLd = [websiteSchema()];
    ---
    <PageShell
      title="Deep notes for modern developers"
      description="Learn how JavaScript, Node.js, System Design, and DSA actually work. In-depth notes with three views: Full Notes, Quick Revision, Flow Diagrams."
      canonical={canonical}
      ogImage={canonicalFor('/og/home.png')}
      jsonLd={jsonLd}
      includeSerif={true}  <!-- forwarded to FontPreload via BaseLayout -->
    >
      <HomeHero />
      <ContinueReadingCard />
      {courses.length > 0 && (
        <section aria-label="All courses">
          <h2>All Courses</h2>
          <p class="section-sub">Pick your path</p>
          <CourseGrid courses={courses.map((course) => ({ course, stats: stats.get(course.id) ?? { chapterCount: 0, totalReadingMinutes: 0, publishedChapters: 0 } }))} />
        </section>
      )}
      {featured.length > 0 && (
        <FeaturedStrip chapters={featured} courseMap={courseMap} />
      )}
      {recentDecorated.length > 0 && (
        <RecentlyUpdatedList entries={recentDecorated} />
      )}
    </PageShell>

    <script>import '../scripts/home-hydrate';</script>
    <script>import '../scripts/progress-hydrate';</script>
    ```

12. **Pass `includeSerif` through BaseLayout.** Small amendment to `.claude/plans/shared/routing-and-urls.md` BaseLayout Props — or expose `includeSerif?: boolean` on `PageShell` that forwards to `<FontPreload>`. Default false; home sets true. Flag in §13 as a tiny cross-plan tweak.

13. **OG image `/og/home.png`** — via seo plan's static-page OGImageRoute (seo plan §6 Step 10).

14. **Validate `WebSite` JSON-LD `SearchAction` matches real behavior.** Add a test case in `scripts/validate-schema.mjs` (seo plan) that asserts the homepage contains `"@type": "SearchAction"` AND that a URL `/?q=test` triggers SearchModal opening — latter is manual/e2e.

## 7. Component/Module API Design

### `src/components/pages/home/HomeHero.astro`
```ts
interface Props {} // Phase 1: no props. Phase 2: accept featuredCourseSlug.
```

### `src/components/pages/home/ContinueReadingCard.astro`
```ts
interface Props {} // SSR-empty skeleton, JS-populated.
```

### `src/components/pages/home/ChapterCard.astro`
```ts
interface Props {
  chapter: CollectionEntry<'chapters'>;
  course: CollectionEntry<'courses'>;
  priority?: boolean;
}
```

### `src/components/pages/home/FeaturedStrip.astro`
```ts
interface Props {
  chapters: CollectionEntry<'chapters'>[];
  courseMap: Map<string, CollectionEntry<'courses'>>;
}
```

### `src/components/pages/home/RecentlyUpdatedList.astro`
```ts
interface Props {
  entries: Array<{
    chapter: CollectionEntry<'chapters'>;
    isNew: boolean;
    course: CollectionEntry<'courses'>;
  }>;
}
```

### `src/lib/home/featured.ts`
```ts
function resolveFeatured(refs: { courseId: string; chapterSlug: string }[]): Promise<CollectionEntry<'chapters'>[]>;
```

### `src/lib/home/recent.ts`
```ts
function getRecentChapters(limit?: number): Promise<CollectionEntry<'chapters'>[]>;
function isRecentlyNew(c: CollectionEntry<'chapters'>, nowMs?: number, days?: number): boolean;
```

### New components flagged for component library
- `ChapterCard` — used here; chapter page prev/next cards in `chapter.md` may reuse. If so, promote to `src/components/ui/ChapterCard.astro` in Session 4.
- `RecentlyUpdatedList` — page-scoped.
- `FeaturedStrip` — page-scoped.
- `ContinueReadingCard` — page-scoped.

### Extension to other plans
- Small: `PageShell.astro` gains `includeSerif?: boolean` prop that forwards to `FontPreload`. Update `.claude/plans/shared/responsive-breakpoints.md` Step 11 (PageShell) — not breaking.
- Featured data collection in `src/content.config.ts` — affects routing + seo plans' ignore rules: `/featured.yml` is not a route; no sitemap impact.

## 8. Code Patterns

**Pattern: Conditional sections hide when empty.**
```astro
{featured.length > 0 && <FeaturedStrip chapters={featured} courseMap={courseMap} />}
```

**Pattern: Two inline scripts at page end — one for Continue/dismiss/search-query, one for progress badges on course cards.** Both imported as modules so Astro bundles them.

**Pattern: Relative time via `Intl.RelativeTimeFormat`.**
```ts
function relativeTime(date: Date, now = new Date()): string {
  const diff = (+date - +now) / 1000;                              // seconds
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ];
  for (const [unit, sec] of units) {
    if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), unit);
  }
  return rtf.format(Math.round(diff), 'second');
}
```

**Pattern: Scroll-snap horizontal strip on mobile only.**
```css
.featured-strip ul { display: grid; grid-auto-flow: column; overflow-x: auto; scroll-snap-type: x mandatory; }
.featured-strip li { scroll-snap-align: start; min-width: 85%; }
@media (min-width: 1024px) {
  .featured-strip ul { grid-auto-flow: row; grid-template-columns: repeat(3, 1fr); overflow: visible; }
  .featured-strip li { min-width: 0; }
}
```

**Pattern: WebSite JSON-LD with SearchAction pointing to `/?q=`.** Matches the real hydration path.

## 9. Testing Strategy

**Build:**
- `dist/index.html` contains H1 text, course grid, featured list (if present), recent list.
- LCP candidate = hero H1 (verify via Chrome DevTools: Performance → LCP).

**SEO:**
- Rich Results Test: `WebSite` with `potentialAction: SearchAction`.
- OG image `/og/home.png` exists.
- Twitter + Facebook debug tools render previews.

**A11y:**
- axe-core green.
- Single H1; H2 per section.
- Dismiss button has `aria-label="Dismiss resume card"`.
- Card `<a>` elements have non-generic text ("Read Origin Story" not "read more"): enforce via content in titles (H3 is link body).

**Perf (stricter than baseline):**
- Lighthouse desktop: LCP < 2.0s, CLS < 0.05, TBT < 150ms, perf ≥ 95.
- Lighthouse mobile: LCP < 2.5s, CLS < 0.05.
- Bundle check: JS bundle < 5 KB gzipped (two small hydration modules + progress).
- DevTools: font preload fires before first paint; serif applied to hero without FOIT beyond 200ms.

**Interactive:**
- Fresh visit: Continue card hidden; course grid visible.
- After visiting `nodejs/01-intro` and returning to `/`: Continue card appears with correct title + URL.
- Click dismiss: card hides; reload: still hidden (same session); new session: reappears.
- `/?q=closures` opens SearchModal with "closures" pre-filled.

**Manual:**
- 375px: everything stacks, featured strip horizontally scrolls with snap.
- 768px: 2-col course grid.
- 1024px+: 3-col grid; featured strip becomes 3-col grid (no scroll).

**Ship gates:**
- All sections render without errors when featured.yml has 1 entry OR 0 entries (degrades gracefully).
- Homepage builds with zero chapters (shows courses; Featured + Recent hidden).

## 10. Rollout Plan

Depends on:
- Shared plans landed.
- `all-courses.md` landed (CourseCard + CourseGrid + aggregate.ts + progress-hydrate.ts).

Sequence:
1. Content collection extension (Step 1) + featured.yml scaffold (Step 2).
2. Utilities (Steps 3–4).
3. Components (Steps 5–9).
4. Hydration script (Step 10).
5. Page body (Step 11).
6. PageShell `includeSerif` prop amendment (Step 12).
7. OG route (Step 13).

**Sample content required:**
- ≥ 1 published course with ≥ 5 chapters. Anything less and Featured degrades to fewer cards.
- `src/content/featured.yml` with 5–6 entries.
- Chapter `updated` + `published` dates set to realistic values so `isRecentlyNew()` produces a visible mix.

## 11. Risks and Mitigations

- **Risk: `featured.yml` references dead chapters after a slug rename.**
  - Likelihood: medium
  - Impact: low (warn at build; skip card silently)
  - Mitigation: `scripts/validate-featured.mjs` — optional CI gate. For Phase 1, a build warning is enough.

- **Risk: Continue card's localStorage payload shape differs from what chapter page writes.**
  - Likelihood: medium (contract defined in two places)
  - Impact: medium (Continue card silently does nothing)
  - Mitigation: define the contract in one place — `.claude/plans/pages/chapter.md` owns the writer; this plan owns the reader; both reference `src/lib/storage.ts`'s schema. Current assumed envelope: `{ v: 1, data: { courseSlug, chapterSlug, chapterTitle, readingMinutes, courseLabel } }`. Ratify with chapter plan.

- **Risk: Featured strip scroll-snap breaks on iOS Safari with its elastic scroll.**
  - Likelihood: low
  - Impact: low
  - Mitigation: test on iOS; fall back to plain horizontal scroll without snap if buggy.

- **Risk: SearchAction `urlTemplate` advertises behavior that disappears if SearchModal refactor drops query-string handling.**
  - Likelihood: low
  - Impact: medium (misleading SEO)
  - Mitigation: `home-hydrate.ts` owns the `?q=` interceptor; any refactor of SearchModal must preserve that path. Document contract in seo plan + this plan.

- **Risk: `Intl.RelativeTimeFormat` "1 week ago" is computed at build time, so "a day ago" becomes "2 days ago" on day 2 without a rebuild.**
  - Likelihood: high (static builds don't update)
  - Impact: low (minor staleness)
  - Mitigation: scheduled builds daily via Cloudflare Pages deploy-on-schedule OR compute the relative time client-side via `astro:page-load` using the ISO `<time datetime>`. Decision: compute client-side — pairs well with the existing hydrate script. Flag to move in Phase 1.5.

- **Risk: LCP regresses when adding Continue card — it's above the grid.**
  - Likelihood: low (card starts hidden)
  - Impact: low
  - Mitigation: card is `hidden` at first paint; browser treats it as display:none; LCP remains the hero H1.

- **Risk: Cross-use of `CourseCard` from `pages/all-courses/` drives premature promotion.**
  - Likelihood: medium
  - Impact: low
  - Mitigation: accept the cross-page import for now; Session 4 roadmap promotes to `src/components/ui/CourseCard.astro`.

## 12. Done When

- [ ] `src/content.config.ts` defines `featured` collection.
- [ ] `src/content/featured.yml` exists with ≥ 1 entry.
- [ ] Three utilities in `src/lib/home/` exist: featured, recent.
- [ ] Five components in `src/components/pages/home/` exist.
- [ ] `src/scripts/home-hydrate.ts` handles Continue card + dismiss + ?q= interceptor.
- [ ] `src/pages/index.astro` renders via `PageShell` with all conditional sections.
- [ ] H1 is the LCP element; Lighthouse LCP < 2.0s desktop, < 2.5s mobile.
- [ ] `WebSite` + `SearchAction` JSON-LD validates.
- [ ] `/og/home.png` generated.
- [ ] Dismiss button a11y verified.
- [ ] Continue card hydrates from real localStorage progress.
- [ ] `/?q=foo` opens SearchModal with "foo" pre-filled.
- [ ] Conditional rendering: page remains valid with 0 courses / 0 featured / 0 recent.
- [ ] Bundle < 5 KB gzipped JS.

## 13. Open Questions

- [ ] **Featured-course hardcoding in HomeHero.** Phase 1 hardcodes `nodejs`. Phase 2: add a `src/content/site.yml` key or reuse `about.yml` site config. Flag.
- [ ] **`PageShell.includeSerif` prop.** Small cross-plan extension — add in the same PR as home lands.
- [ ] **Relative time: build-time or runtime?** Default plan: build-time via `Intl.RelativeTimeFormat`; switch to runtime (`home-hydrate.ts`) in Phase 1.5 when staleness becomes noticeable. Decision now: compute server-side for LCP; hydrate client-side on page-load.
- [ ] **Featured fallback when YAML is empty.** Default: hide the section. OK per spec §11.
- [ ] **Thumbnail on ChapterCard.** Phase 2 per spec §3.4.
- [ ] **Newsletter signup.** Phase 2 per spec §13.
- [ ] **Hero demo animation / SVG.** Start text-only per spec §13.
- [ ] **`gyandev:v1.progress.lastRead` vs plan's storage keys (`gyandev:progress:<courseId>`).** Two different records. Ratify in infrastructure plan / storage.ts schema.
- [ ] **`ChapterCard` shape differs from `CourseCard`** — kept separate in this plan. Promote both to `src/components/ui/` in Session 4.

## 14. References

- Spec: `.claude/specs/pages/home.md`
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — `/` stub, BaseLayout, ClientRouter.
  - `.claude/plans/shared/responsive-breakpoints.md` — PageShell, grid patterns, `includeSerif` prop extension.
  - `.claude/plans/shared/accessibility.md` — SkipLink, keybindings (SearchModal).
  - `.claude/plans/shared/performance.md` — FontPreload with serif, stricter LCP budget, SmartImage.
  - `.claude/plans/shared/seo.md` — WebSite + SearchAction JSON-LD.
  - `.claude/plans/pages/all-courses.md` — CourseCard, CourseGrid, aggregate.ts, progress-hydrate.ts.
  - `.claude/plans/pages/chapter.md` — `lastRead` writer side of the localStorage contract.
- External:
  - [Schema.org WebSite + SearchAction](https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox)
  - [Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)
  - [MDN — scroll-snap-type](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type)
