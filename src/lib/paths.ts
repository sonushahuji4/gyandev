/**
 * Shared `getStaticPaths` helpers for the three chapter-view route files.
 *
 * Per `shared/routing-and-urls.md` Step 3, each of
 *   src/pages/courses/[course]/[chapter]/index.astro    (Full Notes, canonical)
 *   src/pages/courses/[course]/[chapter]/revision.astro
 *   src/pages/courses/[course]/[chapter]/flow.astro
 * re-exports `getChapterPaths` so the chapter-params map has exactly one
 * source of truth. Changing the collection shape ripples through this file,
 * not three.
 *
 * Collection id convention (PR-3.1 seeds):
 *   course glob   '**​/course.mdx'  → id `<courseSlug>/course`   (e.g. `javascript/course`)
 *   chapter glob  '**​/index.mdx'   → id `<courseSlug>/<chapterSlug>`
 *                                     (Astro's glob loader strips the trailing
 *                                     `/index` segment automatically).
 *
 * The earlier PR-0.3 stub sliced `rest.slice(0, -1)` assuming ids retained
 * `/index`; that produced an empty `chapter` param once real content
 * landed. Fixed here — the first element is the course, the remainder is
 * the chapter slug path (usually a single segment, but the loader pattern
 * tolerates nested subfolders).
 */

import { getCollection, type CollectionEntry } from 'astro:content';

export interface ChapterPath {
  params: { course: string; chapter: string };
  props: { chapter: CollectionEntry<'chapters'> };
}

export async function getChapterPaths(): Promise<ChapterPath[]> {
  const chapters = await getCollection('chapters');
  return chapters.map((chapter) => {
    const [course, ...rest] = chapter.id.split('/');
    const chapterSlug = rest.join('/');
    return {
      params: { course, chapter: chapterSlug },
      props: { chapter },
    };
  });
}

/**
 * Leaf-only chapter paths (excludes hub pages). Used by `revision.astro` and
 * `flow.astro` — hub chapters have no Quick Revision or Flow Diagram view.
 */
export async function getLeafChapterPaths(): Promise<ChapterPath[]> {
  const paths = await getChapterPaths();
  return paths.filter((p) => p.props.chapter.data.kind !== 'hub');
}
