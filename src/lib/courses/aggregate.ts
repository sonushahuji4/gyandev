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
 * Derive the chapter slug (folder name) from a chapter entry id.
 * Entry ids are like `"javascript/closures/index"` for
 * `javascript/closures/index.mdx`.
 */
function chapterSlugOf(chapter: CollectionEntry<'chapters'>): string | undefined {
  const parts = chapter.id.split('/');
  // Expect `<courseSlug>/<chapterSlug>/index` (length 3) or occasionally
  // `<courseSlug>/<chapterSlug>` when a loader strips `/index`.
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[1];
  return undefined;
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
  const published = entries.filter((e) => e.data.status === 'published');
  const firstPublished = [...published].sort((a, b) => a.data.order - b.data.order)[0];
  const revisionMinutes = published.reduce((sum, e) => {
    const chapterKey = chapterKeyOf(e);
    return sum + (chapterKey ? (revisionMinutesBySlug.get(chapterKey) ?? 0) : 0);
  }, 0);
  return {
    chapterCount: entries.length,
    publishedChapters: published.length,
    totalReadingMinutes: published.reduce((sum, e) => sum + e.data.readingMinutes, 0),
    revisionReadingMinutes: revisionMinutes,
    firstChapterSlug: firstPublished ? chapterSlugOf(firstPublished) : undefined,
  };
}

/** `"<courseSlug>/<chapterSlug>"` lookup key used to pair chapters to views. */
function chapterKeyOf(chapter: CollectionEntry<'chapters'>): string | undefined {
  const parts = chapter.id.split('/');
  // Accept `<courseSlug>/<chapterSlug>/index` (3 parts) or
  // `<courseSlug>/<chapterSlug>` (2 parts).
  if (parts.length >= 3) return `${parts[0]}/${parts[parts.length - 2]}`;
  if (parts.length === 2) return `${parts[0]}/${parts[1]}`;
  return undefined;
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
    const key = `${parts[0]}/${parts[parts.length - 2]}`;
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
