/**
 * Content collections — enriched schemas (PR-3.1).
 *
 * Per PHASE-1-ROADMAP §2.R6, this file lives at the project root
 * (`src/content.config.ts`), not under `src/content/`.
 *
 * Layout:
 *
 *   src/content/courses/
 *     <courseSlug>/
 *       course.mdx                 ← `courses` entry (id: `<courseSlug>/course`)
 *       <chapterSlug>/
 *         index.mdx                ← `chapters` entry (id: `<courseSlug>/<chapterSlug>/index`)
 *         revision.mdx             ← `chapterViews` entry (PR-5.1)
 *         flow.mdx                 ← `chapterViews` entry (PR-5.1)
 *
 * The slug rules from `shared/routing-and-urls.md` (`^[a-z][a-z0-9-]*[a-z0-9]$`,
 * lowercase, hyphens, no underscores, no chapter numbers in the URL) are
 * enforced at the path/router layer in `src/lib/paths.ts` and the
 * `validate-slugs.mjs` CI gate — not in this Zod schema.
 *
 * The `z` binding is imported directly from `zod` (not re-exported from
 * `astro:content`) per PR-3.1 migration — the `astro:content` re-export is
 * deprecated in Astro 5+ Content Layer. `defineCollection` and `reference`
 * are still sourced from `astro:content`.
 */

import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'zod';

const DIFFICULTY = ['beginner', 'intermediate', 'advanced'] as const;
const COURSE_STATUS = ['published', 'coming-soon', 'draft'] as const;
const CHAPTER_STATUS = ['published', 'coming-soon', 'draft'] as const;
const CHAPTER_TYPE = ['tutorial', 'howto', 'reference', 'explanation'] as const;

/**
 * `courses` collection — one `course.mdx` per course folder.
 *
 * Field consumers (page plans driving each field):
 *   - title, description           → all-courses, course-overview, home, chapter
 *   - order                        → all-courses sort (secondary after status)
 *   - status                       → all-courses sort + badges, course-overview
 *                                    coming-soon variant, sitemap filter
 *   - difficulty                   → all-courses card stat, course-overview hero,
 *                                    JSON-LD educationalLevel
 *   - icon                         → all-courses card, home featured-course hero
 *   - learningObjectives           → course-overview "What You'll Learn"
 *   - prerequisites                → course-overview "Before You Start"
 *   - related                      → course-overview RelatedCourses sidebar
 *   - updated                      → sitemap lastmod
 */
const courses = defineCollection({
  loader: glob({
    pattern: '**/course.mdx',
    base: './src/content/courses',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().int().nonnegative(),
    status: z.enum(COURSE_STATUS).default('draft'),
    difficulty: z.enum(DIFFICULTY),
    /**
     * Short letter/badge text (e.g. `"N"`, `"JS"`, `"DSA"`) rendered inside
     * the CourseCard corner badge. Max 3 chars keeps the badge square.
     * Legacy `/images/...` paths still validate; CourseCard detects the leading
     * slash and renders an `<img>` instead of the letter variant.
     */
    icon: z.string().optional(),
    /**
     * Curator estimate of total reading hours. Used by CourseCard for
     * coming-soon courses (no chapters yet → computed stats would be zero).
     * Published courses prefer the computed `totalReadingMinutes` from
     * aggregate.ts; `estimatedHours` is a fallback / sanity label.
     */
    estimatedHours: z.number().positive().optional(),
    learningObjectives: z.array(z.string()).default([]),
    prerequisites: z.array(z.string()).default([]),
    related: z.array(reference('courses')).default([]),
    updated: z.date(),
  }),
});

/**
 * `chapters` collection — one `index.mdx` per chapter folder. Full Notes body
 * and chapter-level frontmatter. Revision + Flow sibling MDX are handled by
 * the separate `chapterViews` collection introduced in PR-5.1.
 *
 * Field consumers:
 *   - title, description           → chapter header, course-overview row,
 *                                    home featured/recent, JSON-LD
 *   - course (reference)           → course-overview filter, aggregate stats,
 *                                    home course lookup
 *   - order                        → chapter sort within course/season
 *   - season                       → course-overview season grouping
 *   - difficulty                   → chapter meta row, course-overview dot,
 *                                    JSON-LD proficiencyLevel
 *   - type                         → chapter Diátaxis classification
 *                                    (author signal; may drive UI hinting)
 *   - readingMinutes               → aggregate totalReadingMinutes, chapter
 *                                    meta, JSON-LD timeRequired
 *   - status                       → bySlug filter, home recent/featured filter
 *   - published                    → home "new" badge (< 7 days → accent dot)
 *   - updated                      → home recent sort, sitemap lastmod
 *   - tags                         → chapter JSON-LD tags, related-chapter
 *                                    future logic
 */
const chapters = defineCollection({
  loader: glob({
    pattern: '**/index.mdx',
    base: './src/content/courses',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    course: reference('courses'),
    order: z.number().int().nonnegative(),
    season: z.number().int().positive().default(1),
    difficulty: z.enum(DIFFICULTY),
    type: z.enum(CHAPTER_TYPE).default('tutorial'),
    readingMinutes: z.number().positive(),
    status: z.enum(CHAPTER_STATUS).default('draft'),
    published: z.date().optional(),
    updated: z.date(),
    tags: z.array(z.string()).default([]),
  }),
});

/**
 * `chapterViews` collection — sibling MDX bodies for the Quick Revision and
 * Flow Diagram tabs (PR-5.1, chapter.md §3.3).
 *
 * Layout convention (rest of ids derive automatically from the glob):
 *   src/content/courses/<courseSlug>/<chapterSlug>/revision.mdx
 *   src/content/courses/<courseSlug>/<chapterSlug>/flow.mdx
 *
 * Resulting entry ids:
 *   <courseSlug>/<chapterSlug>/revision
 *   <courseSlug>/<chapterSlug>/flow
 *
 * Authoring rules enforced by PR-5.2 `validate-content.mjs` (separate PR):
 *   - `mermaid` fences MUST appear only inside `flow.mdx`.
 *   - Body MUST NOT begin with an H1 (the layout owns the `<h1>`).
 *
 * Schema is intentionally optional — chapter-level frontmatter (title,
 * description, readingMinutes, updated) lives on the parent `chapters` entry
 * (`index.mdx`) and is the source of truth. Per-view overrides exist for
 * cases like a Revision view that takes 4 min when the Full Notes take 12.
 */
const chapterViews = defineCollection({
  loader: glob({
    pattern: '**/{revision,flow}.mdx',
    base: './src/content/courses',
  }),
  schema: z.object({
    /** Override of parent chapter title — defaults to chapter.title at render time. */
    title: z.string().optional(),
    /** Override of parent chapter description — defaults to chapter.description. */
    description: z.string().optional(),
    /** Per-view reading time override (Revision is typically much shorter). */
    readingMinutes: z.number().positive().optional(),
    /** Per-view last-updated date — defaults to parent chapter.updated. */
    updated: z.date().optional(),
  }),
});

/**
 * `legal` collection — privacy + terms MDX bodies, added in PR-2.2
 * (`.claude/plans/pages/legal.md` Step 1). Kept flat under `src/content/legal/`
 * so the entry id equals the URL slug (`privacy` → `/privacy`).
 *
 * `updated` is parsed as a real `Date` so `check-legal-freshness.mjs` can
 * compare it against `git log` timestamps without string-level ambiguity.
 */
const legal = defineCollection({
  loader: glob({
    pattern: '*.mdx',
    base: './src/content/legal',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.date(),
    effective: z.date().optional(),
    contact: z.object({
      email: z.email(),
      responseTime: z.string().optional(),
    }),
  }),
});

/**
 * `site` data collection — site-wide structured data (author bio, contact,
 * changelog, etc.). Added in PR-2.3 (`.claude/plans/pages/about.md` Step 1).
 *
 * One entry per YAML file in `src/content/site/`; `about.yml` becomes
 * `getEntry('site', 'about')`. File-based (not MDX) because this is
 * structured data, not prose — prose lives in `.astro` section components.
 */
const site = defineCollection({
  loader: glob({
    pattern: '*.yml',
    base: './src/content/site',
  }),
  schema: z.object({
    author: z.object({
      name: z.string(),
      role: z.string(),
      location: z.string(),
      /** Site-relative path, e.g. `/images/author.jpg`. Optional — `AuthorCard`
       *  falls back to a CSS-generated initials avatar if absent. */
      avatar: z.string().optional(),
      bio: z.string(),
      socials: z.object({
        github:   z.url().optional(),
        linkedin: z.url().optional(),
        twitter:  z.url().optional(),
      }),
    }),
    contact: z.object({
      email: z.email(),
      responseTime: z.string().optional(),
    }),
    changelog: z.array(z.object({
      /** Free-form date string — `YYYY-MM` for month-level entries, `YYYY-MM-DD`
       *  when a precise date matters. Formatted by `ChangelogSection`. */
      date: z.string(),
      event: z.string(),
    })).optional(),
  }),
});

/**
 * `featured` data collection — hand-curated home-page picks, added in PR-4.2
 * (`.claude/plans/pages/home.md` Step 1). One entry per array item in
 * `src/content/featured/featured.yml`; each row references a chapter by its
 * `courseSlug` + `chapterSlug` plus an explicit `position` so the curator
 * controls ordering without reordering the YAML.
 *
 * Editorial cadence (launch with 3 entries, refresh monthly) is tracked in
 * `docs/EDITORIAL.md`, produced in Sprint 6 per roadmap Q#19.
 */
const featured = defineCollection({
  loader: file('src/content/featured/featured.yml'),
  schema: z.object({
    chapterSlug: z.string(),
    courseSlug: z.string(),
    position: z.number().int().positive(),
  }),
});

export const collections = { courses, chapters, chapterViews, legal, site, featured };
