/**
 * Prev/Next chapter resolution — drives the chapter footer + the
 * ArrowLeft/ArrowRight keybindings.
 *
 * Order: chapters within a course are sorted by `(season, order)` (matching
 * `getCourseBySlug` from PR-4.1). Boundaries return `null` so the footer
 * renders the "Back to course overview" fallback.
 *
 * `views` is a comma-joined availability string (`"full,revision,flow"` or
 * `"full"` etc.) baked into the rendered link's `data-views` attr so
 * `chapter-hydrate.ts` can rewrite the href to honour the active-tab
 * preference without an additional fetch at hydration time.
 */
import { courseUrl, chapterUrl } from '../routes';
import { getCourseBySlug, getLeafChapters, type CourseChapterRef } from '../courses/bySlug';
import { availabilityFromId, viewsAttr } from './availabilityOf';

export interface PrevNextItem {
  title: string;
  url: string;
  /** `"full"` | `"full,revision"` | … — drives client-side pref-aware href rewrites. */
  views: string;
}

export interface PrevNext {
  prev: PrevNextItem | null;
  next: PrevNextItem | null;
}

async function toItem(
  courseSlug: string,
  ref: CourseChapterRef,
): Promise<PrevNextItem> {
  const a = await availabilityFromId(`${courseSlug}/${ref.slug}`);
  return {
    title: ref.chapter.data.title,
    url: chapterUrl(courseSlug, ref.slug),
    views: viewsAttr(a),
  };
}

export async function prevNext(
  courseSlug: string,
  chapterSlug: string,
): Promise<PrevNext> {
  const bundle = await getCourseBySlug(courseSlug);
  if (!bundle) return { prev: null, next: null };

  // Prev/Next navigates between leaf chapters only; hubs are navigational
  // pages and are skipped.
  const leaves = getLeafChapters(bundle.chapters);
  const i = leaves.findIndex((c) => c.slug === chapterSlug);
  if (i === -1) return { prev: null, next: null };

  const prevRef = i > 0 ? leaves[i - 1] : null;
  const nextRef = i < leaves.length - 1 ? leaves[i + 1] : null;

  const [prev, next] = await Promise.all([
    prevRef ? toItem(courseSlug, prevRef) : Promise.resolve(null),
    nextRef ? toItem(courseSlug, nextRef) : Promise.resolve(null),
  ]);

  return { prev, next };
}

/** Course-overview fallback URL — used when a chapter is at a course boundary. */
export function courseOverviewUrl(courseSlug: string): string {
  return courseUrl(courseSlug);
}
