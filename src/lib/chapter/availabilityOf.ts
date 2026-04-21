/**
 * Per-chapter view availability — does the chapter have a Quick Revision
 * MDX, a Flow Diagram MDX, or only the Full Notes (`index.mdx`)?
 *
 * `full` is always true for any published chapter — Phase 1 requires
 * `index.mdx`. Revision/Flow are optional; an absent `chapterViews` entry
 * means the corresponding tab renders the `<ComingSoonView>` instead of MDX.
 *
 * Usage shapes:
 *
 *   1. From a `getChapterContext()` result:
 *        const a = availabilityOf({ revision, flow });
 *
 *   2. From a chapter id alone (used by LeftSidebar to dot-mark sibling
 *      chapters' availability without re-fetching all `chapterViews`):
 *        const a = await availabilityFromId('javascript/closures');
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export interface ViewAvailability {
  /** Always true for published chapters in Phase 1. */
  full: true;
  revision: boolean;
  flow: boolean;
}

export function availabilityOf(ctx: {
  revision: CollectionEntry<'chapterViews'> | undefined;
  flow: CollectionEntry<'chapterViews'> | undefined;
}): ViewAvailability {
  return { full: true, revision: !!ctx.revision, flow: !!ctx.flow };
}

/**
 * Build-time cache of every `chapterViews` entry, keyed by id. We hit this
 * once per `astro build` run; getCollection is hot-cached by Astro so the
 * cost amortises across every chapter page.
 *
 * `getEntry` would also work but logs a "was not found" warning for every
 * missing sibling (which is the *expected* state for chapters without a
 * revision or flow yet). Looking up against a local map keeps the build
 * log clean.
 */
let viewsByIdPromise: Promise<Map<string, CollectionEntry<'chapterViews'>>> | null = null;

async function getViewsById(): Promise<Map<string, CollectionEntry<'chapterViews'>>> {
  if (!viewsByIdPromise) {
    viewsByIdPromise = (async () => {
      const all = await getCollection('chapterViews');
      const map = new Map<string, CollectionEntry<'chapterViews'>>();
      for (const entry of all) map.set(entry.id, entry);
      return map;
    })();
  }
  return viewsByIdPromise;
}

/**
 * Resolve the sibling `chapterViews` entries for a given chapter id (e.g.
 * `"javascript/closures"`). Returns `undefined` for missing views without
 * any console warning.
 */
export async function getChapterViews(chapterId: string): Promise<{
  revision: CollectionEntry<'chapterViews'> | undefined;
  flow: CollectionEntry<'chapterViews'> | undefined;
}> {
  const map = await getViewsById();
  return {
    revision: map.get(`${chapterId}/revision`),
    flow: map.get(`${chapterId}/flow`),
  };
}

/**
 * Resolve availability for a chapter by its id (used by sibling-chapter UI
 * — LeftSidebar dots, prev/next href rewriting — when the caller doesn't
 * already have the chapterViews entries in hand).
 */
export async function availabilityFromId(chapterId: string): Promise<ViewAvailability> {
  const views = await getChapterViews(chapterId);
  return availabilityOf(views);
}

/** Compact `"full,revision,flow"` string for `data-views` attrs. */
export function viewsAttr(a: ViewAvailability): string {
  const out: string[] = ['full'];
  if (a.revision) out.push('revision');
  if (a.flow) out.push('flow');
  return out.join(',');
}
