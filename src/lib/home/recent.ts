/**
 * Recently-updated chapter resolver (PR-4.2, home.md Step 4).
 *
 * Returns the top-N published chapters by `updated` descending, paired with
 * their parent course so the home list can render the course label without a
 * second lookup. Excludes:
 *   - chapters whose own `status !== 'published'`
 *   - chapters whose parent course's `status !== 'published'` (coming-soon and
 *     draft courses stay out of the public surface)
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export interface RecentChapter {
  chapter: CollectionEntry<'chapters'>;
  course: CollectionEntry<'courses'>;
  courseSlug: string;
  chapterSlug: string;
  /** `(now - published) < 7 days`. Computed by `getRecentlyUpdatedChapters`. */
  isNew: boolean;
}

function courseSlugOf(course: CollectionEntry<'courses'>): string {
  return course.id.split('/')[0] ?? course.id;
}

function chapterSlugOf(chapter: CollectionEntry<'chapters'>): string | undefined {
  const parts = chapter.id.split('/');
  if (parts[parts.length - 1] === 'index') parts.pop();
  if (parts.length <= 1) return undefined;
  return parts.slice(1).join('/');
}

function courseKeyFromRef(refId: string): string {
  // `chapter.data.course.id` is the course entry id (e.g. `"javascript/course"`).
  // The first path segment is the URL-facing course slug.
  return refId.split('/')[0] ?? refId;
}

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function getRecentlyUpdatedChapters(
  limit = 5,
  now: Date = new Date(),
): Promise<RecentChapter[]> {
  const [chapters, courses] = await Promise.all([
    getCollection('chapters'),
    getCollection('courses'),
  ]);

  const publishedCourseBySlug = new Map<string, CollectionEntry<'courses'>>();
  for (const course of courses) {
    if (course.data.status === 'published') {
      publishedCourseBySlug.set(courseSlugOf(course), course);
    }
  }

  const rows: RecentChapter[] = [];
  for (const chapter of chapters) {
    if (chapter.data.status !== 'published') continue;
    // Hub chapters are navigational pages — never surface them on the
    // "recently updated" home strip.
    if (chapter.data.kind === 'hub') continue;
    const courseSlug = courseKeyFromRef(chapter.data.course.id);
    const course = publishedCourseBySlug.get(courseSlug);
    if (!course) continue;

    const chapterSlug = chapterSlugOf(chapter);
    if (!chapterSlug) continue;

    const publishedMs = chapter.data.published ? +chapter.data.published : 0;
    const isNew = publishedMs > 0 && +now - publishedMs < NEW_WINDOW_MS;

    rows.push({ chapter, course, courseSlug, chapterSlug, isNew });
  }

  rows.sort((a, b) => +b.chapter.data.updated - +a.chapter.data.updated);
  return rows.slice(0, limit);
}
