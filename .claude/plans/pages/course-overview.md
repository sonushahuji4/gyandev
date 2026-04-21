---
title: Course Overview Page — Implementation Plan
status: draft
spec: .claude/specs/pages/course-overview.md
created: 2026-04-20
session: 3
estimated_effort: 6–8 hours
dependencies:
  - .claude/plans/shared/routing-and-urls.md
  - .claude/plans/shared/responsive-breakpoints.md
  - .claude/plans/shared/accessibility.md
  - .claude/plans/shared/performance.md
  - .claude/plans/shared/seo.md
  - .claude/plans/pages/all-courses.md (schema enrichment, aggregate.ts, progress-hydrate)
---

# Implementation Plan: Course Overview Page

## 1. Overview

Dynamic route `/courses/[course]` generates one page per course entry, showing a hero with stats and start/resume CTAs, a "What you'll learn" block, optional prerequisites, a chapter list grouped by season with per-chapter completion icons and view-availability dots, and a desktop sidebar (progress widget, related courses, contribute links). MDX body of the course entry (`course.mdx`) renders within the "What you'll learn" area if the author wants richer descriptive prose. Ships `Course` + `BreadcrumbList` JSON-LD. Resume CTA and progress widget hydrate client-side from localStorage using the shared `progress-hydrate.ts` runtime. Coming-soon courses render a simplified "Coming soon" page with a noindex signal and no sidebar.

## 2. Spec Reference

See `.claude/specs/pages/course-overview.md`. Load-bearing requirements:

- §3 Sections: breadcrumbs → hero (logo, H1, description, stats, Resume/Start CTAs) → "What You'll Learn" → Prerequisites (optional) → Chapters grouped by season → sidebar (desktop) → footer.
- §3.5 Season grouping: H2 per season, season meta (count + combined time), chapter rows with completion icons (✓ read / ● current / ○ not started) and view-availability dots (Full/Revision/Flow).
- §3.6 Sidebar (lg+): progress widget (progress bar + "N of M read"), download options (Phase 2), related courses, contribute links.
- §4 Responsive: stacked hero on mobile; sidebar collapses below chapter list at <lg.
- §5 Data sources: courses collection + chapters collection filtered by course + localStorage progress + related from `related` frontmatter.
- §7 Meta with self-canonical `/courses/[course]`.
- §8 JSON-LD: `Course` (with `hasCourseInstance`) + `BreadcrumbList`.
- §9 Perf: static + tiny JS for progress; < 50 KB total.
- §10 A11y: H1 = course name; H2 per season; chapter list as `<ol>`; progressbar role on progress widget.
- §11 States: fresh / in-progress / complete; draft course hidden; coming-soon course shows a "Coming soon" hero.

## 3. Technical Approach

**3.1 One `.astro` page handles ALL course states.** A single `[course].astro` dynamic route generates static paths for every course in the collection. Inside, we branch on `course.data.status`: `'published'` renders the full page (hero + chapters); `'coming-soon'` renders a compact "Coming soon" hero and sets `noindex: true`. No separate routes.

**3.2 Season grouping via chapter frontmatter.** Per the enriched chapter schema (from `all-courses.md` §6 Step 1), each chapter has a `season: number` field defaulting to 1. We group chapters by season at the top of the page, sort each group by `order`, and render. Season titles are a derived display label: `Season {n}` for Phase 1. If authors want named seasons (`"Foundations"` vs `"Deep Dives"`), a Phase 2 enhancement adds an optional `seasonTitle` field. Flagged in §13.

**3.3 View-availability dots show Revision/Flow readiness.** Phase 1 assumes every chapter has all three views once published. The dots are visual sugar and mostly always filled. The implementation reads a `views` field on the chapter (`views: { revision: boolean; flow: boolean }`) — both default `true`. If a chapter is in a `views.revision: false` state, the Revision dot is hollow and a "coming soon" tooltip attaches. Flagged as a Phase 1.5 enhancement in §13.

**3.4 Resume CTA vs Start CTA.** Both CTAs render on the server; a tiny client script reads localStorage progress and hides one of them based on state:
- If no progress for this course → show "Start Chapter 1", hide Resume.
- If in progress → show both, swap "Start Chapter 1" for a tertiary "View all chapters ↓" link.
- If 100% complete → show "Review any chapter" banner; both CTAs dimmed.

Default render (no JS / first paint): show BOTH CTAs with the Resume pre-filled pointing to the first chapter. The script refines on hydration. LCP is unaffected because it's text, not image.

**3.5 Right sidebar as a grid column, not absolute positioning.** `ChapterShell` is reserved for chapter pages (with its 3-column grid). Course overview uses a simpler `PageShell` + custom 2-column grid at `lg+`:
```css
@media (min-width: 1024px) { .course-layout { grid-template-columns: 1fr 16rem; gap: 2rem; } }
```
Sidebar scrolls with the page (not sticky) in Phase 1 — sticky is a progressive enhancement.

**3.6 Related-course data via `reference()`.** Frontmatter field `related: reference('courses')[]` (already in the enriched schema from `all-courses.md` Step 1). Resolved via `getEntries(course.data.related)` in the page frontmatter. Rendered as a small sidebar list.

**3.7 JSON-LD.** `Course` schema includes `name`, `description`, `provider`, `hasCourseInstance` with `courseMode: 'online'` + `courseWorkload` computed from total reading time. `BreadcrumbList` via `<Breadcrumbs>` per usual pattern.

**3.8 `course.mdx` body as the "What You'll Learn" fallback.** If `course.data.learningObjectives` is non-empty (preferred), render that as an `<ol>`. If empty AND the MDX body is non-empty, render the MDX body (author-written prose). If both empty, skip the section. This lets authors opt for structured or prose, not both.

## 4. File Structure

```
src/
  pages/
    courses/
      [course]/
        index.astro                                 [modify stub → /courses/[course]]
  components/
    pages/
      course-overview/
        CourseHero.astro                            [create — logo + title + stats + CTAs]
        LearningObjectives.astro                    [create — <ol> or MDX body slot]
        Prerequisites.astro                         [create — optional bullet list]
        ChapterList.astro                           [create — grouped by season]
        ChapterRow.astro                            [create — single chapter link row]
        ComingSoonHero.astro                        [create — alternate layout for coming-soon courses]
        CourseSidebar.astro                         [create — progress + related + contribute]
        ProgressWidget.astro                        [create — progressbar with aria]
        RelatedCourses.astro                        [create — up to 3 links]
        ContributeLinks.astro                       [create — GitHub edit + issue]
  lib/
    courses/
      bySlug.ts                                     [create — chapters filtered + sorted for a course]
    seo/
      jsonld.ts                                     [modify — add courseSchema() per course]
  scripts/
    course-overview-hydrate.ts                      [create — Resume/Start CTA swap + progress widget]
```

**Sample content required:**
- One published course with ≥ 3 chapters spread across 2 seasons (to verify season grouping).
- One coming-soon course (to verify the alternate layout).
- `related` reference between them to verify Related Courses sidebar.

## 5. Dependencies

**External:** none new.

**Internal — consumed:**
- `src/layouts/BaseLayout.astro`, `PageShell`, `SEO`, `JsonLd`, `Breadcrumbs`, `SmartImage`.
- `src/lib/routes.ts` — `canonicalFor()`, `courseUrl()`, `chapterUrl()`.
- `src/lib/courses/aggregate.ts` (from `all-courses.md`) — `getCourseStatsMap()` for stats summary.
- `src/lib/storage.ts` (infrastructure plan) — progress read.
- `src/scripts/progress-hydrate.ts` (from `all-courses.md`) — adapted OR composed.

**Internal — new:**
- Ten components under `src/components/pages/course-overview/`.
- `src/lib/courses/bySlug.ts`.
- `src/scripts/course-overview-hydrate.ts`.
- `courseSchema()` extension in `src/lib/seo/jsonld.ts` (already listed in seo plan §7 API).

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — `[course]/index.astro` stub; `getStaticPaths` for courses.
- `.claude/plans/shared/responsive-breakpoints.md` — PageShell, 2-col grid pattern.
- `.claude/plans/shared/accessibility.md` — H1/H2 hierarchy, progressbar role.
- `.claude/plans/shared/performance.md` — SmartImage, tiny inline JS only.
- `.claude/plans/shared/seo.md` — Course schema factory (already referenced).
- `.claude/plans/pages/all-courses.md` — enriched collection schema, `aggregate.ts`, `progress-hydrate.ts` runtime.

## 6. Implementation Steps (Ordered)

1. **Schema prerequisite**: ensure `all-courses.md` Step 1 schema enrichment has landed. This plan does NOT re-specify it; it relies on the shared landing.

2. **Create `src/lib/courses/bySlug.ts`:**
   ```ts
   import { getCollection, type CollectionEntry } from 'astro:content';

   export interface ChapterRef {
     chapter: CollectionEntry<'chapters'>;
     slug: string;    // path segment used by chapterUrl (e.g., '01-event-loop')
     season: number;
   }

   export async function getCourseChapters(courseSlug: string): Promise<ChapterRef[]> {
     const all = await getCollection('chapters');
     return all
       .filter((c) => c.id.startsWith(courseSlug + '/') && c.data.status === 'published')
       .sort((a, b) => a.data.season - b.data.season || a.data.order - b.data.order)
       .map((c) => {
         const parts = c.id.split('/');
         return { chapter: c, slug: parts.slice(1, -1).join('/'), season: c.data.season };
       });
   }

   export function groupBySeason(chapters: ChapterRef[]): Map<number, ChapterRef[]> {
     const map = new Map<number, ChapterRef[]>();
     for (const c of chapters) {
       const arr = map.get(c.season) ?? [];
       arr.push(c);
       map.set(c.season, arr);
     }
     return new Map([...map.entries()].sort(([a], [b]) => a - b));
   }
   ```

3. **Extend `src/lib/seo/jsonld.ts`** — if not already done by seo plan, add `courseSchema()`:
   ```ts
   export function courseSchema(input: {
     name: string;
     description: string;
     url: string;
     provider: { name: string; url: string };
     workloadISO8601: string; // 'PT10H'
     educationalLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
   }): Course { ... }
   ```

4. **Create `src/components/pages/course-overview/CourseHero.astro`:**
   - Props: `{ course, stats, firstChapterUrl, resumeUrl?: string }`.
   - Layout: 2-column on `md+` (icon + text stacked on mobile).
   - Left column: course icon (64–128px) via `<SmartImage priority>` for LCP.
   - Right column: badges (difficulty), H1, description, stats bar (`{stats.publishedChapters} chapters · ~{hours} hours · {difficulty}`), two CTAs.
   - Both CTAs render server-side; the hydrate script hides the Resume CTA when no progress exists.
   - Done when: H1 is announced on page-load focus; CTAs are real `<a href>`.

5. **Create `src/components/pages/course-overview/LearningObjectives.astro`:**
   - Props: `{ objectives: string[] }`.
   - Slot: rendered MDX body (optional fallback when objectives are empty).
   - If objectives non-empty: render H2 "What You'll Learn" + `<ol>` of objectives.
   - Else if slot content: render H2 + slot.
   - Else: render nothing (section hidden).
   - Done when: 3 variants (structured, prose, absent) render correctly.

6. **Create `src/components/pages/course-overview/Prerequisites.astro`:**
   - Props: `{ prerequisites: string[]; prerequisiteCourses?: CollectionEntry<'courses'>[] }`.
   - If empty, renders nothing.
   - Otherwise H2 "Before You Start" + bullet list + optional "See our [linked course]" line at bottom using `prerequisiteCourses`.
   - Phase 1 simplification: accept free-text prerequisites only; don't try to match them to courses automatically.

7. **Create `src/components/pages/course-overview/ChapterRow.astro`:**
   - Props: `{ chapter: CollectionEntry<'chapters'>; courseSlug: string; chapterSlug: string; order: number; currentSlug?: string }`.
   - `<li class="chapter-row" data-chapter-slug={chapterSlug}>` — data attr is the key for progress hydration.
   - Contents: zero-padded order number, completion icon placeholder `<span class="chapter-status">○</span>` (updated by JS), `<a href={chapterUrl(courseSlug, chapterSlug)}>`, title + excerpt + meta.
   - Meta line: `{chapter.data.readingMinutes} min · {chapter.data.difficulty} · <span class="view-dots">● ● ●</span>` (three filled dots default; future hollow if `views.revision/flow === false`).
   - Completion icon values: `'○'` default; script flips to `'✓'` if chapter slug in localStorage `read[]`; `'●'` for the `currentSlug` passed in (Resume CTA target).

8. **Create `src/components/pages/course-overview/ChapterList.astro`:**
   - Props: `{ groups: Map<number, ChapterRef[]>; courseSlug: string; currentSlug?: string }`.
   - Wrap in `<section aria-label="Chapters">`.
   - For each season: H2 `Season {n}`, meta line `{count} chapters · ~{hours} hours`, horizontal divider, `<ol>` of `ChapterRow`.
   - Ordered list per spec §10.

9. **Create `src/components/pages/course-overview/ComingSoonHero.astro`:**
   - Props: `{ course: CollectionEntry<'courses'> }`.
   - Renders a centered `<section>` with H1 "{course.data.title} — Coming soon", description, and a CTA "Get notified when we launch → [GitHub Watch link]" or a mailto. No stats, no chapters.

10. **Create `src/components/pages/course-overview/ProgressWidget.astro`:**
    - Props: `{ courseSlug: string; total: number }`.
    - Renders initial skeleton:
      ```astro
      <div class="progress-widget" data-course-id={courseSlug} data-total={total}
           role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={0}
           aria-label="Reading progress">
        <p class="progress-text"><span class="progress-read">0</span> of {total} read</p>
        <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
      </div>
      ```
    - Hydrated by `course-overview-hydrate.ts` to update `aria-valuenow`, `.progress-read` text, and fill width.

11. **Create `src/components/pages/course-overview/RelatedCourses.astro`:**
    - Props: `{ related: CollectionEntry<'courses'>[] }`.
    - If empty, render nothing.
    - Otherwise: `<section aria-label="Related courses">` with H3 and `<ul>` of name + difficulty tag.

12. **Create `src/components/pages/course-overview/ContributeLinks.astro`:**
    - Props: `{ courseId: string }`.
    - Two links: "Edit course →" to GitHub edit URL of `src/content/courses/<courseId>/course.mdx`, and "Report issue →" to the issues tracker.

13. **Create `src/components/pages/course-overview/CourseSidebar.astro`:**
    - Props: aggregates the above — `{ courseSlug, total, related, courseId }`.
    - Wraps `<aside aria-label="Course info">` with progress widget + (Phase 2 download block stub) + related + contribute.

14. **Create `src/scripts/course-overview-hydrate.ts`:**
    ```ts
    function hydrate() {
      // 1. Update chapter row status icons + 2. progress widget + 3. Resume/Start CTA swap
      const rows = document.querySelectorAll('.chapter-row[data-chapter-slug]');
      const widget = document.querySelector('.progress-widget[data-course-id]') as HTMLElement | null;
      if (!widget) return;
      const courseSlug = widget.dataset.courseId!;
      const total = Number(widget.dataset.total) || rows.length;
      let read: string[] = [];
      try {
        const raw = localStorage.getItem('gyandev:progress:' + courseSlug);
        if (raw) { const env = JSON.parse(raw); read = env?.data?.read ?? []; }
      } catch {}
      let firstUnread: string | null = null;
      for (const row of rows) {
        const slug = (row as HTMLElement).dataset.chapterSlug!;
        const icon = row.querySelector('.chapter-status');
        const isRead = read.includes(slug);
        if (icon) icon.textContent = isRead ? '✓' : '○';
        if (!isRead && firstUnread === null) firstUnread = slug;
      }
      widget.setAttribute('aria-valuenow', String(read.length));
      const textEl = widget.querySelector('.progress-read');
      if (textEl) textEl.textContent = String(read.length);
      const fill = widget.querySelector('.progress-fill') as HTMLElement | null;
      if (fill) fill.style.width = (total === 0 ? 0 : (read.length / total) * 100) + '%';
      // Resume/Start swap
      const resumeLink = document.querySelector<HTMLAnchorElement>('[data-cta="resume"]');
      const startLink = document.querySelector<HTMLAnchorElement>('[data-cta="start"]');
      if (resumeLink && startLink) {
        if (read.length === 0) resumeLink.hidden = true;
        else if (firstUnread) resumeLink.href = resumeLink.dataset.urlBase + '/' + firstUnread;
        if (read.length >= total && total > 0) {
          startLink.hidden = true; resumeLink.hidden = true;
          document.querySelector('#complete-banner')?.toggleAttribute('hidden', false);
        }
      }
    }
    hydrate();
    document.addEventListener('astro:page-load', hydrate);
    ```
    - Imported in the page via `<script>import '../../../scripts/course-overview-hydrate';</script>`.

15. **Replace `src/pages/courses/[course]/index.astro`:**
    ```astro
    ---
    import { getCollection, getEntry, getEntries, render } from 'astro:content';
    import PageShell from '../../../components/layout/PageShell.astro';
    import CourseHero from '../../../components/pages/course-overview/CourseHero.astro';
    import LearningObjectives from '../../../components/pages/course-overview/LearningObjectives.astro';
    import Prerequisites from '../../../components/pages/course-overview/Prerequisites.astro';
    import ChapterList from '../../../components/pages/course-overview/ChapterList.astro';
    import ComingSoonHero from '../../../components/pages/course-overview/ComingSoonHero.astro';
    import CourseSidebar from '../../../components/pages/course-overview/CourseSidebar.astro';
    import { getCourseChapters, groupBySeason } from '../../../lib/courses/bySlug';
    import { courseSchema, breadcrumbSchema } from '../../../lib/seo/jsonld';
    import { canonicalFor, courseUrl } from '../../../lib/routes';

    export async function getStaticPaths() {
      const courses = await getCollection('courses');
      return courses.map((course) => ({
        params: { course: course.id.split('/')[0] },
        props: { course },
      }));
    }

    const { course } = Astro.props;
    const slug = Astro.params.course!;
    const canonical = canonicalFor(courseUrl(slug));

    if (course.data.status === 'coming-soon') {
      // render the alternate layout
    }

    const chapters = await getCourseChapters(slug);
    const groups = groupBySeason(chapters);
    const firstChapterSlug = chapters[0]?.slug;
    const total = chapters.length;
    const minutes = chapters.reduce((s, r) => s + r.chapter.data.readingMinutes, 0);
    const related = course.data.related?.length ? await getEntries(course.data.related) : [];
    const { Content } = await render(course); // MDX body fallback

    const jsonLd = [
      courseSchema({
        name: course.data.title,
        description: course.data.description,
        url: canonical,
        provider: { name: 'GyanDev', url: 'https://gyandev.org' },
        workloadISO8601: `PT${Math.max(1, Math.round(minutes / 60))}H`,
        educationalLevel: course.data.difficulty === 'beginner' ? 'Beginner'
                         : course.data.difficulty === 'advanced' ? 'Advanced' : 'Intermediate',
      }),
      breadcrumbSchema([
        { name: 'Home',    url: canonicalFor('/') },
        { name: 'Courses', url: canonicalFor('/courses') },
        { name: course.data.title, url: canonical },
      ]),
    ];
    ---
    <PageShell
      title={course.data.title}
      description={course.data.description}
      canonical={canonical}
      noindex={course.data.status === 'coming-soon'}
      ogImage={canonicalFor(`/og/courses/${slug}.png`)}
      jsonLd={jsonLd}
    >
      {course.data.status === 'coming-soon' ? (
        <ComingSoonHero course={course} />
      ) : (
        <div class="course-layout">
          <main class="course-main">
            <CourseHero
              course={course}
              publishedChapters={total}
              minutes={minutes}
              firstChapterSlug={firstChapterSlug}
            />
            <LearningObjectives objectives={course.data.learningObjectives}>
              <Content />
            </LearningObjectives>
            <Prerequisites prerequisites={course.data.prerequisites} />
            <ChapterList groups={groups} courseSlug={slug} />
          </main>
          <CourseSidebar courseSlug={slug} total={total} related={related} courseId={course.id} />
        </div>
      )}
    </PageShell>

    <script>import '../../../scripts/course-overview-hydrate';</script>
    ```

16. **Ensure OG route** `src/pages/og/courses/[...slug].png.ts` from seo plan Step 9 already covers `/og/courses/<slug>.png`. Verify the page map includes all courses.

17. **Content gate**: `coming-soon` course overview must set `noindex: true` (done in Step 15) AND the sitemap `filter` should also exclude it. Update the sitemap `filter` in `astro.config.mjs`:
    ```js
    filter: async (page) => {
      if (page.endsWith('/revision') || page.endsWith('/flow')) return false;
      if (page.endsWith('/404') || page.endsWith('/search')) return false;
      // Exclude coming-soon courses
      const match = page.match(/\/courses\/([^/]+)\/?$/);
      if (match) {
        const entry = await getEntry('courses', match[1] + '/course');
        if (entry?.data.status === 'coming-soon') return false;
      }
      return true;
    }
    ```
    **Cross-plan note**: this sitemap filter tweak affects `.claude/plans/shared/seo.md` Step 12. Flag for Session 4 coordination.

## 7. Component/Module API Design

### `src/components/pages/course-overview/CourseHero.astro`
```ts
interface Props {
  course: CollectionEntry<'courses'>;
  publishedChapters: number;
  minutes: number;
  firstChapterSlug?: string;
}
```

### `src/components/pages/course-overview/LearningObjectives.astro`
```ts
interface Props { objectives: string[]; }
```
Slot: MDX body fallback.

### `src/components/pages/course-overview/Prerequisites.astro`
```ts
interface Props { prerequisites: string[]; prerequisiteCourses?: CollectionEntry<'courses'>[]; }
```

### `src/components/pages/course-overview/ChapterList.astro`
```ts
interface Props { groups: Map<number, ChapterRef[]>; courseSlug: string; currentSlug?: string; }
```

### `src/components/pages/course-overview/ChapterRow.astro`
```ts
interface Props {
  chapter: CollectionEntry<'chapters'>;
  courseSlug: string;
  chapterSlug: string;
  order: number;
  currentSlug?: string;
}
```

### `src/components/pages/course-overview/ComingSoonHero.astro`
```ts
interface Props { course: CollectionEntry<'courses'>; }
```

### `src/components/pages/course-overview/ProgressWidget.astro`
```ts
interface Props { courseSlug: string; total: number; }
```

### `src/components/pages/course-overview/RelatedCourses.astro`
```ts
interface Props { related: CollectionEntry<'courses'>[]; }
```

### `src/components/pages/course-overview/ContributeLinks.astro`
```ts
interface Props { courseId: string; }
```

### `src/components/pages/course-overview/CourseSidebar.astro`
```ts
interface Props {
  courseSlug: string;
  total: number;
  related: CollectionEntry<'courses'>[];
  courseId: string;
}
```

### `src/lib/courses/bySlug.ts`
```ts
interface ChapterRef { chapter: CollectionEntry<'chapters'>; slug: string; season: number; }
function getCourseChapters(courseSlug: string): Promise<ChapterRef[]>;
function groupBySeason(chapters: ChapterRef[]): Map<number, ChapterRef[]>;
```

### Extended `src/lib/seo/jsonld.ts`
```ts
function courseSchema(input: { name; description; url; provider; workloadISO8601; educationalLevel? }): Course;
```

### New components flagged for component library
- `ProgressWidget` — reusable on home and chapter pages. Promote to `src/components/ui/ProgressWidget.astro` once home plan lands.
- `ChapterRow` — reusable in chapter's left-sidebar chapter tree (chapter plan). Promote when chapter plan uses it; until then keep page-scoped.
- `RelatedCourses`, `ContributeLinks` — page-scoped for now.
- `course-overview-hydrate.ts` — consider generalizing into `src/scripts/progress.ts` alongside `progress-hydrate.ts` from all-courses plan. Possible dedup in Session 4.

### Extension to seo plan
- `courseSchema()` — already referenced by seo plan §7; this plan confirms the exact input shape.

## 8. Code Patterns

**Pattern: Branch by `status` inside the page, not at the route level.**
```astro
{course.data.status === 'coming-soon' ? <ComingSoonHero .../> : <FullLayout .../>}
```

**Pattern: Two-column page grid at lg+, stacked below.**
```css
.course-layout { display: block; }
@media (min-width: 1024px) {
  .course-layout { display: grid; grid-template-columns: 1fr 16rem; gap: 2rem; }
}
```

**Pattern: Progressive resume CTA.**
```astro
<a data-cta="resume" data-url-base={courseUrl(slug)}
   href={chapterUrl(slug, firstChapterSlug)}>
  Resume: Chapter 1 →
</a>
```
Server renders resume pointing to chapter 1; client-side hydration overrides `href` to the first unread chapter.

**Pattern: `role="progressbar"` with aria-valuenow updated on hydration.**
```astro
<div class="progress-widget" role="progressbar"
     aria-valuemin={0} aria-valuemax={total} aria-valuenow={0}
     aria-label="Reading progress">
```

## 9. Testing Strategy

**Build:**
- Build with fixture (1 published course with 3 chapters across 2 seasons + 1 coming-soon course).
- `dist/courses/<slug>.html` exists for both; coming-soon has `<meta name="robots" content="noindex, follow">`.

**SEO:**
- Rich Results Test validates `Course` + `BreadcrumbList`.
- Sitemap includes published course URL, excludes coming-soon.
- JSON-LD `workloadISO8601` computes correctly.

**A11y:**
- axe-core green on both variants.
- `<h1>` once per page; season H2s present.
- `role="progressbar"` with all three aria values.
- Chapter list as `<ol>` — SR reads "ordered list, N items".
- Keyboard Tab order: SkipLink → CTA buttons → chapter links → sidebar.

**Perf:**
- Lighthouse desktop: perf ≥ 90, a11y ≥ 95, SEO ≥ 95.
- Bundle check: page-total < 50 KB; inline hydration script < 2 KB.
- LCP = course hero icon; confirmed via Chrome DevTools.

**Interactive:**
- No progress: Start Chapter 1 visible; Resume hidden after hydration.
- Partial progress (e.g., chapter 1 read): Resume CTA updates to point to chapter 2.
- Full progress: completion banner shown; CTAs hidden.
- Progress widget updates from "0 of 3 read" to actual numbers.

**Manual:**
- 375px: hero stacks, sidebar collapses below chapter list.
- 768px: sidebar still below.
- 1024px: two-column layout visible.
- Season dividers render with proper spacing.

## 10. Rollout Plan

Depends on:
- Shared plans landed.
- `all-courses.md` schema enrichment landed.
- Routing plan's `[course]/index.astro` stub exists.

Implementation sequence:
1. Step 2 (bySlug utility) + Step 3 (schema extension).
2. Steps 4–13 (components, bottom-up).
3. Step 14 (hydration script).
4. Step 15 (route body).
5. Steps 16–17 (OG + sitemap filter).

**Sample content required:**
- `src/content/courses/nodejs/course.mdx` — published, 3 chapters, 2 seasons.
- `src/content/courses/system-design/course.mdx` — status: coming-soon.
- At least 3 chapter MDX files under nodejs/.
- `related` field linking nodejs → system-design (once system-design status allows it; for coming-soon it still renders in the sidebar as a non-link).

## 11. Risks and Mitigations

- **Risk: Season grouping breaks when a chapter has `season` undefined or non-numeric.**
  - Likelihood: low (Zod enforces + default 1)
  - Impact: low
  - Mitigation: schema default is `season: 1`.

- **Risk: Coming-soon course still gets crawled because sitemap filter isn't updated.**
  - Likelihood: medium (cross-plan coordination)
  - Impact: medium (stale 'Coming soon' pages indexed)
  - Mitigation: Step 17 updates sitemap filter; the coming-soon page itself has `noindex` as a belt-and-suspenders.

- **Risk: Hydration script races with MDX images still painting, causing layout shift.**
  - Likelihood: low
  - Impact: low
  - Mitigation: script only mutates text and hidden attrs — no layout-shifting DOM moves. Progress bar fill uses `transform` (or `width` with `will-change: width`) — minor.

- **Risk: Resume CTA `data-url-base` construction is off by one slash.**
  - Likelihood: medium
  - Impact: low (404 on resume)
  - Mitigation: unit-test the hydration script with fixtures OR keep the URL construction in `src/lib/routes.ts` and have hydration read it off `data-resume-url`.

- **Risk: Fallback prose (MDX body) in LearningObjectives is empty AND objectives are empty → section renders as just `<h2>What You'll Learn</h2>` with nothing below.**
  - Likelihood: medium
  - Impact: low (visual)
  - Mitigation: the component short-circuits when both are empty — `LearningObjectives` checks slot content via `Astro.slots.has('default')` and returns null if no content.

- **Risk: Related courses sidebar shows the current course if `related` accidentally includes itself.**
  - Likelihood: low
  - Impact: low
  - Mitigation: filter `related.filter((r) => r.id !== course.id)` in page frontmatter.

- **Risk: Author forgets `readingMinutes` on a chapter → Zod throws.**
  - Likelihood: medium
  - Impact: low (caught at build)
  - Mitigation: Zod `positive()` constraint forces real values. OR make it optional with a sensible default computed from word count — flag in §13.

## 12. Done When

- [ ] `src/lib/courses/bySlug.ts` exports `getCourseChapters` + `groupBySeason`.
- [ ] `courseSchema()` emits valid JSON-LD.
- [ ] Ten components under `src/components/pages/course-overview/` exist.
- [ ] `src/pages/courses/[course]/index.astro` renders published + coming-soon variants correctly.
- [ ] `getStaticPaths` emits one path per course.
- [ ] Chapter list grouped by season, ordered by `order`, with correct season meta.
- [ ] Per-chapter completion icons hydrate from localStorage without page reload.
- [ ] Progress widget has correct `role="progressbar"` + aria values, updates from JS.
- [ ] Resume CTA: hidden at zero progress; points to first unread chapter at partial progress.
- [ ] Completion banner appears at 100% read.
- [ ] Coming-soon course emits `noindex` and is absent from sitemap.
- [ ] Breadcrumb + Course JSON-LD validate in Rich Results Test.
- [ ] OG image `/og/courses/<slug>.png` generated per course.
- [ ] Lighthouse perf ≥ 90, a11y ≥ 95, SEO ≥ 95.
- [ ] axe-core green.

## 13. Open Questions

- [ ] **Named seasons.** Current plan uses `Season {n}`. Authors may want "Foundations" / "Deep Dives". Add `seasonTitle?` field to chapter OR add a `seasons[]` on the course with label lookup. Phase 1.5.
- [ ] **View-availability dots.** Current default = all three views available. Add `views: { revision: boolean; flow: boolean }` field on chapter to drive hollow dots? Flag for chapter plan.
- [ ] **`readingMinutes` auto-computation.** Zod `positive()` forces real values. Alternative: compute from MDX word count at build; allow frontmatter override. Phase 2.
- [ ] **Sticky sidebar** — Phase 2 progressive enhancement.
- [ ] **Download block** — Phase 2 per spec §6.
- [ ] **Season collapse** — spec §3.8 allows collapsible seasons ("optional"). Defer; purely decorative.
- [ ] **Prereq → course linking.** Currently free-text. Phase 2 could auto-link based on course titles.
- [ ] **Flat list for courses without seasons.** Spec §13 asks. Current implementation groups by default season (1), which renders as a single "Season 1" H2. If author-prefers-flat, suppress the season H2 when only one season exists — acceptable and reduces clutter. Flag.
- [ ] **Chapter published date surfaced?** Spec §13 asks. Defer; `updated` suffices.

## 14. References

- Spec: `.claude/specs/pages/course-overview.md`
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — `[course]/index.astro` stub, `getStaticPaths`.
  - `.claude/plans/shared/responsive-breakpoints.md` — PageShell, grid.
  - `.claude/plans/shared/accessibility.md` — progressbar role, H1/H2.
  - `.claude/plans/shared/performance.md` — SmartImage, budgets.
  - `.claude/plans/shared/seo.md` — Course + Breadcrumb schema, OG route, sitemap filter.
  - `.claude/plans/pages/all-courses.md` — schema enrichment, aggregate utility.
  - `.claude/plans/pages/chapter.md` — chapter-row behavior mirrored in sidebar tree.
- External:
  - [Schema.org Course](https://schema.org/Course)
  - [ISO 8601 Durations](https://en.wikipedia.org/wiki/ISO_8601#Durations)
  - [WAI-ARIA Authoring Practices — progressbar](https://www.w3.org/WAI/ARIA/apg/patterns/meter/)
