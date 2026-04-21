/**
 * Featured-chapter resolver (PR-4.2, home.md Step 3).
 *
 * Reads the `featured` data collection (curated in
 * `src/content/featured/featured.yml`) and resolves each row to its chapter
 * entry plus the parent course. Build-time only — the home page imports this
 * from frontmatter, never from a browser script.
 *
 * Validation is strict because the YAML is hand-edited:
 *   - No two rows may share the same `position`.
 *   - Every `(courseSlug, chapterSlug)` pair must resolve to a real chapter
 *     entry; unresolved refs throw and fail the build.
 *   - Draft / coming-soon chapters are allowed (curator discretion) — the
 *     card UI shows whatever `status` says.
 */
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export interface FeaturedChapter {
  chapter: CollectionEntry<'chapters'>;
  course: CollectionEntry<'courses'>;
  courseSlug: string;
  chapterSlug: string;
  position: number;
}

/** First segment of a course entry id, e.g. `"javascript/course"` → `"javascript"`. */
function courseSlugOf(course: CollectionEntry<'courses'>): string {
  return course.id.split('/')[0] ?? course.id;
}

export async function getFeaturedChapters(): Promise<FeaturedChapter[]> {
  const rows = await getCollection('featured');
  if (rows.length === 0) return [];

  const seenPositions = new Set<number>();
  for (const row of rows) {
    if (seenPositions.has(row.data.position)) {
      throw new Error(
        `[featured] Duplicate position ${row.data.position} in featured.yml (id: ${row.id}).`,
      );
    }
    seenPositions.add(row.data.position);
  }

  const courses = await getCollection('courses');
  const courseBySlug = new Map<string, CollectionEntry<'courses'>>();
  for (const course of courses) {
    courseBySlug.set(courseSlugOf(course), course);
  }

  const resolved: FeaturedChapter[] = [];
  for (const row of [...rows].sort((a, b) => a.data.position - b.data.position)) {
    const { courseSlug, chapterSlug, position } = row.data;
    const course = courseBySlug.get(courseSlug);
    if (!course) {
      throw new Error(
        `[featured] Unknown courseSlug "${courseSlug}" in featured.yml (id: ${row.id}).`,
      );
    }
    // Astro's glob loader strips `/index` from ids matching `**/index.mdx`,
    // so the chapter entry id is `<courseSlug>/<chapterSlug>`. Try that first
    // and fall back to the `/index` suffix in case the loader config changes.
    const baseId = `${courseSlug}/${chapterSlug}`;
    const chapter =
      (await getEntry('chapters', baseId)) ??
      (await getEntry('chapters', `${baseId}/index`));
    if (!chapter) {
      throw new Error(
        `[featured] Unknown chapter "${baseId}" referenced in featured.yml (id: ${row.id}).`,
      );
    }
    resolved.push({ chapter, course, courseSlug, chapterSlug, position });
  }
  return resolved;
}
