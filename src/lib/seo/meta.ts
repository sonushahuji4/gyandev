/**
 * Meta-tag factory — the single source of truth for every `<meta>` / `<link>`
 * tag emitted in GyanDev's `<head>`. Rendered by `src/components/seo/SEO.astro`;
 * no page should construct raw meta tags itself (SEO spec §2, §3, §4).
 *
 * Length caps (spec §2):
 *   - title       ≤ 60 chars (Google truncates ~600px)
 *   - description 150–155 chars ideal (Google shows ~160)
 * We warn (console.warn at build time) rather than throw so content authors can
 * ship a too-long title and get flagged in CI; `scripts/validate-schema.mjs`
 * can later promote these to hard failures.
 *
 * Example — basic page:
 *   ```ts
 *   const { title, tags } = buildMeta({
 *     title: 'About',
 *     description: 'About GyanDev...',
 *     canonical: 'https://gyandev.org/about',
 *   });
 *   ```
 *
 * Example — chapter (article + OG + canonical to Full Notes):
 *   ```ts
 *   buildMeta({
 *     title: 'Origin Story — Node.js',
 *     description: 'Why Ryan Dahl built Node.js in 2009...',
 *     canonical: canonicalFor(chapterUrl('nodejs', 'origin-story')),
 *     ogImage: canonicalFor('/og/courses/nodejs/origin-story.png'),
 *     ogType: 'article',
 *     article: {
 *       publishedTime: '2026-04-20T10:00:00Z',
 *       modifiedTime:  '2026-04-20T15:30:00Z',
 *       author: 'https://gyandev.org/about',
 *       section: 'Node.js',
 *       tags: ['nodejs', 'history'],
 *     },
 *   });
 *   ```
 *
 * Example — Revision/Flow tabs (noindex + canonical to Full Notes):
 *   ```ts
 *   buildMeta({
 *     title, description,
 *     canonical: canonicalFor(chapterUrl(course, chapter)),
 *     noindex: true,
 *   });
 *   ```
 */

import { SITE } from '../routes';

export const SITE_NAME = 'GyanDev' as const;
export const DEFAULT_OG_IMAGE = `${SITE}/og/default.png`;
export const TWITTER_SITE = '@gyandev' as const;

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

export interface ArticleMeta {
  /** ISO 8601 timestamp. */
  publishedTime: string;
  /** ISO 8601 timestamp. */
  modifiedTime: string;
  /** Absolute author URL per schema.org, e.g. `https://gyandev.org/about`. */
  author: string;
  /** Course / section label, e.g. `"Node.js"`. */
  section: string;
  tags: string[];
}

export interface MetaInput {
  /** Page-specific title; site name is appended automatically if absent. */
  title: string;
  /** Meta description — 150-155 chars ideal. */
  description: string;
  /** Absolute canonical URL. Use `canonicalFor()` to build. */
  canonical: string;
  /** When true emits `noindex, follow`; suppresses the default robots directive. */
  noindex?: boolean;
  /** Extra robots directives appended to the base value. Ignored when `noindex` is true. */
  robotsExtra?: string;
  /** Absolute OG image URL (1200×630 PNG). Falls back to `/og/default.png`. */
  ogImage?: string;
  /** Accessible description for the OG image. Defaults to `title`. */
  ogImageAlt?: string;
  /** OG `og:type` value — defaults to `'website'`; chapters use `'article'`. */
  ogType?: 'website' | 'article';
  /** Twitter handle for article creator, e.g. `@sonushahuji4`. */
  twitterCreator?: string;
  /** Present on chapter pages only — emits `article:*` OG properties. */
  article?: ArticleMeta;
}

export interface MetaTag {
  kind: 'meta' | 'link';
  attrs: Record<string, string>;
}

export interface BuiltMeta {
  /** Full `<title>` text with site name suffix. */
  title: string;
  tags: MetaTag[];
}

function suffixTitle(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
}

/**
 * Build the meta-tag descriptor list for a single page. See file header for examples.
 */
export function buildMeta(input: MetaInput): BuiltMeta {
  if (input.title.length > TITLE_MAX) {
    console.warn(`[seo] title exceeds ${TITLE_MAX} chars (${input.title.length}): ${input.title}`);
  }
  if (input.description.length > DESCRIPTION_MAX) {
    console.warn(
      `[seo] description exceeds ${DESCRIPTION_MAX} chars (${input.description.length}): ${input.canonical}`,
    );
  }

  const fullTitle = suffixTitle(input.title);
  const ogImage = input.ogImage ?? DEFAULT_OG_IMAGE;
  const ogImageAlt = input.ogImageAlt ?? input.title;
  const ogType = input.ogType ?? 'website';

  const robotsBase = input.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large';
  const robotsContent = !input.noindex && input.robotsExtra
    ? `${robotsBase}, ${input.robotsExtra}`
    : robotsBase;

  const tags: MetaTag[] = [
    { kind: 'meta', attrs: { name: 'description', content: input.description } },
    { kind: 'link', attrs: { rel: 'canonical', href: input.canonical } },
    { kind: 'meta', attrs: { name: 'robots', content: robotsContent } },

    { kind: 'meta', attrs: { name: 'theme-color', content: '#faf7f0', media: '(prefers-color-scheme: light)' } },
    { kind: 'meta', attrs: { name: 'theme-color', content: '#131210', media: '(prefers-color-scheme: dark)' } },

    { kind: 'meta', attrs: { property: 'og:title', content: input.title } },
    { kind: 'meta', attrs: { property: 'og:description', content: input.description } },
    { kind: 'meta', attrs: { property: 'og:type', content: ogType } },
    { kind: 'meta', attrs: { property: 'og:url', content: input.canonical } },
    { kind: 'meta', attrs: { property: 'og:site_name', content: SITE_NAME } },
    { kind: 'meta', attrs: { property: 'og:locale', content: 'en_US' } },
    { kind: 'meta', attrs: { property: 'og:image', content: ogImage } },
    { kind: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
    { kind: 'meta', attrs: { property: 'og:image:height', content: '630' } },
    { kind: 'meta', attrs: { property: 'og:image:alt', content: ogImageAlt } },

    { kind: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
    { kind: 'meta', attrs: { name: 'twitter:site', content: TWITTER_SITE } },
    { kind: 'meta', attrs: { name: 'twitter:title', content: input.title } },
    { kind: 'meta', attrs: { name: 'twitter:description', content: input.description } },
    { kind: 'meta', attrs: { name: 'twitter:image', content: ogImage } },
    { kind: 'meta', attrs: { name: 'twitter:image:alt', content: ogImageAlt } },
  ];

  if (input.twitterCreator) {
    tags.push({ kind: 'meta', attrs: { name: 'twitter:creator', content: input.twitterCreator } });
  }

  tags.push(
    { kind: 'link', attrs: { rel: 'alternate', type: 'application/rss+xml', title: 'GyanDev RSS', href: `${SITE}/rss.xml` } },
    { kind: 'link', attrs: { rel: 'alternate', type: 'application/atom+xml', title: 'GyanDev Atom', href: `${SITE}/atom.xml` } },
    { kind: 'link', attrs: { rel: 'alternate', type: 'application/feed+json', title: 'GyanDev JSON Feed', href: `${SITE}/feed.json` } },
  );

  if (input.article) {
    tags.push(
      { kind: 'meta', attrs: { property: 'article:published_time', content: input.article.publishedTime } },
      { kind: 'meta', attrs: { property: 'article:modified_time', content: input.article.modifiedTime } },
      { kind: 'meta', attrs: { property: 'article:author', content: input.article.author } },
      { kind: 'meta', attrs: { property: 'article:section', content: input.article.section } },
      ...input.article.tags.map((t): MetaTag => ({
        kind: 'meta',
        attrs: { property: 'article:tag', content: t },
      })),
    );
  }

  const googleVerify = import.meta.env.PUBLIC_GOOGLE_VERIFY;
  if (googleVerify) {
    tags.push({ kind: 'meta', attrs: { name: 'google-site-verification', content: googleVerify } });
  }
  const bingVerify = import.meta.env.PUBLIC_BING_VERIFY;
  if (bingVerify) {
    tags.push({ kind: 'meta', attrs: { name: 'msvalidate.01', content: bingVerify } });
  }

  return { title: fullTitle, tags };
}
