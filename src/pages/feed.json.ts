/**
 * JSON Feed 1.1 — latest 20 published chapters. See `src/pages/rss.xml.ts`
 * for data-loading notes.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import {
  buildJsonFeed,
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
    feedUrl: `${SITE}/feed.json`,
    updated: items[0]?.updated ?? new Date(),
  };
  return new Response(buildJsonFeed(meta, items), {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
};
