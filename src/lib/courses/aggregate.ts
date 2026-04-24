/**
 * Build-time course aggregate utilities (PR-3.2).
 *
 * Responsibility: read the `courses` + `chapters` content collections once per
 * build, compute per-course stats (chapter count, total reading minutes, first
 * chapter pointer), and expose the sort order the all-courses catalog uses —
 * published first (alphabetical), then coming-soon / draft (alphabetical).
 *
 * Callers (all-courses, later course-overview and home per roadmap §4) should
 * prefer `getCoursesWithStats()` so they pay for one chapters-collection walk
 * per request rather than one per card.
 *
 * No client-side code lives here. Progress hydration is a separate concern
 * handled by `src/scripts/progress-hydrate.ts`.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

/** Per-course aggregate stats computed from the `chapters` collection. */
export interface CourseStats {
  /** Total chapter entries (published + draft + coming-soon). */
  chapterCount: number;
  /** Total chapter entries that are `status === 'published'`. */
  publishedChapters: number;
  /** Sum of `readingMinutes` across published chapters only. */
  totalReadingMinutes: number;
  /**
   * Sum of `readingMinutes` across each chapter's `revision.mdx` sibling view
   * (from the `chapterViews` collection). Used by the DevNotes-style card
   * meta row: `"12h full · 62m revision"`. Zero when no revision siblings
   * declare `readingMinutes`.
   */
  revisionReadingMinutes: number;
  /**
   * Slug of the first (lowest-order) published chapter, for Start / Resume
   * links. Undefined when the course has no published chapters yet.
   * Example: `"closures"` for `src/content/courses/javascript/closures/index.mdx`.
   */
  firstChapterSlug?: string;
}

/** Course entry + precomputed stats + derived url-safe slug. */
export interface CourseWithStats {
  course: CollectionEntry<'courses'>;
  /** URL slug, e.g. `"javascript"` (first segment of the entry id). */
  slug: string;
  stats: CourseStats;
}

/** Zero-valued stats used when a course has no chapters yet. */
const EMPTY_STATS: CourseStats = {
  chapterCount: 0,
  publishedChapters: 0,
  totalReadingMinutes: 0,
  revisionReadingMinutes: 0,
};

/**
 * Derive the URL slug (folder name) from a course entry id.
 * Entry ids are like `"javascript/course"` for `javascript/course.mdx`.
 */
function courseSlugOf(course: CollectionEntry<'courses'>): string {
  return course.id.split('/')[0] ?? course.id;
}

/**
 * Derive the chapter slug (possibly nested path) from a chapter entry id.
 * Astro's glob loader strips `/index.mdx` so a leaf chapter id is
 * `<courseSlug>/<…/chapterSlug>`. For DSA, this is `dsa/heaps/top-k-selection/kth-largest`.
 */
function chapterSlugOf(chapter: CollectionEntry<'chapters'>): string | undefined {
  const parts = chapter.id.split('/');
  if (parts[parts.length - 1] === 'index') parts.pop();
  if (parts.length <= 1) return undefined;
  return parts.slice(1).join('/');
}

/** Fetch every entry from the `courses` collection. */
export async function getAllCourses(): Promise<CollectionEntry<'courses'>[]> {
  return getCollection('courses');
}

/**
 * Derive the URL slug (folder name) from a chapter's `course` reference.
 * The reference id mirrors the referenced course entry id — e.g.
 * `"javascript/course"` → `"javascript"`.
 */
function referencedCourseSlug(chapter: CollectionEntry<'chapters'>): string {
  const refId = chapter.data.course.id;
  return refId.split('/')[0] ?? refId;
}

/**
 * Compute aggregate stats for a single course by walking the chapters
 * collection. O(n) over all chapters per call; use `getCoursesWithStats()` if
 * you need stats for every course (one walk vs. N walks).
 */
export async function getChapterStats(courseSlug: string): Promise<CourseStats> {
  const [chapters, views] = await Promise.all([
    getCollection('chapters'),
    getCollection('chapterViews'),
  ]);
  const forCourse = chapters.filter((ch) => referencedCourseSlug(ch) === courseSlug);
  const revisionMinutesBySlug = revisionMinutesBySlugFrom(views);
  return aggregateChapters(forCourse, revisionMinutesBySlug);
}

function aggregateChapters(
  entries: CollectionEntry<'chapters'>[],
  revisionMinutesBySlug: Map<string, number>,
): CourseStats {
  // Hub chapters (kind === 'hub') are navigational-only and don't count
  // toward reading stats or chapter totals. For flat 2-level courses this
  // filter is a no-op.
  const leaves = entries.filter((e) => e.data.kind !== 'hub');
  const published = leaves.filter((e) => e.data.status === 'published');
  const revisionMinutes = published.reduce((sum, e) => {
    const chapterKey = chapterKeyOf(e);
    return sum + (chapterKey ? (revisionMinutesBySlug.get(chapterKey) ?? 0) : 0);
  }, 0);

  // "First chapter" = first top-level chapter in order (depth 1). For flat
  // courses that's still the first leaf; for DSA it's the first topic hub.
  const topLevel = entries.filter((e) => {
    const slug = chapterSlugOf(e);
    return slug !== undefined && !slug.includes('/') && e.data.status === 'published';
  });
  const firstTopLevel = [...topLevel].sort((a, b) => a.data.order - b.data.order)[0];

  return {
    chapterCount: leaves.length,
    publishedChapters: published.length,
    totalReadingMinutes: published.reduce((sum, e) => sum + e.data.readingMinutes, 0),
    revisionReadingMinutes: revisionMinutes,
    firstChapterSlug: firstTopLevel ? chapterSlugOf(firstTopLevel) : undefined,
  };
}

/** `"<courseSlug>/<chapterSlug>"` lookup key used to pair chapters to views. */
function chapterKeyOf(chapter: CollectionEntry<'chapters'>): string | undefined {
  const parts = chapter.id.split('/');
  if (parts[parts.length - 1] === 'index') parts.pop();
  if (parts.length <= 1) return undefined;
  return `${parts[0]}/${parts.slice(1).join('/')}`;
}

/**
 * Build `{courseSlug}/{chapterSlug}` → revision readingMinutes. The
 * `chapterViews` entry id is like `<courseSlug>/<chapterSlug>/revision`;
 * entries that don't override `readingMinutes` contribute 0.
 */
function revisionMinutesBySlugFrom(
  views: CollectionEntry<'chapterViews'>[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const v of views) {
    const parts = v.id.split('/');
    if (parts.length < 3) continue;
    if (parts[parts.length - 1] !== 'revision') continue;
    // id shape: `<courseSlug>/<chapter…slug>/revision` — the chapter part
    // may have any depth (DSA patterns nest 2-3 levels).
    const courseSlug = parts[0]!;
    const chapterSlug = parts.slice(1, -1).join('/');
    const key = `${courseSlug}/${chapterSlug}`;
    const minutes = v.data.readingMinutes ?? 0;
    result.set(key, (result.get(key) ?? 0) + minutes);
  }
  return result;
}

/**
 * Sort courses for display per spec §3.3:
 *   1. `status === 'published'` first, alphabetical by title.
 *   2. Everything else (`coming-soon`, `draft`) after, alphabetical by title.
 *
 * The input array is not mutated.
 */
export function sortCourses(
  courses: CollectionEntry<'courses'>[],
): CollectionEntry<'courses'>[] {
  const byTitle = (
    a: CollectionEntry<'courses'>,
    b: CollectionEntry<'courses'>,
  ): number => a.data.title.localeCompare(b.data.title);

  const published = courses.filter((c) => c.data.status === 'published').sort(byTitle);
  const rest = courses.filter((c) => c.data.status !== 'published').sort(byTitle);
  return [...published, ...rest];
}

/**
 * One-stop: fetch courses, compute stats for every course in a single pass
 * through the chapters collection, and return the display-ordered list.
 *
 * Courses with no chapters yet receive `EMPTY_STATS` so callers don't need to
 * null-check.
 */
export async function getCoursesWithStats(): Promise<CourseWithStats[]> {
  const [courses, chapters, views] = await Promise.all([
    getAllCourses(),
    getCollection('chapters'),
    getCollection('chapterViews'),
  ]);

  const revisionMinutesBySlug = revisionMinutesBySlugFrom(views);

  // Group chapters by the course slug their frontmatter references. Astro
  // normalizes `course: nodejs` to the entry id `"nodejs/course"`, so
  // the first path segment is the URL-safe course slug.
  const groups = new Map<string, CollectionEntry<'chapters'>[]>();
  for (const ch of chapters) {
    const key = referencedCourseSlug(ch);
    const bucket = groups.get(key);
    if (bucket) bucket.push(ch);
    else groups.set(key, [ch]);
  }

  const statsBySlug = new Map<string, CourseStats>();
  for (const [slug, entries] of groups) {
    statsBySlug.set(slug, aggregateChapters(entries, revisionMinutesBySlug));
  }

  return sortCourses(courses).map((course) => {
    const slug = courseSlugOf(course);
    return {
      course,
      slug,
      stats: statsBySlug.get(slug) ?? EMPTY_STATS,
    };
  });
}
