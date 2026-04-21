---
title: Chapter Page (3-Tab Architecture) — Implementation Plan
status: draft
spec: .claude/specs/pages/chapter.md
created: 2026-04-20
session: 3
estimated_effort: 14–18 hours (most complex page in Phase 1)
dependencies:
  - .claude/plans/shared/routing-and-urls.md
  - .claude/plans/shared/responsive-breakpoints.md
  - .claude/plans/shared/accessibility.md
  - .claude/plans/shared/performance.md
  - .claude/plans/shared/seo.md
  - .claude/plans/pages/all-courses.md (schema enrichment, aggregate.ts)
  - .claude/plans/pages/course-overview.md (ChapterRow, bySlug.ts)
---

# Implementation Plan: Chapter Page (Three-Tab Model)

## 1. Overview

The chapter page is the core content unit of GyanDev and the most complex surface in Phase 1. Each chapter has three separate Astro routes — `/courses/[course]/[chapter]` (Full Notes, canonical), `/courses/[course]/[chapter]/revision`, `/courses/[course]/[chapter]/flow` — animated between via Astro's `<ClientRouter />` with `transition:persist` on the chapter shell. All three routes share a single `ChapterShell` (TopNav + breadcrumbs + chapter header + tab bar + left sidebar + right TOC + footer + Giscus) and a route-specific `<Content>` slot. A shared `getChapterPaths()` utility powers `getStaticPaths()` for all three. Content comes from three sibling MDX files under each chapter folder (`index.mdx`, `revision.mdx`, `flow.mdx`). Missing tabs degrade to a "Coming soon" view without breaking the shell. Active tab preference persists in localStorage so the next/prev chapter arrow navigation respects the reader's choice. Mermaid loads only on the Flow route. Giscus lazy-mounts once the comments heading nears the viewport and syncs theme via `postMessage`.

## 2. Spec Reference

See `.claude/specs/pages/chapter.md`. Load-bearing requirements:

- §3 URL scheme: three routes per chapter; Full Notes canonical; Revision/Flow `noindex, follow`.
- §4 Sections: TopNav → Breadcrumbs → Chapter Header (badges, title, meta, actions) → Tab Bar → Content → Footer (prev/next) → Comments (Giscus) → Left Sidebar (lg+) → Right TOC (xl+).
- §4.4 Tab Bar: click navigates via full SSG route, active tab persists in `gyandev:v1.prefs.activeTab`, carries to next chapter.
- §5 Per-tab content style (Full deep prose; Revision bullets; Flow Mermaid-dominant).
- §6 Responsive: no sidebars on mobile; left only at `lg`; both at `xl`.
- §8 Interactions: Mark as read, Bookmark, Copy code, TOC smooth scroll, prev/next arrow keys, Edit on GitHub.
- §9 Per-tab meta: Full indexable; Revision/Flow canonical→Full + `noindex, follow`.
- §10 Full Notes emits `TechArticle`; Revision/Flow use `isPartOf` → Full Notes.
- §11 Performance: LCP < 2.5s, INP < 200ms, CLS < 0.1; Flow tab exempt from 500KB total budget because Mermaid adds ~300 KB.
- §12 A11y: H1 = chapter title (not tab name), tablist pattern, keyboard nav between tabs + chapters, code block figure role, Mermaid alt text.
- §13 States: missing tab → grayed + "Coming soon"; draft chapter excluded in prod.
- §14 Success: all three tabs render, canonical correct, prev/next crosses course boundaries (end → overview), Giscus without CWV hit.

## 3. Technical Approach

**3.1 Three routes, not a JS tab switcher.** Per RESEARCH.md Topic 14 (and ratified in `.claude/plans/shared/routing-and-urls.md` §3.2 + `.claude/plans/shared/performance.md` §3.9), tabs are separate routes so Mermaid's ~1.5 MB runtime isolates to Flow only. `<ClientRouter />` animates the swap; `transition:persist="chapter-shell"` keeps header + tab bar + sidebars from flashing. Manual scroll restoration via `sessionStorage` is handled by `src/scripts/view-transition-a11y.ts` (a11y plan Step 5).

**3.2 Three route files, one source of truth.** `index.astro`, `revision.astro`, `flow.astro` all call `getChapterPaths()` from `src/lib/paths.ts` (routing plan §6 Step 3). Each pulls its own MDX from sibling files: Full Notes from `index.mdx`, Revision from `revision.mdx`, Flow from `flow.mdx`. All three wrap the page body in a single `ChapterShell` layout with `activeTab` set appropriately.

**3.3 Two-loader content model.** Decision to implement Phase 1: enrich the `chapters` collection glob to load ONLY `index.mdx` (Full Notes + chapter-level frontmatter as today), and add a second `chapterViews` collection for Revision + Flow. This resolves the open question from RESEARCH.md Topic 1 ("two-collection-with-extra-fields vs third-collection") by choosing the third collection — cleaner typing, explicit per-view metadata (e.g., per-view `readingMinutes` for Revision), and clean degradation for missing views (an absent entry means "tab coming soon" without any ad-hoc checks).

```ts
chapterViews: defineCollection({
  loader: glob({
    pattern: '**/{revision,flow}.mdx',
    base: './src/content/courses',
  }),
  schema: z.object({
    title: z.string().optional(),              // defaults to parent chapter.title
    description: z.string().optional(),
    readingMinutes: z.number().positive().optional(),
    updated: z.date().optional(),
  }),
});
```

The `id` becomes e.g. `nodejs/01-event-loop/revision` — easy to resolve by convention from the chapter id.

**3.4 `ChapterShell` is the one shell to rule them all.** Defined in `.claude/plans/shared/responsive-breakpoints.md` Step 12. This plan fills in its slots + wires the view-specific pieces: tab bar (`TabList` + 3× `TabLink` from `.claude/plans/shared/accessibility.md`), left sidebar (`LeftSidebar` with chapter tree), right TOC (`RightTOC` with IntersectionObserver highlight), mobile bottom-sheet TOC, chapter-footer prev/next nav, and Giscus wrapper.

**3.5 Full Notes = Pagefind-indexed; Revision + Flow not.** Per RESEARCH.md Topic 6, Full Notes body is wrapped in `<article data-pagefind-body data-pagefind-filter="course">`. Revision + Flow bodies DO NOT have these attributes — they aren't indexed. Any `<nav>` (breadcrumbs, tab bar, sidebar, TOC) carries `data-pagefind-ignore="all"`.

**3.6 Mermaid isolated to Flow.** Per RESEARCH.md Topic 8: `astro-mermaid` only injects its runtime on pages containing a `mermaid` fence. Authors are constrained: `mermaid` fences allowed ONLY in `flow.mdx`. Enforcement: add a `scripts/validate-content.mjs` step (extension to routing plan's validator) that rejects `mermaid` fences in `index.mdx` / `revision.mdx`.

**3.7 Giscus via `<GiscusLazy>` (performance plan Step 8).** Already wired. Chapter page passes `term={chapter.id}` for the specific-mapping strategy (RESEARCH.md Topic 7) so comments are shared across all three views. Reserved `min-height: 240px` inside `<LazyScript>` prevents CLS.

**3.8 Active-tab preference.** `localStorage['gyandev:v1.prefs.activeTab']` stores `'full' | 'revision' | 'flow'`. On the chapter footer prev/next links, a tiny inline script reads this pref and rewrites the `href` suffix at page-load time so clicking "Next →" from Revision view lands on the next chapter's Revision view (if it exists; otherwise Full). On first click-to-tab (e.g., user goes from Full → Revision), the tab's `TabLink` click handler writes the pref. This is best-effort UX, not a correctness requirement.

**3.9 Prev/Next crossing the course boundary.** The last chapter's "Next →" points to `/courses/<courseSlug>` (course overview). The first chapter's "← Prev" also points to `/courses/<courseSlug>`. Respecting the activeTab pref is only applicable within chapter-to-chapter links; the overview fallback ignores the pref.

## 4. File Structure

```
src/
  pages/
    courses/
      [course]/
        [chapter]/
          index.astro                               [modify stub → Full Notes, canonical]
          revision.astro                            [modify stub → Revision view]
          flow.astro                                [modify stub → Flow view, Mermaid only here]
  content.config.ts                                 [modify — add `chapterViews` collection]
  layouts/
    ChapterLayout.astro                             [create — wraps ChapterShell + per-tab SEO + JSON-LD]
  components/
    pages/
      chapter/
        ChapterHeader.astro                         [create — badges + H1 + subtitle + meta + action row]
        ChapterActions.astro                        [create — Mark as read, Bookmark, Edit on GitHub]
        ChapterFooter.astro                         [create — prev/next nav + actions + contribute]
        ComingSoonView.astro                        [create — body used when Revision/Flow MDX missing]
        LeftSidebar.astro                           [create — chapter tree; replaces layout shell default]
        RightTOC.astro                              [create — IntersectionObserver-highlighted on-page nav]
        MobileTOCTrigger.astro                      [create — bottom-sheet opener for <xl]
        ChapterRenderer.astro                       [create — wraps <Content components={...} /> with MDX component map]
        MermaidCaption.astro                        [create — wraps Mermaid fence output with aria figure]
  lib/
    chapter/
      nav.ts                                        [create — prev/next lookup across course]
      views.ts                                      [create — resolve Revision/Flow sibling entries]
    seo/
      jsonld.ts                                     [modify — add isPartOf variant for non-canonical views]
  scripts/
    chapter-hydrate.ts                              [create — activeTab pref, Mark-as-read, Bookmark, TOC active heading, footer href rewrite]
    chapter-toc.ts                                  [create — IntersectionObserver + reduced-motion smooth scroll]
```

**Existing components consumed (no new API):**
- `src/components/layout/ChapterShell.astro` (responsive plan) — we pass slots.
- `src/components/layout/Drawer.astro`, `BottomSheet.astro` (responsive plan).
- `src/components/a11y/TabList.astro`, `TabLink.astro` (a11y plan) — tab bar.
- `src/components/a11y/FigureDescribed.astro` — Mermaid wrapper.
- `src/components/perf/GiscusLazy.astro` (performance plan).
- `src/components/seo/SEO.astro`, `JsonLd.astro`, `Breadcrumbs.astro`.

**Sample content required:**
- At least 1 chapter folder under a published course with ALL three MDX files (`index.mdx`, `revision.mdx`, `flow.mdx`) so all three routes render end-to-end.
- At least 1 chapter with ONLY `index.mdx` so the Coming-soon degradation is verifiable.
- Chapter MDX must cover the common components authors will use (code fence, callout, image, link) so `ChapterRenderer.astro`'s component map is exercised.

## 5. Dependencies

**External:** none new beyond what's already scheduled. `astro-mermaid`, `@astrojs/mdx`, `rehype-pretty-code` already configured.

**Internal — consumed:**
- Everything from `.claude/plans/shared/*` and `pages/all-courses.md` + `pages/course-overview.md`.
- `src/scripts/view-transition-a11y.ts` (a11y plan) — scroll + focus restoration.
- `src/scripts/keybindings.ts` (a11y plan) — ArrowLeft / ArrowRight wire up for chapter pages via `data-page="chapter"` body attr.
- `src/lib/paths.ts` — `getChapterPaths()`.
- `src/lib/courses/bySlug.ts` (course-overview plan) — chapter list per course.
- `src/components/ui/SmartImage.astro` — for any images in chapter MDX.

**Internal — new:**
- Ten components under `src/components/pages/chapter/`.
- Two utilities under `src/lib/chapter/`.
- Two runtime scripts under `src/scripts/`.
- `ChapterLayout.astro`.

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — three route stubs, `getChapterPaths`, `BaseLayout`, `<ClientRouter />`.
- `.claude/plans/shared/responsive-breakpoints.md` — `ChapterShell`, drawer, bottom sheet.
- `.claude/plans/shared/accessibility.md` — TabList/TabLink, keybindings, scroll/focus restoration, FigureDescribed.
- `.claude/plans/shared/performance.md` — GiscusLazy, SmartImage, transition:persist trade-offs.
- `.claude/plans/shared/seo.md` — TechArticle + Breadcrumb schemas, canonical rules.
- `.claude/plans/pages/all-courses.md` — enriched schema, aggregate utility.
- `.claude/plans/pages/course-overview.md` — `bySlug.ts` chapter grouping; `ChapterRow` could be reused in sidebar but we ship a leaner tree item instead.

## 6. Implementation Steps (Ordered)

1. **Enrich `src/content.config.ts`** with the `chapterViews` collection (§3.3). Ensure `chapters` schema already has `views: { revision?: boolean; flow?: boolean }` — or skip the field and infer availability purely from `chapterViews` entries. Decision: infer from `chapterViews` only; no redundant frontmatter.

2. **Extend `src/lib/paths.ts`** — `getChapterPaths()` already returns `{ params, props: { chapter } }`. Add a helper `getChapterContext(id)`:
   ```ts
   export async function getChapterContext(id: string) {
     const [courseSlug] = id.split('/');
     const chapterSlugPath = id.split('/').slice(1, -1).join('/'); // strip 'index'
     const course = await getEntry('courses', `${courseSlug}/course`);
     const revision = await getEntry('chapterViews', `${courseSlug}/${chapterSlugPath}/revision`);
     const flow = await getEntry('chapterViews', `${courseSlug}/${chapterSlugPath}/flow`);
     return { course, courseSlug, chapterSlugPath, revision, flow };
   }
   ```

3. **Create `src/lib/chapter/nav.ts`:**
   ```ts
   import { getCourseChapters } from '../courses/bySlug';
   export async function prevNext(courseSlug: string, chapterSlugPath: string): Promise<{
     prev: { title: string; url: string } | null;
     next: { title: string; url: string } | null;
   }> {
     const chapters = await getCourseChapters(courseSlug);
     const i = chapters.findIndex((c) => c.slug === chapterSlugPath);
     if (i === -1) return { prev: null, next: null };
     const prev = i > 0 ? chapters[i - 1] : null;
     const next = i < chapters.length - 1 ? chapters[i + 1] : null;
     const toItem = (c: typeof chapters[number]) => ({
       title: c.chapter.data.title,
       url: `/courses/${courseSlug}/${c.slug}`,
     });
     return {
       prev: prev ? toItem(prev) : null,
       next: next ? toItem(next) : null,
     };
   }
   ```
   - Course-boundary fallback (`null`) handled in the footer component.

4. **Create `src/lib/chapter/views.ts`:**
   ```ts
   export type Tab = 'full' | 'revision' | 'flow';
   export interface ViewAvailability {
     full: true;                          // Full always exists (the chapter itself)
     revision: boolean;
     flow: boolean;
   }
   export function availabilityOf(ctx: {
     revision: unknown; flow: unknown;
   }): ViewAvailability {
     return { full: true, revision: !!ctx.revision, flow: !!ctx.flow };
   }
   ```

5. **Extend `src/lib/seo/jsonld.ts`** — add an overload for `techArticleSchema` that emits an `isPartOf` wrapper for non-canonical views:
   ```ts
   export function chapterViewSchema(input: {
     url: string;           // canonical Full Notes URL
     viewUrl: string;       // /revision or /flow URL
     title: string;
     description: string;
   }): TechArticle & { isPartOf: unknown } { ... }
   ```
   Revision/Flow emit a minimal `TechArticle` with `isPartOf: { "@id": fullNotesUrl }`. Phase 1 may omit JSON-LD entirely on non-canonical views; simpler — since they're `noindex`, Google won't consume the structured data anyway. **Decision**: omit JSON-LD on Revision + Flow; only Full Notes carries schemas. Remove this step if cost isn't worth it.

6. **Create `src/components/pages/chapter/ChapterRenderer.astro`:**
   - Props: `{ Content: AstroComponentFactory; components?: Record<string, AstroComponentFactory> }`.
   - Builds the MDX component map:
     ```ts
     const defaultMap = {
       pre: CodeBlock,           // rehype-pretty-code output wrapping
       a: SmartLink,             // rel noopener for external
       img: SmartImage,          // Astro <Image> replacement
       Callout,                  // if authors use <Callout> in MDX
       Figure: FigureDescribed,
       // Mermaid handled via rehype fence → Flow route only
     };
     ```
   - `<Content components={{ ...defaultMap, ...(components ?? {}) }} />`.
   - Done when: authors don't need to `import Callout from '...'` in every MDX file.

7. **Create `src/components/pages/chapter/ChapterHeader.astro`:**
   - Props: `{ chapter; course; tab: Tab; availability: ViewAvailability; editUrl: string }`.
   - Layout: badges row (`type`, `difficulty` from frontmatter), H1 (chapter title — NEVER tab name), optional subtitle paragraph, meta line (`{readingMinutes} min read · Updated {date}`), `<ChapterActions editUrl={editUrl} />`.
   - Done when: H1 renders once per page regardless of which tab is active.

8. **Create `src/components/pages/chapter/ChapterActions.astro`:**
   - Props: `{ editUrl: string }`.
   - Renders three controls:
     - `<button data-action="mark-read" aria-pressed="false">Mark as read</button>`.
     - `<button data-action="bookmark" aria-pressed="false">🔖 Bookmark</button>`.
     - `<a href={editUrl} rel="noopener noreferrer" target="_blank">Edit on GitHub</a>`.
   - Buttons use `aria-pressed` to announce state; Phase 1 doesn't use `role="switch"` (avoids extra ARIA nuance).
   - Hydrated by `chapter-hydrate.ts`.

9. **Create `src/components/pages/chapter/ChapterFooter.astro`:**
   - Props: `{ prev; next; courseSlug }`.
   - Layout: two-column flex — prev left, next right. Single column on mobile.
   - Each link uses `data-prevnext` so hydration script can rewrite `href` per active tab pref:
     ```astro
     <a data-prevnext="prev" data-base-url={prev?.url ?? `/courses/${courseSlug}`} href={prev?.url ?? `/courses/${courseSlug}`}>
       ← Previous: {prev?.title ?? 'Back to course'}
     </a>
     ```
   - Below: `<ChapterActions>` (duplicated? No — keep actions only in header. Footer only has prev/next + contribute).
   - Contribute row: two links (Edit on GitHub, Report issue) using the chapter file path for edit URL.

10. **Create `src/components/pages/chapter/ComingSoonView.astro`:**
    - Props: `{ missingTab: 'revision' | 'flow'; chapterUrl: string }`.
    - Renders a centered block inside `<main>`: "This tab is coming soon." + `<a href={chapterUrl}>Read the Full Notes →</a>` + contribute CTA.
    - No `<h1>` — the `ChapterHeader` above already emits it.

11. **Create `src/components/pages/chapter/LeftSidebar.astro`:**
    - Props: `{ courseSlug; course; chapters; activeChapterSlug }`.
    - `hidden lg:block`. Fixed position per responsive plan §6 Step 9 (existing layout/LeftSidebar is a generic shell; chapter's version is specialized to show the current chapter + progress-iconography).
    - Groups chapters by `season` (reuses `groupBySeason` from `bySlug.ts`).
    - Chapter item row: zero-padded order, status icon placeholder (`○` default), title truncated, click → `chapterUrl(courseSlug, chapterSlug)`.
    - Current chapter: `aria-current="page"` + visual highlight.
    - Status icons hydrated by `chapter-hydrate.ts` (same contract as `course-overview-hydrate.ts`: reads `read[]` from localStorage for the course).
    - Done when: scrolling the sidebar does not scroll the main content (independent scroll).

12. **Create `src/components/pages/chapter/RightTOC.astro`:**
    - Props: `{ headings: MarkdownHeading[] }`.
    - `hidden xl:block`. Fixed-positioned on the right.
    - Renders a nested `<nav aria-label="On this page">` with indented `<a href="#slug">` per H2/H3.
    - Active heading highlighted via `chapter-toc.ts` IntersectionObserver.
    - "Back to top" link at the bottom.
    - Pagefind-ignored (`data-pagefind-ignore="all"`).

13. **Create `src/components/pages/chapter/MobileTOCTrigger.astro`:**
    - Props: `{ headings: MarkdownHeading[] }`.
    - Visible at `<xl`. Sticky button at bottom-right labeled "On this page ▾".
    - Opens a `BottomSheet` (from responsive plan) whose body is the same `<nav>` as `RightTOC`, minus the fixed positioning.

14. **Create `src/components/pages/chapter/MermaidCaption.astro`:**
    - Wraps rehype-mermaid output (which is an SVG once JS renders) with `FigureDescribed` so SR users get alt text.
    - Props: `{ title: string; description: string }`.
    - Slot: the Mermaid fence output.
    - Authors use `<MermaidCaption title="Event loop phases" description="Timers → pending → poll → check → close callbacks.">` in `flow.mdx` immediately above the ` ```mermaid ` fence. Authoring pattern documented in authoring guide.

15. **Create `src/layouts/ChapterLayout.astro`** — the per-tab wrapper (sits inside `ChapterShell`):
    ```astro
    ---
    import ChapterShell from '../components/layout/ChapterShell.astro';
    import ChapterHeader from '../components/pages/chapter/ChapterHeader.astro';
    import ChapterFooter from '../components/pages/chapter/ChapterFooter.astro';
    import LeftSidebar from '../components/pages/chapter/LeftSidebar.astro';
    import RightTOC from '../components/pages/chapter/RightTOC.astro';
    import MobileTOCTrigger from '../components/pages/chapter/MobileTOCTrigger.astro';
    import GiscusLazy from '../components/perf/GiscusLazy.astro';
    import Breadcrumbs from '../components/seo/Breadcrumbs.astro';
    import { TabList } from '../components/a11y/TabList.astro';
    import { TabLink } from '../components/a11y/TabLink.astro';
    import { chapterUrl, chapterRevisionUrl, chapterFlowUrl, canonicalFor } from '../lib/routes';
    import { techArticleSchema, breadcrumbSchema } from '../lib/seo/jsonld';
    // …

    export interface Props {
      chapter, course, courseSlug, chapterSlugPath,
      tab: 'full' | 'revision' | 'flow',
      availability, headings, prev, next, chapterEditUrl,
      indexable: boolean,
    }
    ---
    <ChapterShell course={course} chapter={chapter} activeTab={tab} headings={headings}>
      <slot name="sidebar-left"><LeftSidebar ... /></slot>
      <slot name="toc"><RightTOC headings={headings} /></slot>
      <main id="main" data-page="chapter" data-course={courseSlug} data-chapter={chapterSlugPath}>
        <Breadcrumbs items={[...]} data-pagefind-ignore="all" />
        <ChapterHeader chapter={chapter} course={course} tab={tab} availability={availability} editUrl={chapterEditUrl} />
        <TabList label="Chapter views" data-pagefind-ignore="all">
          <TabLink href={chapterUrl(courseSlug, chapterSlugPath)}         active={tab === 'full'}     label="Full Notes" />
          <TabLink href={chapterRevisionUrl(courseSlug, chapterSlugPath)} active={tab === 'revision'} label="Quick Revision" disabled={!availability.revision} />
          <TabLink href={chapterFlowUrl(courseSlug, chapterSlugPath)}     active={tab === 'flow'}     label="Flow Diagram"  disabled={!availability.flow} />
        </TabList>
        <slot />  <!-- body: Pagefind-wrapped Full Notes OR plain Revision/Flow OR ComingSoonView -->
        <ChapterFooter prev={prev} next={next} courseSlug={courseSlug} />
        <GiscusLazy term={`${courseSlug}/${chapterSlugPath}`} />
      </main>
      <MobileTOCTrigger headings={headings} />
    </ChapterShell>
    ```
    Required amendment to `TabLink.astro`: accept `disabled?: boolean`; when true, render a non-link `<span role="tab" aria-disabled="true">` with "Coming soon" sr-only suffix. Flag to a11y plan §6.6.

16. **Replace `src/pages/courses/[course]/[chapter]/index.astro`** (Full Notes, canonical):
    ```astro
    ---
    export { getChapterPaths as getStaticPaths } from '../../../../lib/paths';
    import { render } from 'astro:content';
    import ChapterLayout from '../../../../layouts/ChapterLayout.astro';
    import ChapterRenderer from '../../../../components/pages/chapter/ChapterRenderer.astro';
    import { getChapterContext } from '../../../../lib/paths';
    import { prevNext } from '../../../../lib/chapter/nav';
    import { availabilityOf } from '../../../../lib/chapter/views';
    import { getCourseChapters } from '../../../../lib/courses/bySlug';
    import { canonicalFor, chapterUrl } from '../../../../lib/routes';
    import { techArticleSchema, breadcrumbSchema } from '../../../../lib/seo/jsonld';

    const { chapter } = Astro.props;
    const { course, courseSlug, chapterSlugPath, revision, flow } = await getChapterContext(chapter.id);
    const { Content, headings } = await render(chapter);
    const { prev, next } = await prevNext(courseSlug, chapterSlugPath);
    const availability = availabilityOf({ revision, flow });
    const chapters = await getCourseChapters(courseSlug);
    const canonical = canonicalFor(chapterUrl(courseSlug, chapterSlugPath));

    const jsonLd = [
      techArticleSchema({
        title: chapter.data.title,
        description: chapter.data.description,
        url: canonical,
        ogImage: canonicalFor(`/og/courses/${courseSlug}/${chapterSlugPath}.png`),
        datePublished: chapter.data.published.toISOString(),
        dateModified:  chapter.data.updated.toISOString(),
        author: 'Sonu Shahuji',
        section: course.data.title,
        tags: chapter.data.tags,
        proficiencyLevel: chapter.data.difficulty === 'beginner' ? 'Beginner'
                        : chapter.data.difficulty === 'advanced' ? 'Advanced' : 'Intermediate',
        timeRequiredISO8601: `PT${chapter.data.readingMinutes}M`,
      }),
      breadcrumbSchema([
        { name: 'Home',     url: canonicalFor('/') },
        { name: 'Courses',  url: canonicalFor('/courses') },
        { name: course.data.title, url: canonicalFor(`/courses/${courseSlug}`) },
        { name: chapter.data.title, url: canonical },
      ]),
    ];

    const chapterEditUrl = `https://github.com/sonushahuji4/gyandev/edit/main/src/content/courses/${courseSlug}/${chapterSlugPath}/index.mdx`;
    ---
    <ChapterLayout
      chapter={chapter} course={course}
      courseSlug={courseSlug} chapterSlugPath={chapterSlugPath}
      tab="full" availability={availability}
      headings={headings} prev={prev} next={next}
      chapterEditUrl={chapterEditUrl}
      indexable={true}
      canonical={canonical}
      title={`${chapter.data.title} — ${course.data.title}`}
      description={chapter.data.description}
      ogImage={canonicalFor(`/og/courses/${courseSlug}/${chapterSlugPath}.png`)}
      jsonLd={jsonLd}
      article={{
        publishedTime: chapter.data.published.toISOString(),
        modifiedTime: chapter.data.updated.toISOString(),
        author: 'Sonu Shahuji',
        section: course.data.title,
        tags: chapter.data.tags,
      }}
    >
      <article data-pagefind-body data-pagefind-filter={`course:${course.data.title}`}>
        <ChapterRenderer Content={Content} />
      </article>
    </ChapterLayout>

    <script>import '../../../../scripts/chapter-hydrate';</script>
    <script>import '../../../../scripts/chapter-toc';</script>
    ```
    Props passed through to `<BaseLayout>` (via `ChapterShell`) are standard — routing + seo props.

17. **Replace `src/pages/courses/[course]/[chapter]/revision.astro`:**
    - Same shape, but:
      - `const viewEntry = await getEntry('chapterViews', `${courseSlug}/${chapterSlugPath}/revision`);`
      - If `viewEntry` exists: `const { Content } = await render(viewEntry);` → wrap in `<ComingSoonView>`-complement: `<article class="prose revision"><ChapterRenderer Content={Content} /></article>` — NO `data-pagefind-body` (only Full Notes is indexed).
      - If missing: render `<ComingSoonView missingTab="revision" chapterUrl={canonicalFor(chapterUrl(courseSlug, chapterSlugPath))} />`.
      - `tab="revision"`, `indexable={false}`, `canonical` = FULL NOTES URL (not `/revision`), `noindex: true`.
      - `jsonLd={[]}` (or omit entirely per §5 decision).
      - Still emit OG image `/og/courses/<course>/<chapter>.png` (shared with Full Notes — not a per-view OG).

18. **Replace `src/pages/courses/[course]/[chapter]/flow.astro`:**
    - Same as revision.astro but for `flow`. Mermaid fences render on this route only via `astro-mermaid` (auto-detected).
    - Additional: verify `validate-content.mjs` (see Step 20) rejects `mermaid` fences outside flow.mdx at CI time.

19. **Create `src/scripts/chapter-hydrate.ts`:**
    - Reads body data attrs to know `course` and `chapter` slugs.
    - `hydrateActions()` — wires `data-action="mark-read"` + `data-action="bookmark"`:
      - Mark-as-read toggles the chapter slug in `gyandev:progress:<courseSlug>` envelope's `data.read[]`; fires `theme-change`-style `gyandev:progress-change` CustomEvent so LeftSidebar can re-render its status icons.
      - Bookmark toggles in `gyandev:bookmarks` array.
    - `hydrateSidebarStatus()` — same contract as `course-overview-hydrate.ts` — flips `○` to `✓` for chapters in `read[]` and `●` for the current chapter.
    - `hydrateActiveTabPref()` — listens on `.tablist a[role="tab"]` clicks, writes `localStorage['gyandev:v1.prefs.activeTab'] = 'full' | 'revision' | 'flow'`.
    - `rewritePrevNext()` — reads activeTab pref and for each `[data-prevnext]` link, appends `/revision` or `/flow` to `href` if the pref is non-`full`. If the pref'd view doesn't exist at the target, degrades to Full.
      - Availability of target-chapter views is NOT known at hydration time. Solution: bake `data-views="full,revision,flow"` on each footer link at render time (by looking up the destination chapter's views in `prevNext`).
    - `writeLastRead()` — on page-load, writes `gyandev:v1.progress.lastRead` for the home "Continue Reading" card with `{ courseSlug, chapterSlug, chapterTitle, courseLabel, readingMinutes }`.
    - All functions wire to `astro:page-load` for ClientRouter navigation idempotence.

20. **Create `src/scripts/chapter-toc.ts`:**
    - IntersectionObserver on `main h2, main h3`.
    - `rootMargin` tuned to "-40% 0px -60% 0px" so a heading is considered "active" once it's ~40% down the viewport.
    - Toggles `aria-current="location"` on the matching `<a>` in `.right-toc` and `.mobile-toc-nav`.
    - Debounced via `requestAnimationFrame` per the performance plan §8 debounced-scroll pattern.
    - Smooth-scroll enabled via CSS `html { scroll-behavior: smooth; }` — already overridden by the global reduced-motion rule (responsive plan §6 Step 1).

21. **Add MDX content validator.** Extend `scripts/validate-slugs.mjs` OR add a dedicated `scripts/validate-content.mjs`:
    - Parses every `*.mdx` and asserts:
      1. `mermaid` fences appear ONLY in `flow.mdx`.
      2. Chapter `index.mdx` body starts at `##` (H2) — the `<h1>` is owned by the layout.
      3. Every chapter has at least `index.mdx`.
      4. Revision and Flow MDX may be absent; if present, their folder-sibling `index.mdx` must also exist.
    - Add `"check:content": "node scripts/validate-content.mjs"` to `package.json`; wire into CI.

22. **Wire ArrowLeft/ArrowRight keybindings.** `src/scripts/keybindings.ts` (a11y plan) already registers prev/next on chapter pages (guarded by `document.body.dataset.page === 'chapter'`). This page sets `data-page="chapter"` on `<main>` (see Step 16). Move the attribute onto `<body>` via a small inline script at page-load OR extend the keybinding guard to read from `<main>` — decision: extend the guard to read from `<main id="main">`.

## 7. Component/Module API Design

### `src/layouts/ChapterLayout.astro`
```ts
interface Props {
  chapter: CollectionEntry<'chapters'>;
  course: CollectionEntry<'courses'>;
  courseSlug: string;
  chapterSlugPath: string;
  tab: 'full' | 'revision' | 'flow';
  availability: ViewAvailability;
  headings: MarkdownHeading[];
  prev: { title: string; url: string; views: string } | null;
  next: { title: string; url: string; views: string } | null;
  chapterEditUrl: string;
  indexable: boolean;
  canonical: string;
  title: string;
  description: string;
  ogImage: string;
  jsonLd: object[];
  article?: MetaInput['article'];
}
```
Slots: default (body), named `sidebar-left` and `toc` (override defaults).

### `src/components/pages/chapter/ChapterHeader.astro`
```ts
interface Props {
  chapter: CollectionEntry<'chapters'>;
  course: CollectionEntry<'courses'>;
  tab: 'full' | 'revision' | 'flow';
  availability: ViewAvailability;
  editUrl: string;
}
```

### `src/components/pages/chapter/ChapterActions.astro`
```ts
interface Props { editUrl: string; }
```

### `src/components/pages/chapter/ChapterFooter.astro`
```ts
interface Props {
  prev: { title: string; url: string; views: string } | null;
  next: { title: string; url: string; views: string } | null;
  courseSlug: string;
}
```

### `src/components/pages/chapter/ComingSoonView.astro`
```ts
interface Props { missingTab: 'revision' | 'flow'; chapterUrl: string; }
```

### `src/components/pages/chapter/LeftSidebar.astro`
```ts
interface Props {
  courseSlug: string;
  course: CollectionEntry<'courses'>;
  chapters: ChapterRef[];         // from bySlug.ts
  activeChapterSlug: string;
}
```

### `src/components/pages/chapter/RightTOC.astro`
```ts
interface Props { headings: MarkdownHeading[]; }
```

### `src/components/pages/chapter/MobileTOCTrigger.astro`
```ts
interface Props { headings: MarkdownHeading[]; }
```

### `src/components/pages/chapter/ChapterRenderer.astro`
```ts
interface Props {
  Content: AstroComponentFactory;
  components?: Record<string, AstroComponentFactory>;
}
```

### `src/components/pages/chapter/MermaidCaption.astro`
```ts
interface Props { title: string; description: string; }
```
Slot: mermaid fence output.

### `src/lib/chapter/nav.ts`
```ts
function prevNext(courseSlug: string, chapterSlugPath: string): Promise<{
  prev: { title; url; views } | null;
  next: { title; url; views } | null;
}>;
```

### `src/lib/chapter/views.ts`
```ts
type Tab = 'full' | 'revision' | 'flow';
interface ViewAvailability { full: true; revision: boolean; flow: boolean; }
function availabilityOf(ctx: { revision: unknown; flow: unknown }): ViewAvailability;
```

### New components flagged for component library
- `ChapterRenderer` — the global MDX component map. **Promote immediately** to `src/components/content/ChapterRenderer.astro` (shared) since any future prose route (e.g., `docs/`) uses the same map. Update `.claude/plans/shared/component-library.md` to list it.
- `LeftSidebar`, `RightTOC`, `MobileTOCTrigger` — chapter-specific. Keep page-scoped.
- `ChapterHeader`, `ChapterActions`, `ChapterFooter` — page-scoped.
- `ComingSoonView` — page-scoped unless reused for chapter-wide draft states.
- `MermaidCaption` — page-scoped; only Flow uses it.

### Extension to a11y plan
- `TabLink` gains a `disabled?: boolean` prop (renders as `<span role="tab" aria-disabled="true">` with sr-only "coming soon"). One-line extension to `.claude/plans/shared/accessibility.md` Step 6.

### Extension to seo plan
- Decision: NO per-view JSON-LD (only Full Notes). Document this in `.claude/plans/shared/seo.md` §3.1. Reduces maintenance.

## 8. Code Patterns

**Pattern: Three route files, one shared `getStaticPaths`.**
```astro
// index.astro / revision.astro / flow.astro
export { getChapterPaths as getStaticPaths } from '../../../../lib/paths';
```

**Pattern: Conditional body render — real content or ComingSoonView.**
```astro
{viewEntry ? (
  <article class="prose revision"><ChapterRenderer Content={Content} /></article>
) : (
  <ComingSoonView missingTab="revision" chapterUrl={canonicalFor(chapterUrl(courseSlug, chapterSlugPath))} />
)}
```

**Pattern: Canonical always points to Full Notes.**
```astro
// revision.astro + flow.astro
const canonical = canonicalFor(chapterUrl(courseSlug, chapterSlugPath));  // NOT /revision
```

**Pattern: `transition:persist` on the shell.** Owned by `ChapterShell` per responsive plan. Chapter routes don't re-declare it.

**Pattern: Pagefind boundaries.**
```astro
<article data-pagefind-body data-pagefind-filter={`course:${course.data.title}`}>
  {/* Full Notes body */}
</article>
<nav data-pagefind-ignore="all">{/* tab bar, breadcrumbs, TOC, sidebar */}</nav>
```

**Pattern: Author-facing Mermaid fence.**
```mdx
<MermaidCaption title="Event loop phases" description="Timers → pending → poll → check → close callbacks.">

```mermaid
flowchart LR
  Timers --> Pending --> Poll --> Check --> Close
```

</MermaidCaption>
```

## 9. Testing Strategy

**Build:**
- Build with a fixture chapter that has all three MDX files.
- `dist/courses/nodejs/01-event-loop.html`, `.../01-event-loop/revision.html`, `.../01-event-loop/flow.html` all exist.
- Grep `dist/**/*.js` for Mermaid references: they appear ONLY under the flow-route chunks.

**SEO:**
- Full Notes: canonical self-references, `<meta name="robots" content="index, follow, max-image-preview:large">`, `TechArticle` + `BreadcrumbList` JSON-LD validates.
- Revision/Flow: canonical → Full Notes, `noindex, follow`, NO JSON-LD (or minimal per §5 decision).
- Sitemap includes Full Notes URL only (Revision/Flow excluded by sitemap `filter`).

**A11y:**
- axe-core green on all three routes.
- `<h1>` is the chapter title on all three — never duplicated with the tab label.
- Tablist: arrow keys move focus; `aria-selected` + `aria-current="page"` correct on active tab.
- Disabled tab announces "Coming soon" via sr-only text.
- ViewOver: tab switch via ClientRouter announces the new page title.
- Keyboard ←/→ navigates prev/next chapter (guarded by `data-page="chapter"`).
- Focus lands on `<h1>` after page-swap (a11y plan script).
- `role="figure"` on Mermaid diagrams; alt text rendered via `FigureDescribed`.

**Perf:**
- Lighthouse on Full Notes: perf ≥ 90, a11y ≥ 95, SEO ≥ 95, LCP < 2.5s, CLS < 0.1.
- Lighthouse on Flow: perf ≥ 85 (relaxed for Mermaid), CLS < 0.1.
- Bundle-size check: Full Notes route < 500 KB total; Flow route exempt from JS budget (Mermaid adds ~1.5 MB runtime lazily).
- Giscus iframe DOES NOT load until scroll approaches comments section — verified in DevTools Network tab.

**Interactive:**
- Click Revision tab → URL changes to `/revision`, only `<main>` cross-fades, TopNav and tab bar don't flicker.
- Click Flow tab → Mermaid renders after JS load; verify no Mermaid JS on Full Notes.
- Press `→` arrow on Full Notes: navigates to next chapter's Full Notes.
- Set `localStorage['gyandev:v1.prefs.activeTab'] = 'revision'`; press `→`: navigates to next chapter's `/revision`.
- Dark mode toggle: Mermaid diagram re-renders in dark theme (autoTheme via `data-theme`).
- Dark mode toggle: Giscus iframe updates its theme via `postMessage`.
- Mark as read: button toggles `aria-pressed`; sidebar chapter icon flips `○` → `✓`.
- Bookmark: button toggles `aria-pressed`; bookmark announced via LiveRegion.

**Content authoring:**
- `validate-content.mjs` rejects a ` ```mermaid ` fence in `index.mdx` with a clear error.
- Starting chapter MDX body with `#` (H1) fails validation.

## 10. Rollout Plan

Depends on EVERYTHING before it — this is the capstone page.

1. Shared plans complete (routing, responsive, a11y, perf, seo).
2. `all-courses.md` schema enrichment landed.
3. `course-overview.md` landed (`bySlug.ts`).
4. Step 1 (chapterViews collection) + Steps 2–5 (utilities + jsonld).
5. Steps 6–14 (components).
6. Step 15 (ChapterLayout).
7. Steps 16–18 (three route bodies).
8. Steps 19–20 (hydration + TOC scripts).
9. Step 21 (validate-content.mjs) + Step 22 (keybinding guard).

**Sample content required:**
- `src/content/courses/nodejs/course.mdx` — published.
- `src/content/courses/nodejs/01-event-loop/index.mdx` — Full Notes with a code fence, a callout, an image, several H2/H3 headings.
- `src/content/courses/nodejs/01-event-loop/revision.mdx` — bullet-heavy, includes at least two H2s.
- `src/content/courses/nodejs/01-event-loop/flow.mdx` — a ` ```mermaid ` fence wrapped in `<MermaidCaption>`.
- `src/content/courses/nodejs/02-libuv/index.mdx` — only Full Notes (no revision/flow) to test Coming-soon degradation.
- Frontmatter for all three views must pass Zod.

Order suggestion: land the 3-tab route plumbing with a single fully-authored chapter; second chapter (with missing views) added in a follow-up PR verifies degradation.

## 11. Risks and Mitigations

- **Risk: `transition:persist="chapter-shell"` leaks state across chapters (e.g., the left sidebar's expanded season stays open on a chapter in a different season).**
  - Likelihood: medium
  - Impact: low (cosmetic)
  - Mitigation: `LeftSidebar` is keyed on `courseSlug`; when a user navigates to a different course's chapter (rare within chapter-to-chapter nav), the whole shell is rebuilt. Within a course, expanded season carrying over is desirable.

- **Risk: Mermaid fails to render under ClientRouter because the runtime thinks it already ran.**
  - Likelihood: medium (known issue with SPAs)
  - Impact: high (broken Flow tab on second visit)
  - Mitigation: `astro-mermaid`'s script re-runs on `astro:page-load` per the integration's docs. Verify in e2e — if it fails, fall back to `client:only` Mermaid wrapper OR add a manual re-init listener.

- **Risk: IntersectionObserver TOC highlight jitters at the threshold.**
  - Likelihood: medium
  - Impact: low
  - Mitigation: tune `rootMargin` and use `threshold: [0, 1]` with a simple "topmost visible heading wins" algorithm. Debounce via rAF.

- **Risk: `chapter-hydrate.ts`'s `data-views` baked attr goes stale if a Revision/Flow file is added after a chapter was published and cached.**
  - Likelihood: low (static rebuild flushes)
  - Impact: low
  - Mitigation: each deploy is a full rebuild; no stale attrs once deploy completes.

- **Risk: Coming-soon tab is still Tab-focusable, leading keyboard users to a dead end.**
  - Likelihood: medium
  - Impact: medium (a11y)
  - Mitigation: `TabLink disabled={true}` renders a `<span role="tab" aria-disabled="true">` — not a real link. Tab order skips it automatically.

- **Risk: Edit-on-GitHub URL is wrong for Revision/Flow (points to `index.mdx` always).**
  - Likelihood: high
  - Impact: low
  - Mitigation: construct the edit URL per-view: Full → `index.mdx`, Revision → `revision.mdx`, Flow → `flow.mdx`. Pass the correct filename into `ChapterHeader`/`ChapterFooter` per tab.

- **Risk: `<ClientRouter />` + `astro-mermaid` autoTheme MutationObserver fight each other on rapid theme toggle + route change.**
  - Likelihood: low
  - Impact: low
  - Mitigation: theme toggle sets class+attr synchronously; MutationObserver fires once. Known-good in RESEARCH.md Topic 8.

- **Risk: Giscus iframe DOM persists on `transition:persist` and its theme becomes out of sync when the user toggles theme on a non-comments-visible state.**
  - Likelihood: low
  - Impact: low
  - Mitigation: `GiscusLazy` listens for `theme-change` CustomEvent globally and posts the updated theme. Works even when the iframe is off-screen.

- **Risk: Scroll restoration restores a scroll position that doesn't exist after ClientRouter swaps content with a shorter body.**
  - Likelihood: medium
  - Impact: low (window.scrollY clamps)
  - Mitigation: `view-transition-a11y.ts` uses `window.scrollTo(0, min(savedY, document.body.scrollHeight))` — safe clamp.

- **Risk: `chapterViews` collection discovers wrong files if pattern is too greedy (e.g., picks up a `revision.mdx` nested further).**
  - Likelihood: low
  - Impact: low
  - Mitigation: pattern `**/{revision,flow}.mdx` scoped to `src/content/courses`; chapter folder depth is enforced by convention.

- **Risk: `writeLastRead()` fires on every chapter visit, racing with home page Continue card's read of that key.**
  - Likelihood: low (race between tabs, not same tab)
  - Impact: low
  - Mitigation: localStorage writes are atomic; worst case home page shows the previous chapter briefly. Acceptable.

- **Risk: Pagefind indexes Revision/Flow because someone forgets the `data-pagefind-body` boundary.**
  - Likelihood: medium
  - Impact: medium (duplicate search results)
  - Mitigation: ONLY `index.astro` wraps body in `data-pagefind-body`; Revision/Flow use plain `<article>`. Codified in Step 16 vs Steps 17/18.

## 12. Done When

- [ ] `chapterViews` collection defined; `id` convention documented.
- [ ] `prevNext()` and `availabilityOf()` + `getChapterContext()` utilities exist.
- [ ] 10 components under `src/components/pages/chapter/` exist.
- [ ] `src/layouts/ChapterLayout.astro` composes ChapterShell + slots.
- [ ] Three route files (`index.astro`, `revision.astro`, `flow.astro`) render correctly for a chapter with all three views.
- [ ] Chapter with only `index.mdx` degrades to Coming-soon for revision + flow routes.
- [ ] Full Notes: canonical self; robots index,follow,max-image-preview; TechArticle + Breadcrumb JSON-LD validate.
- [ ] Revision + Flow: canonical → Full Notes; noindex,follow; no JSON-LD (per decision).
- [ ] Tab bar uses TabList/TabLink ARIA pattern; disabled tabs aria-disabled.
- [ ] `transition:persist="chapter-shell"` on ChapterShell; switching tabs does not reload shell.
- [ ] Active tab preference persists; prev/next footer links rewrite `href` suffix based on pref.
- [ ] Mermaid runtime appears only in Flow route's bundle (grep confirms).
- [ ] Giscus lazy-mounts; theme sync works on toggle; iframe height reserved (CLS < 0.1).
- [ ] LeftSidebar renders chapter tree grouped by season; current chapter `aria-current`.
- [ ] RightTOC highlights active heading via IntersectionObserver.
- [ ] MobileTOCTrigger opens bottom sheet at `<xl`.
- [ ] Mark-as-read + Bookmark buttons toggle and persist.
- [ ] Arrow-key prev/next works on chapter pages; noop on other pages.
- [ ] Focus moves to H1 after ClientRouter swap; scroll restored per URL.
- [ ] `validate-content.mjs` rejects `mermaid` fences outside `flow.mdx` and H1 inside chapter MDX bodies.
- [ ] OG images `/og/courses/<course>/<chapter>.png` generated for every chapter.
- [ ] Lighthouse Full Notes ≥ 90 perf, ≥ 95 a11y, ≥ 95 SEO.

## 13. Open Questions

- [ ] **`chapterViews` vs extra chapter fields**: we chose a third collection (§3.3). Retain this decision unless authoring becomes awkward — revisit after 5+ chapters exist.
- [ ] **JSON-LD on non-canonical views**: decision = omit. Revisit if Search Console suggests surfacing `isPartOf` relationships.
- [ ] **Disabled tab affordance**: currently a non-focusable span. Alternative: a focusable but non-click tab that announces "coming soon" when activated — closer to WAI-ARIA tablist spec. Evaluate with a screen reader user session.
- [ ] **Mermaid re-init under ClientRouter** — confirm `astro-mermaid` handles `astro:page-load` correctly before ship; fallback = `client:only` wrapper.
- [ ] **`data-views` staleness** — see Risk §11. Acceptable but a watch-item.
- [ ] **Per-view OG images** — one OG per chapter (shared across tabs) or per tab? Current: shared. Rich Results Test with LinkedIn/Twitter previews validates.
- [ ] **Keyboard shortcut for bookmark** — spec §4 lists `b` toggling bookmark. Add to keybindings.ts if desired; gate by `data-page="chapter"`.
- [ ] **Chapter `status: 'draft'`** — spec §13. Exclude from `getChapterPaths()` in production builds via `import.meta.env.MODE !== 'production'` filter. Flag.
- [ ] **Season name** — inherits the course-overview Phase 1.5 decision.
- [ ] **Progress sync across tabs** — `storage` event handler broadcasts Mark-as-read changes to other open tabs. Already in storage.ts scope; confirm integration works on chapter pages.
- [ ] **Chapter images' LCP priority** — if a chapter opens with a hero image, mark first `<SmartImage>` as `priority`. Authoring convention to document.
- [ ] **Bookmarks UI** — Phase 1 only toggles state; a bookmarks list page is Phase 2.
- [ ] **Interactive Mermaid (pan/zoom)** — spec §15 defers to Phase 2.

## 14. References

- Spec: `.claude/specs/pages/chapter.md`
- Research:
  - `.claude/plans/RESEARCH.md` Topic 1 (content collections), 2 (getStaticPaths sharing), 3 (MDX components prop), 6 (Pagefind boundaries), 7 (Giscus specific mapping), 8 (astro-mermaid autoTheme), 9 (Shiki CSS var swap), 14 (ClientRouter + transition:persist).
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — `getChapterPaths`, three route stubs, BaseLayout, ClientRouter, transition:persist.
  - `.claude/plans/shared/responsive-breakpoints.md` — ChapterShell, Drawer, BottomSheet, prose.css, code.css.
  - `.claude/plans/shared/accessibility.md` — TabList, TabLink (+ disabled prop), keybindings, view-transition-a11y, FigureDescribed.
  - `.claude/plans/shared/performance.md` — GiscusLazy, SmartImage, bundle budgets, transition:persist perf trade-offs.
  - `.claude/plans/shared/seo.md` — TechArticle + Breadcrumb schemas, canonical rules, OG pipeline.
  - `.claude/plans/pages/all-courses.md` — schema enrichment, aggregate.ts.
  - `.claude/plans/pages/course-overview.md` — bySlug.ts, ChapterRow semantics, ProgressWidget contract.
  - `.claude/plans/pages/home.md` — lastRead writer/reader contract.
- External:
  - [Astro — View Transitions](https://docs.astro.build/en/guides/view-transitions/)
  - [Astro — `<ClientRouter />` scroll restoration](https://github.com/withastro/astro/issues/8083)
  - [astro-mermaid](https://www.npmjs.com/package/astro-mermaid)
  - [Pagefind — Indexing boundaries](https://pagefind.app/docs/indexing/)
  - [Giscus ADVANCED-USAGE](https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md)
  - [Schema.org TechArticle](https://schema.org/TechArticle)
  - [WAI-ARIA APG — Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
