/**
 * RSS 2.0 feed — latest 20 published chapters across all courses.
 * Content-Type per SEO spec §10 and seo.md Step 10.
 *
 * Phase 1 emits excerpt-only entries (summary = frontmatter `description`)
 * until Astro Container API stabilizes (per seo.md §11 risk).
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import {
  buildRss,
  DEFAULT_FEED_META,
  type FeedItem,
  type FeedMeta,
} from '../lib/seo/feeds';
import { canonicalFor, chapterUrl, SITE } from '../lib/routes';

async function loadItems(): Promise<FeedItem[]> {
  const chapters = await getCollection('chapters');
  return chapters
    .map((c): FeedItem => {
      const parts = c.id.split('/');
      const courseSlug = parts[0];
      const chapterSlug = parts.slice(1, -1).join('/');
      const updated = c.data.updated ?? new Date();
      return {
        title: c.data.title,
        url: canonicalFor(chapterUrl(courseSlug, chapterSlug)),
        summary: c.data.description,
        author: DEFAULT_FEED_META.author,
        published: updated,
        updated,
        tags: [],
      };
    })
    .sort((a, b) => +b.updated - +a.updated)
    .slice(0, 20);
}

export const GET: APIRoute = async () => {
  const items = await loadItems();
  const meta: FeedMeta = {
    ...DEFAULT_FEED_META,
    feedUrl: `${SITE}/rss.xml`,
    updated: items[0]?.updated ?? new Date(),
  };
  return new Response(buildRss(meta, items), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
};
