/**
 * Feed builders for RSS 2.0, Atom 1.0, and JSON Feed 1.1 (SEO spec §10).
 *
 * All three formats share one FeedItem shape so `src/pages/{rss,atom,feed}.ts`
 * pull from a single data-loading function and pass the same array into the
 * format-specific serializer.
 *
 * Phase 1 ships excerpt-only feeds (per plan §11 risk table + §13 open question).
 * `contentHtml` is optional; when omitted we emit `<description>` / `<summary>`
 * from `summary` only. Upgrade to full content via Astro Container API in a
 * follow-up once the API stabilizes.
 */

import { SITE } from '../routes';

export interface FeedItem {
  title: string;
  /** Absolute canonical URL (Full Notes only). */
  url: string;
  /** Short excerpt / description. */
  summary: string;
  /** Optional full-content HTML — included when present. */
  contentHtml?: string;
  /** Author display name. */
  author: string;
  /** ISO 8601 publish date. */
  published: Date;
  /** ISO 8601 update date. */
  updated: Date;
  tags: string[];
}

export interface FeedMeta {
  /** Feed title (e.g. "GyanDev"). */
  title: string;
  /** Feed self-URL (e.g. `${SITE}/rss.xml`). */
  feedUrl: string;
  /** Site root URL. */
  siteUrl: string;
  /** Feed description. */
  description: string;
  /** Language BCP-47 tag, e.g. `"en-US"`. */
  language: string;
  /** ISO 8601 timestamp of newest item or build time. */
  updated: Date;
  /** Copyright line. */
  author: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function rfc822(date: Date): string {
  return date.toUTCString();
}

function rfc3339(date: Date): string {
  return date.toISOString();
}

/** RSS 2.0. Spec: https://www.rssboard.org/rss-specification */
export function buildRss(meta: FeedMeta, items: FeedItem[]): string {
  const entries = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${rfc822(item.published)}</pubDate>
      <author>noreply@gyandev.org (${escapeXml(item.author)})</author>
      <description>${cdata(item.contentHtml ?? item.summary)}</description>
${item.tags.map((t) => `      <category>${escapeXml(t)}</category>`).join('\n')}
    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <link>${escapeXml(meta.siteUrl)}</link>
    <description>${escapeXml(meta.description)}</description>
    <language>${escapeXml(meta.language)}</language>
    <lastBuildDate>${rfc822(meta.updated)}</lastBuildDate>
    <atom:link href="${escapeXml(meta.feedUrl)}" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>
`;
}

/** Atom 1.0. Spec: RFC 4287. */
export function buildAtom(meta: FeedMeta, items: FeedItem[]): string {
  const entries = items
    .map(
      (item) => `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.url)}" />
    <id>${escapeXml(item.url)}</id>
    <published>${rfc3339(item.published)}</published>
    <updated>${rfc3339(item.updated)}</updated>
    <author><name>${escapeXml(item.author)}</name></author>
    <summary>${escapeXml(item.summary)}</summary>
${item.contentHtml ? `    <content type="html">${cdata(item.contentHtml)}</content>` : ''}
${item.tags.map((t) => `    <category term="${escapeXml(t)}" />`).join('\n')}
  </entry>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(meta.language)}">
  <title>${escapeXml(meta.title)}</title>
  <subtitle>${escapeXml(meta.description)}</subtitle>
  <link rel="self" href="${escapeXml(meta.feedUrl)}" />
  <link rel="alternate" href="${escapeXml(meta.siteUrl)}" />
  <id>${escapeXml(meta.siteUrl)}/</id>
  <updated>${rfc3339(meta.updated)}</updated>
  <author><name>${escapeXml(meta.author)}</name></author>
${entries}
</feed>
`;
}

/** JSON Feed 1.1. Spec: https://jsonfeed.org/version/1.1 */
export function buildJsonFeed(meta: FeedMeta, items: FeedItem[]): string {
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: meta.title,
    home_page_url: meta.siteUrl,
    feed_url: meta.feedUrl,
    description: meta.description,
    language: meta.language,
    authors: [{ name: meta.author }],
    items: items.map((item) => ({
      id: item.url,
      url: item.url,
      title: item.title,
      summary: item.summary,
      ...(item.contentHtml
        ? { content_html: item.contentHtml }
        : { content_text: item.summary }),
      date_published: rfc3339(item.published),
      date_modified: rfc3339(item.updated),
      authors: [{ name: item.author }],
      tags: item.tags,
    })),
  };
  return JSON.stringify(feed, null, 2) + '\n';
}

export const DEFAULT_FEED_META: Omit<FeedMeta, 'feedUrl' | 'updated'> = {
  title: 'GyanDev',
  siteUrl: SITE,
  description: 'Deep technical notes for modern developers.',
  language: 'en-US',
  author: 'Sonu Shahuji',
};
