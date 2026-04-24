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
  /** URL-safe chapter path (possibly nested), e.g. `"event-loop"` or `"heaps/top-k-selection/kth-largest"`. */
  slug: string;
  /** Number of slug segments — 1 for top-level, 2+ for nested (DSA topics/patterns). */
  depth: number;
  /** `true` when the chapter is a hub page (`kind === 'hub'`). */
  isHub: boolean;
  /** `chapter.data.order` surfaced for convenience. */
  order: number;
  /** `chapter.data.season` surfaced for convenience (defaults to 1 via Zod). */
  season: number;
  /** `chapter.data.status` surfaced so list rows can render `coming-soon` differently. */
  status: 'published' | 'coming-soon' | 'draft';
}

export interface CourseStatsSummary {
  /** All chapters regardless of status. */
  chapterCount: number;
  /** Chapters with `status === 'published'`. */
  publishedChapters: number;
  /** Sum of `readingMinutes` across published chapters only. */
  totalReadingMinutes: number;
  /**
   * Sum of `readingMinutes` across published + coming-soon chapters — used
   * by the hero stats row to surface the full course arc, not just what's
   * currently readable.
   */
  totalScopedReadingMinutes: number;
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
 * Extract the URL slug path from a chapter entry id. Astro's glob loader
 * strips `/index.mdx` so a leaf chapter id is `<courseSlug>/<…/chapterSlug>`.
 * Returns everything after the first segment so nested chapters (DSA
 * topics/patterns/problems) surface their full sub-path.
 */
function chapterSlugOf(chapter: CollectionEntry<'chapters'>): string {
  const parts = chapter.id.split('/');
  // Defensive: some loader configurations leave a trailing `/index` segment.
  if (parts[parts.length - 1] === 'index') parts.pop();
  if (parts.length <= 1) return chapter.id;
  return parts.slice(1).join('/');
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
  // URL slug to filter chapters belonging to this course. We surface
  // `coming-soon` rows to the UI (grayed out), but continue to hide drafts.
  const forCourse = chapters.filter(
    (ch) =>
      ch.data.course.id === course.id &&
      (ch.data.status === 'published' || ch.data.status === 'coming-soon'),
  );

  const sorted = [...forCourse].sort(
    (a, b) => a.data.season - b.data.season || a.data.order - b.data.order,
  );

  const refs: CourseChapterRef[] = sorted.map((chapter) => {
    const slug = chapterSlugOf(chapter);
    return {
      chapter,
      slug,
      depth: slug.split('/').length,
      isHub: chapter.data.kind === 'hub',
      order: chapter.data.order,
      season: chapter.data.season,
      status: chapter.data.status,
    };
  });

  // Stats only count leaf chapters (hubs are navigational pages with no
  // real reading content). For non-DSA courses with no hubs this is a no-op.
  const leaves = refs.filter((ref) => !ref.isHub);
  const publishedLeaves = leaves.filter((ref) => ref.status === 'published');
  const totalReadingMinutes = publishedLeaves.reduce(
    (sum, ref) => sum + ref.chapter.data.readingMinutes,
    0,
  );
  const totalScopedReadingMinutes = leaves.reduce(
    (sum, ref) => sum + ref.chapter.data.readingMinutes,
    0,
  );

  // "First chapter" is the first top-level chapter (depth 1) in order. For
  // flat courses every chapter is depth 1, so this reduces to the previous
  // "first leaf" behaviour. For DSA it's the first topic hub (Heaps).
  const firstTopLevel = refs
    .filter((r) => r.depth === 1 && r.status === 'published')
    .sort((a, b) => a.season - b.season || a.order - b.order)[0];

  const stats: CourseStatsSummary = {
    chapterCount: leaves.length,
    publishedChapters: publishedLeaves.length,
    totalReadingMinutes,
    totalScopedReadingMinutes,
    firstChapterSlug: firstTopLevel?.slug,
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
 * Depth-1 chapters (direct children of the course). For DSA this means the
 * topic hubs (Heaps, Intervals). For the existing 2-level courses every
 * chapter is depth 1, so this is a no-op filter.
 */
export function getTopLevelChapters(
  chapters: CourseChapterRef[],
): CourseChapterRef[] {
  return chapters.filter((ref) => ref.depth === 1);
}

/**
 * Direct children of a hub chapter. `parentSlug` is the slug path of the
 * hub (e.g. `"heaps"` or `"heaps/top-k-selection"`). A direct child has a
 * slug of the form `<parentSlug>/<nextSegment>` with exactly one extra
 * segment.
 */
export function getChildChapters(
  chapters: CourseChapterRef[],
  parentSlug: string,
): CourseChapterRef[] {
  const prefix = `${parentSlug}/`;
  const parentDepth = parentSlug.split('/').length;
  return chapters.filter(
    (ref) => ref.slug.startsWith(prefix) && ref.depth === parentDepth + 1,
  );
}

/** Leaf chapters only (non-hub). Used for prev/next and aggregate reading stats. */
export function getLeafChapters(
  chapters: CourseChapterRef[],
): CourseChapterRef[] {
  return chapters.filter((ref) => !ref.isHub);
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
