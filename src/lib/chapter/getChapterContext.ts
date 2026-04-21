/**
 * Build-time helper that fans out every collection lookup a chapter route
 * needs. Each of the three `[chapter]/{index,revision,flow}.astro` route
 * files calls this once, then renders.
 *
 * Returns:
 *   - `course`            — the parent `courses` entry
 *   - `courseSlug`        — first segment of `chapter.id`
 *   - `chapterSlug`       — second segment (the URL chapter param)
 *   - `revision` / `flow` — sibling `chapterViews` entries (or undefined)
 *   - `availability`      — `{ full, revision, flow }` flags
 *   - `bundle`            — full course bundle (chapters list + stats) so
 *                           the LeftSidebar can render without a second pass
 */
import type { CollectionEntry } from 'astro:content';

import { availabilityOf, getChapterViews, type ViewAvailability } from './availabilityOf';
import { getCourseBySlug, type CourseBundle } from '../courses/bySlug';

export interface ChapterContext {
  chapter: CollectionEntry<'chapters'>;
  course: CollectionEntry<'courses'>;
  courseSlug: string;
  chapterSlug: string;
  revision: CollectionEntry<'chapterViews'> | undefined;
  flow: CollectionEntry<'chapterViews'> | undefined;
  availability: ViewAvailability;
  bundle: CourseBundle;
}

export async function getChapterContext(
  chapter: CollectionEntry<'chapters'>,
): Promise<ChapterContext> {
  // chapter.id shape: `<courseSlug>/<chapterSlug>` (Astro's glob loader strips
  // the `/index` segment automatically — see `src/lib/paths.ts` header).
  const [courseSlug, ...rest] = chapter.id.split('/');
  const chapterSlug = rest.join('/');

  const [bundle, views] = await Promise.all([
    getCourseBySlug(courseSlug),
    getChapterViews(`${courseSlug}/${chapterSlug}`),
  ]);
  const { revision, flow } = views;

  if (!bundle) {
    throw new Error(
      `getChapterContext: course "${courseSlug}" not found for chapter "${chapter.id}"`,
    );
  }

  return {
    chapter,
    course: bundle.course,
    courseSlug,
    chapterSlug,
    revision,
    flow,
    availability: availabilityOf({ revision, flow }),
    bundle,
  };
}
