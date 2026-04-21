---
title: All Courses Page — Implementation Plan
status: draft
spec: .claude/specs/pages/all-courses.md
created: 2026-04-20
session: 3
estimated_effort: 4–5 hours
dependencies:
  - .claude/plans/shared/routing-and-urls.md
  - .claude/plans/shared/responsive-breakpoints.md
  - .claude/plans/shared/accessibility.md
  - .claude/plans/shared/performance.md
  - .claude/plans/shared/seo.md
---

# Implementation Plan: All Courses Page

## 1. Overview

`/courses` is a static catalog grid listing every course in the `courses` content collection, sorted with published courses first (alphabetical) and "coming soon" courses after. Each row is a `CourseCard` — a self-contained link with icon, name, one-liner, stats (chapter count, reading time, difficulty), a progress badge if the user has read ≥ 1 chapter, and a "Coming soon" badge when the course isn't published. Progress is hydrated client-side from `localStorage` via a tiny script (no framework island). The page emits an `ItemList` → `Course` JSON-LD tree for SEO. A stats banner at the top sums total courses / chapters / hours. No filters in Phase 1 (flagged for Phase 2 per spec §3.2).

## 2. Spec Reference

See `.claude/specs/pages/all-courses.md`. Load-bearing requirements:

- §3 Sections: Page Header (breadcrumbs + H1 + stats bar) → Course Grid → optional CTA section.
- §3.3 Card anatomy: logo, name, description, stats, progress badge if started, "coming soon" badge if unpublished.
- §3.3 Sort: published first alphabetical, then coming-soon alphabetical.
- §3.3 Layout: 1 col mobile, 2 col tablet, 3 col desktop.
- §5 Data sources: courses collection + aggregated chapter counts + reading-time sums + localStorage progress.
- §6 Interactions: full-card click; progress tooltip on hover; coming-soon cards have no-nav.
- §7 Meta with self-canonical `/courses`.
- §8 JSON-LD: `ItemList` of `Course` items.
- §9 Perf: < 40 KB total; first-row images not lazy.
- §10 A11y: H1, cards are `<a>`, progress aria-label, `aria-disabled="true"` on coming-soon cards.
- §11 States: empty courses (unlikely), all-completed celebration banner, no-progress normal view.

## 3. Technical Approach

**3.1 Static generation with precomputed aggregates.** At build time, iterate `getCollection('chapters')` once, group by course id, precompute per-course: `chapterCount`, `totalReadingMinutes`, `difficulty` (from course frontmatter). Pass the precomputed map to `CourseCard` so cards don't re-query the collection 12 times.

**3.2 Course metadata in the `courses` collection.** Relies on the collection schema enriched by this plan: `description`, `order`, `status: 'published' | 'coming-soon'`, `difficulty`, `icon` (static asset path), `learningObjectives[]`. Extends the stub from `.claude/plans/shared/routing-and-urls.md` Step 2.

**3.3 Progress is a client enhancement, not SSR.** The card renders its server-side skeleton with an empty progress badge (`display: none`). A single inline `<script>` at the bottom of the page reads `localStorage['gyandev:progress:<courseId>']` for each course, updates the matching `.progress-badge` DOM node, and announces "X of Y completed" to SR via the `aria-label`. No framework island, no client:* directive. Budget: < 1 KB inline JS.

**3.4 No filters in Phase 1.** Spec §3.2 defers filters. We render a flat grid. The `CourseCard` has a `data-tags="frontend,beginner"` attribute reserved for Phase 2 filtering — zero cost now, easy to activate later.

**3.5 JSON-LD `ItemList`.** Schema factory `courseListSchema(items[])` extends `src/lib/seo/jsonld.ts`. Emits `ItemList` with one `{ '@type': 'Course', position, name, description, url }` per published course. Exclude coming-soon courses from the schema (they have no canonical URL yet).

**3.6 LCP is the first row of course icons.** Per spec §9, images in the first visible row are not lazy. We pass `priority={true}` to `<SmartImage>` on the first N cards (N = 3 at desktop, 2 at tablet, 1 at mobile — since we can't reliably predict viewport, we mark the first 3 cards as priority; cost is minor if tablet renders only 2).

**3.7 All-completed celebration banner.** Per spec §11, if progress state shows every published course complete, show "You've completed everything! 🎉". This is client-side only — it's a nice-to-have, not SSR. Banner DOM exists hidden; the same inline progress script flips it visible if the completion aggregate matches.

## 4. File Structure

```
src/
  pages/
    courses/
      index.astro                                   [modify stub → /courses]
  components/
    pages/
      all-courses/
        CoursesHeader.astro                         [create — breadcrumbs + H1 + stats bar]
        CourseGrid.astro                            [create — responsive grid wrapper]
        CourseCard.astro                            [create — single course tile]
        CompletionBanner.astro                      [create — hidden, JS-shown]
        RequestCourseCTA.astro                      [create — GitHub issue link]
  lib/
    courses/
      aggregate.ts                                  [create — precompute per-course stats from chapters collection]
    seo/
      jsonld.ts                                     [modify — add courseListSchema()]
  scripts/
    progress-hydrate.ts                             [create — client-side inline script for progress badges]
```

**Course collection schema enrichment** (modifies `src/content.config.ts` — flagged as a dependency, also needed by `course-overview.md` and `home.md`):
```ts
courses: defineCollection({
  loader: glob({ pattern: '**/course.mdx', base: './src/content/courses' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    status: z.enum(['published', 'coming-soon']).default('published'),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    icon: z.string().optional(),
    learningObjectives: z.array(z.string()).default([]),
    prerequisites: z.array(z.string()).default([]),
    related: z.array(reference('courses')).default([]),
    updated: z.date(),
  }),
});
```

**Sample content required:**
- At least 2 courses in `src/content/courses/<slug>/course.mdx` (one published, one coming-soon recommended).
- At least 1 chapter per published course so aggregate.ts produces non-zero counts.

## 5. Dependencies

**External:** none new.

**Internal — consumed:**
- `src/layouts/BaseLayout.astro`, `src/components/layout/PageShell.astro`.
- `src/components/seo/SEO.astro`, `JsonLd.astro`, `Breadcrumbs.astro`.
- `src/components/ui/SmartImage.astro`.
- `src/lib/routes.ts` — `canonicalFor()`, `courseUrl()`.
- `src/lib/storage.ts` (infrastructure plan) — `readJSON('progress:<courseId>')`.

**Internal — new:**
- Five components under `src/components/pages/all-courses/`.
- `src/lib/courses/aggregate.ts`.
- `src/scripts/progress-hydrate.ts`.
- `courseListSchema()` in `src/lib/seo/jsonld.ts`.

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — `/courses` route stub; collection stub to enrich.
- `.claude/plans/shared/responsive-breakpoints.md` — PageShell, responsive grid.
- `.claude/plans/shared/accessibility.md` — aria-label for progress, `aria-disabled` for unpublished.
- `.claude/plans/shared/performance.md` — SmartImage, no framework islands, LCP first row.
- `.claude/plans/shared/seo.md` — `<SEO>`, `<Breadcrumbs>`, JSON-LD extension.

## 6. Implementation Steps (Ordered)

1. **Enrich `src/content.config.ts`** — update `courses` schema per §4 above. Add `chapters` schema enrichment (reading-time field, difficulty, status) in tandem:
   ```ts
   chapters: defineCollection({
     loader: glob({ pattern: '**/index.mdx', base: './src/content/courses' }),
     schema: z.object({
       title: z.string(),
       description: z.string(),
       course: reference('courses'),
       order: z.number(),
       season: z.number().default(1),
       difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
       type: z.enum(['tutorial', 'howto', 'reference', 'explanation']).default('tutorial'),
       readingMinutes: z.number().positive(),
       status: z.enum(['published', 'draft']).default('published'),
       published: z.date(),
       updated: z.date(),
       tags: z.array(z.string()).default([]),
     }),
   });
   ```
   **Cross-plan note**: this schema also supports course-overview, chapter, and home plans — write the enrichment once here, reference from sibling plans.
   - Done when: `astro check` passes and all three consuming plans can use the same fields.

2. **Create `src/lib/courses/aggregate.ts`:**
   ```ts
   import { getCollection, type CollectionEntry } from 'astro:content';
   export interface CourseStats {
     chapterCount: number;
     totalReadingMinutes: number;
     publishedChapters: number;
     firstChapterSlug?: string;  // for Resume / Start links
   }
   export async function getCourseStatsMap(): Promise<Map<string, CourseStats>> {
     const chapters = await getCollection('chapters');
     const byCourse = new Map<string, CollectionEntry<'chapters'>[]>();
     for (const ch of chapters) {
       const courseId = ch.data.course.id;
       const arr = byCourse.get(courseId) ?? [];
       arr.push(ch);
       byCourse.set(courseId, arr);
     }
     const result = new Map<string, CourseStats>();
     for (const [courseId, entries] of byCourse) {
       const published = entries.filter((e) => e.data.status === 'published');
       const sorted = [...published].sort((a, b) => a.data.order - b.data.order);
       result.set(courseId, {
         chapterCount: entries.length,
         totalReadingMinutes: published.reduce((s, e) => s + e.data.readingMinutes, 0),
         publishedChapters: published.length,
         firstChapterSlug: sorted[0]?.id.split('/').slice(1, -1).join('/'),
       });
     }
     return result;
   }
   ```
   - Done when: unit or smoke test with fixtures returns the expected map.

3. **Extend `src/lib/seo/jsonld.ts`** — add factory:
   ```ts
   export function courseListSchema(items: Array<{
     name: string; description: string; url: string;
   }>): ItemList {
     return {
       '@context': 'https://schema.org',
       '@type': 'ItemList',
       itemListElement: items.map((item, i) => ({
         '@type': 'ListItem',
         position: i + 1,
         item: { '@type': 'Course', name: item.name, description: item.description, url: item.url,
                 provider: { '@type': 'Organization', name: 'GyanDev', url: 'https://gyandev.org' } },
       })),
     };
   }
   ```
   - Flag for seo plan update: add to `.claude/plans/shared/seo.md` §6 Step 3.

4. **Create `src/components/pages/all-courses/CoursesHeader.astro`:**
   - Props: `{ courseCount: number; chapterCount: number; totalHours: number }`.
   - Renders `<Breadcrumbs items={[Home, Courses]} />`, H1 "All Courses", sub-line "Everything we teach, in depth.", and a stats bar `<p class="stats">{courseCount} courses · {chapterCount} chapters · ~{totalHours} hours total</p>`.
   - `totalHours` is `Math.round(totalMinutes / 60)` computed in page.

5. **Create `src/components/pages/all-courses/CourseCard.astro`:**
   - Props: `{ course: CollectionEntry<'courses'>; stats: CourseStats; priority?: boolean }`.
   - Wrap entire card content in `<a>` when `course.data.status === 'published'`; wrap in `<div aria-disabled="true">` when `'coming-soon'` (no `<a>`, full card not clickable).
   - Layout: icon top, name (H3 inside the `<a>` — acceptable per WCAG because `<h3>` inside `<a>` is valid; SR announces both the link and heading).
   - Icon via `<SmartImage src={course.data.icon} alt="" width={64} height={64} priority={priority} />` — alt empty because the course name next to it is the meaningful label.
   - Stats line: `{stats.publishedChapters} chapters · ~{Math.round(stats.totalReadingMinutes / 60)} hours · {course.data.difficulty}`.
   - Progress badge: empty `<span class="progress-badge" data-course-id={course.id.split('/')[0]} data-total={stats.publishedChapters}></span>` — hidden until JS fills it.
   - Coming-soon badge: `{course.data.status === 'coming-soon' && <span class="badge">Coming soon</span>}`.
   - On hover: box-shadow and border-color change per design tokens in `global.css`.
   - Done when: keyboard Tab lands on each published card's link; coming-soon card is skipped by Tab (no `tabindex`).

6. **Create `src/components/pages/all-courses/CourseGrid.astro`:**
   - Props: `{ courses: Array<{ course: CollectionEntry<'courses'>; stats: CourseStats }> }`.
   - Renders `<section aria-label="All courses"><ul class="course-grid" role="list">…</ul></section>`.
   - CSS: `grid-template-columns: 1fr;` default; `@media (min-width: 768px) { grid-template-columns: repeat(2, 1fr); }`; `@media (min-width: 1024px) { grid-template-columns: repeat(3, 1fr); }`.
   - Iterates `courses` and renders `<li><CourseCard priority={i < 3} ... /></li>` — first three get LCP priority.
   - Done when: grid adapts at 1-col / 2-col / 3-col breakpoints and cards render in sort order.

7. **Create `src/components/pages/all-courses/RequestCourseCTA.astro`:**
   - No props. Static text: "Want a course on something specific? [Suggest a course on GitHub →]" with a link to a GitHub issue template (same pattern as 404 ReportLink).

8. **Create `src/components/pages/all-courses/CompletionBanner.astro`:**
   - No props. Renders a `<div id="all-complete-banner" class="celebration-banner" hidden>…</div>`.
   - Hidden by default via HTML `hidden` attribute. JS script flips `hidden` off when all courses complete.

9. **Create `src/scripts/progress-hydrate.ts`:**
   ```ts
   export const PROGRESS_HYDRATE = `
     (() => {
       const badges = document.querySelectorAll('.progress-badge[data-course-id]');
       let allComplete = badges.length > 0;
       for (const b of badges) {
         const key = 'gyandev:progress:' + b.dataset.courseId;
         try {
           const raw = localStorage.getItem(key);
           if (!raw) { allComplete = false; continue; }
           const { v, data } = JSON.parse(raw);
           const read = Array.isArray(data?.read) ? data.read.length : 0;
           const total = Number(b.dataset.total) || 0;
           if (read <= 0) { allComplete = false; continue; }
           b.textContent = read + ' of ' + total + ' read';
           b.setAttribute('aria-label', read + ' of ' + total + ' chapters read');
           b.hidden = false;
           if (read < total) allComplete = false;
         } catch { allComplete = false; }
       }
       if (allComplete) {
         const banner = document.getElementById('all-complete-banner');
         if (banner) banner.hidden = false;
       }
     })();
   `;
   ```
   - Storage envelope `{ v, data }` matches `.claude/plans/RESEARCH.md` Topic 13 and `src/lib/storage.ts`.
   - Page emits via `<script is:inline set:html={PROGRESS_HYDRATE} />` at the end of `<body>` (placement matters: after all `.progress-badge` nodes exist).
   - Re-run on `astro:page-load` via `<ClientRouter />` so back-forward navigation refreshes badges (the same pattern will be reused by course-overview and home plans).

10. **Replace `src/pages/courses/index.astro`:**
    ```astro
    ---
    import { getCollection } from 'astro:content';
    import PageShell from '../../components/layout/PageShell.astro';
    import CoursesHeader from '../../components/pages/all-courses/CoursesHeader.astro';
    import CourseGrid from '../../components/pages/all-courses/CourseGrid.astro';
    import CompletionBanner from '../../components/pages/all-courses/CompletionBanner.astro';
    import RequestCourseCTA from '../../components/pages/all-courses/RequestCourseCTA.astro';
    import { getCourseStatsMap } from '../../lib/courses/aggregate';
    import { courseListSchema } from '../../lib/seo/jsonld';
    import { canonicalFor, courseUrl } from '../../lib/routes';
    import { PROGRESS_HYDRATE } from '../../scripts/progress-hydrate';

    const allCourses = await getCollection('courses');
    const stats = await getCourseStatsMap();

    const published = allCourses
      .filter((c) => c.data.status === 'published')
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
    const coming = allCourses
      .filter((c) => c.data.status === 'coming-soon')
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
    const sorted = [...published, ...coming];

    const courseCount = published.length;
    const chapterCount = [...stats.values()].reduce((s, v) => s + v.publishedChapters, 0);
    const totalHours = Math.round([...stats.values()].reduce((s, v) => s + v.totalReadingMinutes, 0) / 60);

    const jsonLd = [courseListSchema(published.map((c) => ({
      name: c.data.title,
      description: c.data.description,
      url: canonicalFor(courseUrl(c.id.split('/')[0])),
    })))];

    const canonical = canonicalFor('/courses');
    ---
    <PageShell
      title="All Courses"
      description="Browse all GyanDev courses: JavaScript, Node.js, System Design, DSA, and more. Deep notes with Full Notes, Quick Revision, and Flow Diagram views."
      canonical={canonical}
      ogImage={canonicalFor('/og/courses.png')}
      jsonLd={jsonLd}
    >
      <CoursesHeader courseCount={courseCount} chapterCount={chapterCount} totalHours={totalHours} />
      <CompletionBanner />
      <CourseGrid courses={sorted.map((course) => ({ course, stats: stats.get(course.id) ?? { chapterCount: 0, totalReadingMinutes: 0, publishedChapters: 0 } }))} />
      <RequestCourseCTA />
    </PageShell>

    <script is:inline set:html={PROGRESS_HYDRATE} />
    <script>
      // re-run on ClientRouter page-load
      document.addEventListener('astro:page-load', () => {
        // eval PROGRESS_HYDRATE string in-page; cheaper: reimport the module when we make it a real .ts import
      });
    </script>
    ```
    **Better pattern** (preferred over `set:html` + eval): `import './progress-hydrate'` as a bundled module that self-attaches to `astro:page-load`. Decision: ship as a bundled module at `src/scripts/progress-hydrate.ts` that Astro includes via `<script>import '../../scripts/progress-hydrate';</script>` — Astro bundles + tree-shakes per page.

11. **Add OG route** `src/pages/og/courses.png.ts` — single-entry OGImageRoute or extend the static-pages map in seo plan Step 10.

12. **Update `.claude/plans/shared/seo.md` §8 serialize rules**: `/courses` (All Courses) should have `priority: 0.7`. Already covered by the existing serialize logic; no change required.

## 7. Component/Module API Design

### `src/components/pages/all-courses/CoursesHeader.astro`
```ts
interface Props { courseCount: number; chapterCount: number; totalHours: number; }
```

### `src/components/pages/all-courses/CourseCard.astro`
```ts
interface Props {
  course: CollectionEntry<'courses'>;
  stats: CourseStats;
  priority?: boolean;  // first row only
}
```

### `src/components/pages/all-courses/CourseGrid.astro`
```ts
interface Props {
  courses: Array<{ course: CollectionEntry<'courses'>; stats: CourseStats }>;
}
```

### `src/components/pages/all-courses/CompletionBanner.astro` / `RequestCourseCTA.astro`
No props.

### `src/lib/courses/aggregate.ts`
```ts
interface CourseStats {
  chapterCount: number;
  totalReadingMinutes: number;
  publishedChapters: number;
  firstChapterSlug?: string;
}
async function getCourseStatsMap(): Promise<Map<string, CourseStats>>;
```

### Extended `src/lib/seo/jsonld.ts`
```ts
function courseListSchema(items: { name; description; url }[]): ItemList;
```

### New components flagged for component library
- `CourseCard` — reusable by `home.md` (featured-course cards) and `course-overview.md` (related-course sidebar). Promote to shared `src/components/ui/CourseCard.astro` once a second consumer exists. For now, keep page-scoped under `src/components/pages/all-courses/` and reference from home plan.
- `CompletionBanner` — page-scoped.
- `CoursesHeader`, `CourseGrid`, `RequestCourseCTA` — page-scoped.
- `src/lib/courses/aggregate.ts` — shared utility consumed by home + course-overview; promote immediately (not page-scoped).
- `src/scripts/progress-hydrate.ts` — shared runtime; lives at `src/scripts/` not under pages.

### Extension to seo plan
- `courseListSchema()` added to `jsonld.ts`.

## 8. Code Patterns

**Pattern: Build-time aggregates over per-card queries.**
```astro
const stats = await getCourseStatsMap();   // one pass
<CourseGrid courses={sorted.map((course) => ({ course, stats: stats.get(course.id)! }))} />
```

**Pattern: Disable a card without breaking the grid.**
```astro
{course.data.status === 'coming-soon'
  ? <div class="card" aria-disabled="true">…</div>
  : <a class="card" href={courseUrl(course.id.split('/')[0])}>…</a>}
```

**Pattern: LCP optimization in the first row.**
```astro
{courses.map(({ course, stats }, i) => (
  <CourseCard course={course} stats={stats} priority={i < 3} />
))}
```

**Pattern: Inline script for progress with `astro:page-load` idempotence.**
```astro
<script>
  import { hydrateProgress } from '../../scripts/progress-hydrate';
  hydrateProgress();
  document.addEventListener('astro:page-load', hydrateProgress);
</script>
```

## 9. Testing Strategy

**Build:**
- `npm run build` with fixture content (1 published course + 1 coming-soon + 2 chapters in the published course) produces `dist/courses.html` with both cards, stats bar reading "1 course · 2 chapters · ~X hours total".

**SEO:**
- Rich Results Test: `ItemList` validates; `Course` items include `provider` and `url`.
- Sitemap includes `/courses` with priority 0.7.

**A11y:**
- axe-core green.
- `<h1>` once.
- VoiceOver: announces "list, 1 item" for the grid's `<ul role="list">`; announces coming-soon cards as disabled.
- Tab skips the coming-soon cards (no `<a>` inside).
- `progress-badge` aria-label reads "X of Y chapters read" for returning users.

**Perf:**
- Lighthouse desktop: ≥ 90 perf, ≥ 95 a11y, ≥ 95 SEO.
- Bundle-size check: page total < 40 KB (excluding images).
- LCP candidate = first course card icon.

**Interactive:**
- Write `localStorage.setItem('gyandev:progress:nodejs', JSON.stringify({ v: 1, data: { read: ['01-intro'] } }))` manually; reload; progress badge shows "1 of N read".
- Write every chapter to localStorage for every course; reload; banner appears.

**Manual:**
- 375px: single column, all cards tappable.
- 768px: 2 cols.
- 1024px+: 3 cols.
- Dark mode: card contrast meets AA.

## 10. Rollout Plan

Depends on:
- Shared plans land first (PageShell, SEO, SmartImage, Breadcrumbs).
- Routing plan's stub route and content collection exist.

Implementation sequence:
1. Step 1 (schema enrichment) — coordinated PR; affects home + course-overview + chapter plans too. **Cross-plan coordination note**: this step should land ONCE, not per page plan. Flag for Session 4 roadmap.
2. Step 2 (aggregate utility) + Step 3 (schema extension).
3. Steps 4–8 (components).
4. Step 9 (progress script).
5. Step 10 (route body).
6. Step 11 (OG image).

**Sample content required:**
- `src/content/courses/nodejs/course.mdx` (published) + `src/content/courses/nodejs/01-intro/index.mdx` (one chapter) + `src/content/courses/system-design/course.mdx` (coming-soon).
- Icons at `public/images/courses/nodejs.svg` + `public/images/courses/system-design.svg` (or whatever `icon` field references).

## 11. Risks and Mitigations

- **Risk: Aggregate.ts performance on 50+ chapters.**
  - Likelihood: low (build-time one-shot)
  - Impact: low
  - Mitigation: single pass through collection; O(n) over chapters.

- **Risk: Progress script runs before `.progress-badge` nodes render.**
  - Likelihood: low (script is at end of body and executes after parse)
  - Impact: medium (badges stay hidden)
  - Mitigation: ensure script placement after `<CourseGrid>`. On ClientRouter navigations, `astro:page-load` re-fires the hydration.

- **Risk: Coming-soon courses indexed by Google via sitemap — they have no real content.**
  - Likelihood: low (sitemap filter doesn't exclude `/courses/*` by status)
  - Impact: medium (404-like crawl errors)
  - Mitigation: if a coming-soon course has no rendered `/courses/<slug>` route (the course-overview page only renders when there's content), Astro won't emit it. Since course-overview DOES render for coming-soon courses (per course-overview.md §11), the `all-courses` page can link to those, but the course page itself should emit `noindex` when `status === 'coming-soon'`. Flag for course-overview plan.

- **Risk: `CourseCard` cross-use from home.md drives premature promotion to shared component.**
  - Likelihood: medium
  - Impact: low
  - Mitigation: wait until home plan implements — if home card's shape differs (e.g., smaller), keep two copies; if identical, promote to `src/components/ui/CourseCard.astro`.

- **Risk: Storage schema version mismatch breaks hydration silently.**
  - Likelihood: low (v=1 at launch)
  - Impact: low
  - Mitigation: script ignores non-parseable envelopes. When `storage.ts` bumps to v2, migration runs inside `storage.ts`, not here.

- **Risk: All-complete banner leaks into session where user clears localStorage partway.**
  - Likelihood: low
  - Impact: low
  - Mitigation: banner re-checks on every page-load; once localStorage clears, banner hides.

## 12. Done When

- [ ] Courses + chapters schemas enriched in `src/content.config.ts`.
- [ ] `src/lib/courses/aggregate.ts` returns correct stats map.
- [ ] `courseListSchema()` factory added to `src/lib/seo/jsonld.ts`.
- [ ] Five components under `src/components/pages/all-courses/` exist.
- [ ] `src/pages/courses/index.astro` renders via `PageShell` with header + grid + banner + CTA.
- [ ] Grid is 1/2/3 columns at mobile/tablet/desktop.
- [ ] Published courses sort alphabetical; coming-soon sort alphabetical after published.
- [ ] First three cards get `priority` for LCP.
- [ ] JSON-LD `ItemList` validates in Rich Results Test.
- [ ] Progress script updates badges from localStorage; no badge shown for users with no progress.
- [ ] All-complete banner shows only when every published course is complete.
- [ ] Lighthouse perf ≥ 90, a11y ≥ 95, SEO ≥ 95.
- [ ] axe-core green.
- [ ] `/og/courses.png` generated.

## 13. Open Questions

- [ ] **Chapter schema ownership.** Step 1 enriches the `chapters` schema which is also consumed by course-overview / chapter / home plans. Session 4 should confirm this lands once as a coordinated Sprint 1 change.
- [ ] **`status: 'coming-soon'` on courses — does it emit a course-overview page?** Default: yes, with a "Coming soon" hero (see `course-overview.md` §11). Sitemap filter may need to exclude coming-soon courses if we don't want them crawled.
- [ ] **Progress data shape** — `{ read: string[] }`? Or `{ completed: string[]; started: string[] }`? Defer to infrastructure plan's `storage.ts` schema. Current assumption: `{ read: chapterSlug[] }`.
- [ ] **Icons** — PNG vs SVG for course icons? SVG preferred (scales, color-currentColor possible). Confirm design direction.
- [ ] **Filter bar (spec §3.2)** — Phase 2. Reserved `data-tags` attribute already baked in.
- [ ] **Course request CTA URL** — GitHub issue template for "course request" should exist at launch or link to generic `/issues/new`.
- [ ] **"Completed" section at bottom** — spec §13 asks whether completed courses should move to a dedicated section. Defer; current sort (published, then coming-soon) is enough.
- [ ] **Featured / curated ordering** — spec §13 asks. Defer.

## 14. References

- Spec: `.claude/specs/pages/all-courses.md`
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — `/courses` stub route, collection enrichment.
  - `.claude/plans/shared/responsive-breakpoints.md` — PageShell, responsive grid.
  - `.claude/plans/shared/accessibility.md` — aria-disabled, progressbar labeling.
  - `.claude/plans/shared/performance.md` — SmartImage, LCP priority, no framework islands.
  - `.claude/plans/shared/seo.md` — SEO component, JSON-LD, sitemap priority.
  - `.claude/plans/pages/home.md` — shares aggregate util and progress script.
  - `.claude/plans/pages/course-overview.md` — uses enriched schema.
- External:
  - [Schema.org ItemList](https://schema.org/ItemList)
  - [Schema.org Course](https://schema.org/Course)
  - [WCAG — aria-disabled](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA8)
