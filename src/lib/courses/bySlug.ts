/**
 * Build-time course-overview data helpers (PR-4.1).
 *
 * Responsibility: given a URL course slug (e.g. `"javascript"`), resolve the
 * matching `courses` entry plus its chapters and precomputed stats so the
 * course-overview page can render with a single await. Also exposes helpers
 * for season grouping and per-view availability.
 *
 * The chapter aggregation mirrors `src/lib/courses/aggregate.ts` so published
 * chapter counts / reading minutes stay consistent between the catalog and
 * the course-overview page.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export interface CourseChapterRef {
  /** The underlying `chapters` collection entry. */
  chapter: CollectionEntry<'chapters'>;
  /** URL-safe chapter segment, e.g. `"event-loop"`. */
  slug: string;
  /** `chapter.data.order` surfaced for convenience. */
  order: number;
  /** `chapter.data.season` surfaced for convenience (defaults to 1 via Zod). */
  season: number;
}

export interface CourseStatsSummary {
  /** All chapters regardless of status. */
  chapterCount: number;
  /** Chapters with `status === 'published'`. */
  publishedChapters: number;
  /** Sum of `readingMinutes` across published chapters only. */
  totalReadingMinutes: number;
  /** Slug of the lowest-order published chapter — target of "Start Chapter 1". */
  firstChapterSlug?: string;
}

export interface CourseBundle {
  course: CollectionEntry<'courses'>;
  /** URL course slug (first segment of entry id). */
  slug: string;
  /** Published chapters only, sorted by `season` then `order`. */
  chapters: CourseChapterRef[];
  stats: CourseStatsSummary;
}

export interface ChapterAvailability {
  /** Full Notes view — always true for published chapters in Phase 1. */
  full: boolean;
  /** Quick Revision view. Defaults true until `chapterViews` collection lands (PR-5.1). */
  revision: boolean;
  /** Flow Diagram view. Defaults true until `chapterViews` collection lands (PR-5.1). */
  flow: boolean;
}

/**
 * Extract the URL slug from a chapter entry id.
 * Ids look like `"javascript/event-loop/index"` for `event-loop/index.mdx`.
 */
function chapterSlugOf(chapter: CollectionEntry<'chapters'>): string {
  const parts = chapter.id.split('/');
  if (parts.length >= 3) return parts[parts.length - 2]!;
  if (parts.length === 2) return parts[1]!;
  return chapter.id;
}

/**
 * Load a course by URL slug and bundle it with its sorted chapter list +
 * aggregate stats. Returns `null` when the slug does not resolve to a
 * `courses` entry (caller typically uses this for `getStaticPaths` sanity).
 *
 * Only `status === 'published'` chapters flow into the returned list and
 * stats; drafts and coming-soon entries are filtered out so the page never
 * surfaces unshipped content.
 */
export async function getCourseBySlug(slug: string): Promise<CourseBundle | null> {
  const [courses, chapters] = await Promise.all([
    getCollection('courses'),
    getCollection('chapters'),
  ]);

  const course = courses.find((c) => c.id.split('/')[0] === slug);
  if (!course) return null;

  // Chapter `course:` references resolve to the full course entry id
  // (`"javascript/course"`), so compare against `course.id` rather than the
  // URL slug to filter chapters belonging to this course.
  const forCourse = chapters.filter(
    (ch) => ch.data.course.id === course.id && ch.data.status === 'published',
  );

  const sorted = [...forCourse].sort(
    (a, b) => a.data.season - b.data.season || a.data.order - b.data.order,
  );

  const refs: CourseChapterRef[] = sorted.map((chapter) => ({
    chapter,
    slug: chapterSlugOf(chapter),
    order: chapter.data.order,
    season: chapter.data.season,
  }));

  const totalReadingMinutes = refs.reduce(
    (sum, ref) => sum + ref.chapter.data.readingMinutes,
    0,
  );

  const stats: CourseStatsSummary = {
    chapterCount: refs.length,
    publishedChapters: refs.length,
    totalReadingMinutes,
    firstChapterSlug: refs[0]?.slug,
  };

  return { course, slug, chapters: refs, stats };
}

/**
 * Group an already-sorted list of chapter refs by `season` number. The map
 * preserves ascending season order; within each bucket the input order is
 * preserved, so callers get `[[1, [ch01, ch02, ch03]], [2, [ch04, ch05]]]`
 * when they pass a `getCourseBySlug()` result.
 */
export function getChaptersGroupedBySeason(
  chapters: CourseChapterRef[],
): Map<number, CourseChapterRef[]> {
  const map = new Map<number, CourseChapterRef[]>();
  for (const ref of chapters) {
    const bucket = map.get(ref.season);
    if (bucket) bucket.push(ref);
    else map.set(ref.season, [ref]);
  }
  return new Map([...map.entries()].sort(([a], [b]) => a - b));
}

/**
 * Per-view availability dots. Phase 1 assumes every published chapter has
 * all three views ready because the `chapterViews` collection (PR-5.1) has
 * not landed yet — the three-way split hasn't been authored. Once
 * `chapterViews` ships, this helper will inspect the sibling entries.
 */
export function getChapterAvailability(
  chapter: CollectionEntry<'chapters'>,
): ChapterAvailability {
  const isPublished = chapter.data.status === 'published';
  return {
    full: isPublished,
    revision: isPublished,
    flow: isPublished,
  };
}
