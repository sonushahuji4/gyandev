---
title: SEO — Implementation Plan
status: draft
spec: .claude/specs/shared/seo.md
created: 2026-04-20
session: 2
estimated_effort: 10–14 hours
dependencies:
  - .claude/plans/00-infrastructure.md
  - .claude/plans/RESEARCH.md (Topics 7, 10, 11)
  - .claude/plans/shared/routing-and-urls.md
  - .claude/plans/shared/performance.md
---

# Implementation Plan: SEO

## 1. Overview

This plan delivers the SEO surface area: a typed meta-tag factory consumed by `BaseLayout.astro`, JSON-LD schema factories for WebSite / TechArticle / Course / BreadcrumbList, a build-time OG image pipeline via `astro-og-canvas`, `@astrojs/sitemap` wiring that filters non-canonical URLs and injects accurate `lastmod` from frontmatter, three syndication feeds (RSS, Atom, JSON Feed), a `robots.txt`, the HTTP-header CSP rules extending `_headers`, and a schema-validation script for CI. Every page type on GyanDev consumes the same meta factory; every chapter gets a unique OG image and TechArticle schema; every search engine gets a clean sitemap pointing only at canonical URLs.

## 2. Spec Reference

See `.claude/specs/shared/seo.md`. Load-bearing requirements:

- §2 Required meta tags per page (title, description, canonical, robots, theme-color).
- §3 OpenGraph: title, description, type, url, site_name, locale, image (1200×630), article:published_time/modified_time/author/section/tag on chapter pages.
- §4 Twitter Card: summary_large_image, site, creator, title, description, image.
- §5 OG image auto-generation 1200×630 PNG; fallback `/og/default.png`.
- §6 JSON-LD: WebSite (home), TechArticle (chapters), Course (course overview), BreadcrumbList (everywhere with nav).
- §7 Canonical rules — Revision/Flow → Full Notes. (Delivered by `.claude/plans/shared/routing-and-urls.md`; this plan consumes.)
- §8 Sitemap: auto-gen via `@astrojs/sitemap`, filter 404/search/chapter tabs, priority hierarchy.
- §9 `robots.txt`: allow all, disallow /search + /admin, sitemap line.
- §10 Three feed formats (`/rss.xml`, `/atom.xml`, `/feed.json`) + HTML discovery tags.
- §11 Internal linking rules (mostly authoring guidance; captured in docs).
- §17 Search Console + Bing Webmaster Tools ownership.

## 3. Technical Approach

**3.1 Single meta-tag factory.** `src/lib/seo/meta.ts` exports `buildMeta(input) → MetaTags` where `MetaTags` is an array of `<meta>` / `<link>` descriptors the Astro layout renders via `{tags.map(t => <meta {...t.attrs} />)}` or equivalent. One factory, typed inputs, zero string concatenation in templates.

**3.2 JSON-LD via typed schema factories.** `src/lib/seo/jsonld.ts` exports `websiteSchema()`, `techArticleSchema()`, `courseSchema()`, `breadcrumbSchema()`. Each returns a typed object that matches schema.org. Rendering is a single helper `<JsonLd schema={schema} />` component.

**3.3 OG image pipeline via `astro-og-canvas`.** Per RESEARCH.md Topic 10, `astro-og-canvas` exposes `OGImageRoute({ param, pages, getImageOptions })` that auto-generates `getStaticPaths` and emits PNGs. We configure one route per page type:
- `src/pages/og/courses/[...slug].png.ts` for chapters + course overviews.
- `src/pages/og/[slug].png.ts` for home/about/privacy/terms (static set).
- `/og/default.png` — a committed PNG used as fallback.

**3.4 Sitemap with filter + serialize.** Per RESEARCH.md Topic 11:
- `filter`: drop `/revision`, `/flow`, `/404`, `/search`.
- `serialize`: pull `lastmod` from a frontmatter Map built at integration-init; set `priority`/`changefreq` by URL pattern.
- Submit `sitemap-index.xml` to Search Console.

**3.5 Feeds as Astro endpoints.** Three `.ts` endpoints under `src/pages/`: `rss.xml.ts`, `atom.xml.ts`, `feed.json.ts`. Each pulls latest 20 chapters from `getCollection('chapters')` sorted by `updated` desc; emits the right content-type. We hand-roll these (no `@astrojs/rss` for Atom/JSON-Feed since its output is RSS-only — for parity we use one helper `buildFeed(format)` in `src/lib/seo/feeds.ts`).

**3.6 `robots.txt` + HTML discovery tags.** `public/robots.txt` is static. Feed discovery `<link rel="alternate">` tags ship from `BaseLayout.astro`. Search Console + Bing verification strings come from env vars (`PUBLIC_GOOGLE_VERIFY`, `PUBLIC_BING_VERIFY`) rendered as `<meta name="google-site-verification">` in the meta factory.

**3.7 CSP in `_headers`.** Extend the `_headers` file (started in `.claude/plans/shared/routing-and-urls.md` + `.claude/plans/shared/performance.md`) with a complete CSP. Allow-list:
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'` initially (theme-init script) — tighten to nonces in Phase 2.
- `style-src 'self' 'unsafe-inline'` (KaTeX inline styles).
- `img-src 'self' data: https:` (permissive for inline SVGs + remote diagrams).
- `font-src 'self'`.
- `connect-src 'self' https://giscus.app` (Giscus postMessage origin).
- `frame-src https://giscus.app https://giscus.app/`.
- `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`.

**3.8 Schema validation CI step.** `scripts/validate-schema.mjs` runs against a sample of rendered pages; uses `schema-dts` types at authoring time, and a build-time validator that checks JSON-LD output parses and contains required keys per schema.

## 4. File Structure

```
src/
  lib/
    seo/
      meta.ts                                      [create — buildMeta() factory]
      jsonld.ts                                    [create — schema factories]
      feeds.ts                                     [create — buildFeed(format, items)]
      og.ts                                        [create — OG image helpers (title formatter, default paths)]
  components/
    seo/
      SEO.astro                                    [create — single component rendering all meta tags]
      JsonLd.astro                                 [create — <script type="application/ld+json">]
      Breadcrumbs.astro                            [create — visual + JSON-LD breadcrumbs]
  pages/
    og/
      [...slug].png.ts                             [create — astro-og-canvas OGImageRoute for chapters + courses]
      home.png.ts                                  [create — static pages OG]
      about.png.ts                                 [create]
      privacy.png.ts                               [create]
      terms.png.ts                                 [create]
      default.png.ts                               [create — emits /og/default.png fallback]
    rss.xml.ts                                     [create]
    atom.xml.ts                                    [create]
    feed.json.ts                                   [create]
astro.config.mjs                                   [modify — sitemap filter + serialize]
public/
  robots.txt                                       [create]
  _headers                                          [modify — append CSP]
scripts/
  validate-schema.mjs                              [create — JSON-LD sanity check]
  submit-sitemap.mjs                               [create — optional: IndexNow ping on deploy]
docs/
  SEO.md                                           [create — authoring + verification runbook]
```

## 5. Dependencies

**External (already installed):**
- `@astrojs/sitemap@^3.7.2`
- `@astrojs/mdx@^5.0.3`

**External (to add):**
- `astro-og-canvas` — stable in 0.9.x; if still 0.8.0 experimental, pin version or fall back per Session 1 open question.
- `canvaskit-wasm` — peer dep of astro-og-canvas.
- `schema-dts` (dev only) — TypeScript types for JSON-LD authoring.
- (optional) `@astrojs/rss` for RSS generation — lighter than hand-rolling, but doesn't cover Atom/JSON Feed. Default: hand-roll via `buildFeed` to have one codepath.

**Internal:**
- `src/lib/routes.ts` — `canonicalFor`, `chapterUrl`, etc.
- `BaseLayout.astro` — slot for `<SEO />` component.

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — canonical URL rules; BaseLayout props.
- `.claude/plans/shared/performance.md` — `_headers` file ownership (we append CSP).
- `.claude/plans/shared/accessibility.md` — `<h1>` hierarchy consistent with JSON-LD `headline`.

## 6. Implementation Steps (Ordered)

1. **Create `src/lib/seo/meta.ts`** — meta factory:
   ```ts
   export interface MetaInput {
     title: string;                 // page-specific, will be suffixed with site name
     description: string;
     canonical: string;             // absolute URL
     noindex?: boolean;
     ogImage?: string;              // absolute URL
     ogImageAlt?: string;
     ogType?: 'website' | 'article';
     twitterCreator?: string;
     article?: {
       publishedTime: string;       // ISO
       modifiedTime: string;
       author: string;
       section: string;
       tags: string[];
     };
   }
   export interface MetaTag {
     kind: 'meta' | 'link';
     attrs: Record<string, string>;
   }
   const SITE_NAME = 'GyanDev';
   const SITE_URL  = 'https://gyandev.org';
   const TWITTER_HANDLE = '@gyandev';

   export function buildMeta(input: MetaInput): { title: string; tags: MetaTag[] } {
     const fullTitle = input.title.endsWith(SITE_NAME) ? input.title : `${input.title} — ${SITE_NAME}`;
     const ogImage = input.ogImage ?? `${SITE_URL}/og/default.png`;
     const tags: MetaTag[] = [
       { kind: 'meta', attrs: { name: 'description', content: input.description } },
       { kind: 'link', attrs: { rel: 'canonical', href: input.canonical } },
       { kind: 'meta', attrs: { name: 'robots', content: input.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large' } },
       { kind: 'meta', attrs: { name: 'theme-color', content: '#faf7f0', media: '(prefers-color-scheme: light)' } },
       { kind: 'meta', attrs: { name: 'theme-color', content: '#131210', media: '(prefers-color-scheme: dark)' } },
       // OG
       { kind: 'meta', attrs: { property: 'og:title', content: input.title } },
       { kind: 'meta', attrs: { property: 'og:description', content: input.description } },
       { kind: 'meta', attrs: { property: 'og:type', content: input.ogType ?? 'website' } },
       { kind: 'meta', attrs: { property: 'og:url', content: input.canonical } },
       { kind: 'meta', attrs: { property: 'og:site_name', content: SITE_NAME } },
       { kind: 'meta', attrs: { property: 'og:locale', content: 'en_US' } },
       { kind: 'meta', attrs: { property: 'og:image', content: ogImage } },
       { kind: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
       { kind: 'meta', attrs: { property: 'og:image:height', content: '630' } },
       { kind: 'meta', attrs: { property: 'og:image:alt', content: input.ogImageAlt ?? input.title } },
       // Twitter
       { kind: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
       { kind: 'meta', attrs: { name: 'twitter:site', content: TWITTER_HANDLE } },
       ...(input.twitterCreator ? [{ kind: 'meta', attrs: { name: 'twitter:creator', content: input.twitterCreator } }] : []),
       { kind: 'meta', attrs: { name: 'twitter:title', content: input.title } },
       { kind: 'meta', attrs: { name: 'twitter:description', content: input.description } },
       { kind: 'meta', attrs: { name: 'twitter:image', content: ogImage } },
       { kind: 'meta', attrs: { name: 'twitter:image:alt', content: input.ogImageAlt ?? input.title } },
       // Feed discovery
       { kind: 'link', attrs: { rel: 'alternate', type: 'application/rss+xml', title: 'GyanDev RSS', href: `${SITE_URL}/rss.xml` } },
       { kind: 'link', attrs: { rel: 'alternate', type: 'application/atom+xml', title: 'GyanDev Atom', href: `${SITE_URL}/atom.xml` } },
       { kind: 'link', attrs: { rel: 'alternate', type: 'application/feed+json', title: 'GyanDev JSON Feed', href: `${SITE_URL}/feed.json` } },
     ];
     if (input.article) {
       tags.push(
         { kind: 'meta', attrs: { property: 'article:published_time', content: input.article.publishedTime } },
         { kind: 'meta', attrs: { property: 'article:modified_time', content: input.article.modifiedTime } },
         { kind: 'meta', attrs: { property: 'article:author', content: input.article.author } },
         { kind: 'meta', attrs: { property: 'article:section', content: input.article.section } },
         ...input.article.tags.map((t): MetaTag => ({ kind: 'meta', attrs: { property: 'article:tag', content: t } })),
       );
     }
     // Search Console verification (PUBLIC_ env var)
     const googleVerify = import.meta.env.PUBLIC_GOOGLE_VERIFY;
     if (googleVerify) tags.push({ kind: 'meta', attrs: { name: 'google-site-verification', content: googleVerify } });
     return { title: fullTitle, tags };
   }
   ```
   - Done when: a unit-ish test with fixture input returns the expected shape.

2. **Create `src/components/seo/SEO.astro`** — renders meta factory output:
   ```astro
   ---
   import { buildMeta, type MetaInput } from '../../lib/seo/meta';
   export interface Props extends MetaInput {}
   const { title, tags } = buildMeta(Astro.props);
   ---
   <title>{title}</title>
   {tags.map(t =>
     t.kind === 'meta'
       ? <meta {...t.attrs} />
       : <link {...t.attrs} />
   )}
   ```
   - Mount in `BaseLayout.astro` `<head>`; BaseLayout forwards its props through.
   - Done when: View Source on a sample page shows all expected tags.

3. **Create `src/lib/seo/jsonld.ts`** — schema factories. Use `schema-dts` types for compile-time safety. Key factories:
   ```ts
   import type { WebSite, TechArticle, Course, BreadcrumbList } from 'schema-dts';

   export function websiteSchema(): WebSite { /* fixed constants */ }
   export function techArticleSchema(input: {
     title: string; description: string; url: string; ogImage: string;
     datePublished: string; dateModified: string;
     author: string; section: string; tags: string[];
     proficiencyLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
     timeRequiredISO8601?: string; // e.g. 'PT15M'
   }): TechArticle { ... }
   export function courseSchema(input: {
     courseCode: string; name: string; description: string;
     educationalLevel?: string; about: string;
     timeRequiredISO8601: string;
   }): Course { ... }
   export function breadcrumbSchema(items: { name: string; url: string }[]): BreadcrumbList { ... }
   ```
   - Returns typed objects; stringify happens in the component.
   - Done when: `tsc --noEmit` passes; running each factory with sample input produces valid JSON-LD by eye.

4. **Create `src/components/seo/JsonLd.astro`** — renders JSON-LD:
   ```astro
   ---
   export interface Props { schema: object | object[]; }
   const schemas = Array.isArray(Astro.props.schema) ? Astro.props.schema : [Astro.props.schema];
   ---
   {schemas.map(s => (
     <script type="application/ld+json" set:html={JSON.stringify(s)}></script>
   ))}
   ```
   - Done when: rendered HTML contains `<script type="application/ld+json">` with valid JSON.

5. **Create `src/components/seo/Breadcrumbs.astro`** — visual + JSON-LD:
   - Props: `{ items: { name: string; url: string }[] }`.
   - Renders `<nav aria-label="Breadcrumb">` + `<ol>` + items, plus `<JsonLd schema={breadcrumbSchema(items)} />`.
   - Used on course overview, chapter (all three views), about, privacy, terms.

6. **Modify `src/layouts/BaseLayout.astro`** — integrate SEO + JsonLd:
   - Add props: `ogImage?`, `jsonLd?: object | object[]`, `article?: MetaInput['article']`.
   - In `<head>`, render `<SEO {...seoProps} />` + `{jsonLd && <JsonLd schema={jsonLd} />}`.
   - Done when: passing these props produces the expected page source.

7. **Install `astro-og-canvas` + `canvaskit-wasm` + `schema-dts`** — add to `package.json`:
   ```json
   "astro-og-canvas": "^0.9.0",   // pin to stable Astro 6 version
   "canvaskit-wasm": "^0.39.1",
   "schema-dts": "^1.1.2"         // devDependencies
   ```

8. **Create `src/lib/seo/og.ts`** — helper:
   ```ts
   export function getOgSlug(input: { course?: string; chapter?: string; staticSlug?: string }): string {
     if (input.staticSlug) return input.staticSlug;               // 'home', 'about', ...
     if (input.course && input.chapter) return `courses/${input.course}/${input.chapter}`;
     if (input.course) return `courses/${input.course}`;
     throw new Error('getOgSlug: invalid input');
   }
   export function ogImageUrl(slug: string): string {
     return `/og/${slug}.png`;
   }
   ```

9. **Create `src/pages/og/[...slug].png.ts`** — chapter + course OG route via `OGImageRoute`:
   ```ts
   import { OGImageRoute } from 'astro-og-canvas';
   import { getCollection } from 'astro:content';

   const chapters = await getCollection('chapters');
   const courses  = await getCollection('courses');

   const pages = {
     ...Object.fromEntries(chapters.map(c => [
       `courses/${c.id.split('/').slice(0, -1).join('/')}`, // drops trailing '/index'
       { title: c.data.title, description: c.data.description, course: c.data.course.id },
     ])),
     ...Object.fromEntries(courses.map(c => [
       `courses/${c.id.split('/')[0]}`,
       { title: c.data.title, description: c.data.description, course: null },
     ])),
   };

   export const { getStaticPaths, GET } = OGImageRoute({
     param: 'slug',
     pages,
     getImageOptions: (_path, page) => ({
       title: page.title,
       description: page.description,
       logo: { path: './public/og-logo.png', size: [64, 64] },
       bgGradient: [[250, 247, 240], [245, 240, 225]],
       border: { color: [194, 65, 12], width: 8, side: 'inline-start' },
       font: {
         title: { families: ['Inter'], weight: 'Bold', color: [23, 21, 15] },
         description: { families: ['Inter'], weight: 'Normal', color: [91, 86, 73] },
       },
     }),
   });
   ```
   - Fonts for Skia: bundle a TTF copy (astro-og-canvas needs OTF/TTF at this API level — check docs; WOFF2 may work via canvaskit). If TTF required, ship Inter-Regular.ttf + Inter-Bold.ttf in `public/fonts/og/` and reference by path.
   - Done when: `npm run build` produces `/og/courses/nodejs/origin-story.png` etc.

10. **Create `src/pages/og/{home,about,privacy,terms}.png.ts`** — one file per static page, using `OGImageRoute` with a single-entry `pages` map. Minimal boilerplate; could be consolidated into one `[slug].png.ts` with an allow-list.

11. **Create `public/og/default.png`** — committed fallback image (1200×630 PNG). Designed once, committed to repo. Used when OG generation fails or page opts out.

12. **Modify `astro.config.mjs`** — sitemap config:
    ```js
    import sitemap from '@astrojs/sitemap';
    import { getCollection } from 'astro:content';

    // ...
    integrations: [
      // existing: mermaid, mdx
      sitemap({
        filter: (page) =>
          !page.endsWith('/revision') &&
          !page.endsWith('/flow') &&
          !page.endsWith('/404') &&
          !page.endsWith('/search') &&
          !page.includes('/og/'),
        serialize: async (item) => {
          if (item.url === 'https://gyandev.org/') item.priority = 1.0;
          else if (/\/courses\/[^/]+\/?$/.test(item.url)) { item.priority = 0.9; item.changefreq = 'weekly'; }
          else if (/\/courses\/[^/]+\/[^/]+$/.test(item.url)) { item.priority = 0.8; item.changefreq = 'weekly'; }
          else if (item.url.endsWith('/courses')) item.priority = 0.7;
          else if (item.url.endsWith('/about')) item.priority = 0.5;
          else if (item.url.endsWith('/privacy') || item.url.endsWith('/terms')) item.priority = 0.3;
          // lastmod from frontmatter Map (precomputed at integration init)
          const lm = LASTMOD_MAP.get(new URL(item.url).pathname);
          if (lm) item.lastmod = lm.toISOString();
          return item;
        },
      }),
    ]
    ```
    - `LASTMOD_MAP` built by reading `chapters` + `courses` collections at config-load time (Astro allows async config; if not, move to a generation script pre-build).
    - Done when: `dist/sitemap-index.xml` exists; each URL has `<lastmod>` populated.

13. **Create `src/lib/seo/feeds.ts`** — feed builder:
    ```ts
    export interface FeedItem {
      title: string; url: string;
      summary: string; contentHtml: string;
      author: string; published: Date; updated: Date;
      tags: string[];
    }
    export function buildRss(items: FeedItem[]): string { /* returns RSS 2.0 XML */ }
    export function buildAtom(items: FeedItem[]): string { /* Atom 1.0 */ }
    export function buildJsonFeed(items: FeedItem[]): string { /* JSON Feed 1.1 */ }
    ```

14. **Create `src/pages/{rss.xml,atom.xml,feed.json}.ts`** — endpoints:
    ```ts
    // rss.xml.ts
    import type { APIRoute } from 'astro';
    import { getCollection, render } from 'astro:content';
    import { buildRss } from '../lib/seo/feeds';
    import { chapterUrl, canonicalFor } from '../lib/routes';

    export const GET: APIRoute = async () => {
      const chapters = (await getCollection('chapters'))
        .sort((a, b) => +b.data.updated - +a.data.updated)
        .slice(0, 20);
      const items = await Promise.all(chapters.map(async (c) => {
        const { Content } = await render(c);
        // Render to static HTML string (Astro provides Container API)
        const html = ''; // TODO: Container API usage
        return {
          title: c.data.title,
          url: canonicalFor(chapterUrl(c.data.course.id, c.id.split('/').slice(1).join('/'))),
          summary: c.data.description,
          contentHtml: html,
          author: 'Sonu Shahuji',
          published: c.data.published ?? c.data.updated,
          updated: c.data.updated,
          tags: c.data.tags ?? [],
        };
      }));
      return new Response(buildRss(items), {
        headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
      });
    };
    ```
    - Full content render (not excerpts) per spec §10. For Phase 1, if Container API usage is complex, ship excerpt-only feeds and flag in open questions.
    - Same pattern for `atom.xml.ts` and `feed.json.ts`.
    - Done when: `dist/rss.xml`, `dist/atom.xml`, `dist/feed.json` exist and validate.

15. **Create `public/robots.txt`**:
    ```
    User-agent: *
    Allow: /
    Disallow: /search
    Disallow: /admin

    Sitemap: https://gyandev.org/sitemap-index.xml
    ```

16. **Modify `public/_headers`** — append CSP:
    ```
    /*
      Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://giscus.app; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://giscus.app; frame-src https://giscus.app; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
    ```
    - `script-src 'unsafe-inline'` is the compromise for our theme-init script; tighten to `'strict-dynamic'` + hash in Phase 2.
    - Done when: browser DevTools Console shows no CSP violations on any page type.

17. **Create `scripts/validate-schema.mjs`** — post-build:
    - Reads a configured set of `dist/**/*.html` files.
    - Extracts `<script type="application/ld+json">` blocks.
    - `JSON.parse` each.
    - Asserts required keys per schema type (detected by `@type`).
    - Exit 1 on malformed JSON or missing required keys.
    - Add `"check:schema": "node scripts/validate-schema.mjs"`; extend the `check` / CI script.

18. **Create `scripts/submit-sitemap.mjs`** (optional, Phase 1 optional) — post-deploy IndexNow ping:
    - Reads `dist/sitemap-index.xml`.
    - Posts URL list to IndexNow API endpoint.
    - Flag via env var; not wired to CI by default.

19. **Create `docs/SEO.md`** — authoring runbook:
    - "Every page needs what meta" checklist.
    - How Search Console verification works.
    - How to add a new schema type.
    - Troubleshooting rich results.

20. **Add `PUBLIC_GOOGLE_VERIFY` and `PUBLIC_BING_VERIFY` to env** — document in `.env.example`; consumed by `meta.ts`. Values set in Cloudflare Pages dashboard.

21. **Wire CI**: extend `.github/workflows/ci.yml` with:
    ```yaml
    - run: npm run check:schema
    ```

## 7. Component/Module API Design

### `src/lib/seo/meta.ts`
```ts
interface MetaInput { ... }                    // see Step 1
interface MetaTag { kind: 'meta' | 'link'; attrs: Record<string, string>; }
function buildMeta(input: MetaInput): { title: string; tags: MetaTag[] };
```

### `src/lib/seo/jsonld.ts`
```ts
function websiteSchema(): WebSite;
function techArticleSchema(input: { ... }): TechArticle;
function courseSchema(input: { ... }): Course;
function breadcrumbSchema(items: { name: string; url: string }[]): BreadcrumbList;
```

### `src/components/seo/SEO.astro`
```ts
interface Props extends MetaInput {}
```
Renders `<title>` + `<meta>` + `<link>` elements.

### `src/components/seo/JsonLd.astro`
```ts
interface Props { schema: object | object[]; }
```

### `src/components/seo/Breadcrumbs.astro`
```ts
interface Props {
  items: { name: string; url: string }[];
}
```

### `src/lib/seo/feeds.ts`
```ts
interface FeedItem { title; url; summary; contentHtml; author; published; updated; tags; }
function buildRss(items: FeedItem[]): string;
function buildAtom(items: FeedItem[]): string;
function buildJsonFeed(items: FeedItem[]): string;
```

## 8. Code Patterns

**Pattern: Page-level SEO invocation.**
```astro
---
// Any page
import BaseLayout from '../layouts/BaseLayout.astro';
import { websiteSchema, breadcrumbSchema } from '../lib/seo/jsonld';
import { canonicalFor } from '../lib/routes';
const canonical = canonicalFor('/');
const jsonLd = [websiteSchema()];
---
<BaseLayout
  title="Home"
  description="Deep technical notes for modern developers. Node.js, JavaScript, System Design, DSA."
  canonical={canonical}
  ogImage={canonicalFor('/og/home.png')}
  jsonLd={jsonLd}
>
  ...
</BaseLayout>
```

**Pattern: Chapter SEO with article meta + TechArticle + Breadcrumb.**
```astro
---
import { techArticleSchema, breadcrumbSchema } from '../../lib/seo/jsonld';
const canonical = canonicalFor(chapterUrl(course.id, chapter.slug));
const jsonLd = [
  techArticleSchema({ title, description, url: canonical, ogImage, datePublished, dateModified, author, section, tags }),
  breadcrumbSchema([
    { name: 'Home',    url: canonicalFor('/') },
    { name: 'Courses', url: canonicalFor('/courses') },
    { name: course.data.title, url: canonicalFor(courseUrl(course.id)) },
    { name: chapter.data.title, url: canonical },
  ]),
];
---
<BaseLayout canonical={canonical} article={{ publishedTime, modifiedTime, author, section, tags }} jsonLd={jsonLd}>
  ...
</BaseLayout>
```

**Pattern: Revision / Flow — canonical to Full Notes + noindex.**
```astro
<BaseLayout
  canonical={canonicalFor(chapterUrl(course, chapter))}  /* NOT /revision */
  noindex={true}
  ogImage={canonicalFor(ogImageUrl(getOgSlug({ course, chapter })))}
>
```

**Pattern: Feed item — full content.** Use Astro Container API to render MDX to string:
```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
const container = await AstroContainer.create();
const html = await container.renderToString(Content);
```

## 9. Testing Strategy

**Automated CI (blocking):**
- `npm run check:schema` — JSON-LD is parseable and structurally valid.
- Lighthouse SEO category ≥ 0.95 (added to `.lighthouserc.js` from performance plan).
- Sitemap generation smoke: post-build, script asserts `dist/sitemap-index.xml` exists and contains expected URL count.

**Manual pre-ship:**
- [Rich Results Test](https://search.google.com/test/rich-results) on one chapter, one course overview, home.
- Facebook / LinkedIn debug tools — preview OG image.
- Twitter Card Validator.
- Search Console: submit sitemap, verify crawl stats.
- Bing Webmaster Tools: same.
- View Source on one URL per page type — confirm all required tags present.
- Verify OG fallback works by intentionally 404ing one chapter's OG URL.

**Ongoing:**
- Search Console Coverage report weekly.
- Rich Results report weekly.

## 10. Rollout Plan

1. Steps 1–2: `meta.ts` + `<SEO />` component. (Unblocks title/description on every page.)
2. Steps 3–4: JSON-LD factories + `<JsonLd />` component.
3. Step 5: Breadcrumbs component.
4. Step 6: BaseLayout integration.
5. Steps 7–11: OG image pipeline (+ default.png commit).
6. Step 12: sitemap config.
7. Steps 13–14: feeds.
8. Steps 15–16: robots.txt + CSP.
9. Steps 17–21: validators, docs, env, CI.

## 11. Risks and Mitigations

- **Risk: `astro-og-canvas` Astro 6 stable version not yet released at implementation time.**
  - Likelihood: medium
  - Impact: medium
  - Mitigation: pin 0.8.0 experimental or fall back to `astro-satori`. If fallback, reserved `OGImageRoute` abstraction makes switch mechanical — consumers only change the import.

- **Risk: Container API for feed content rendering is unstable (experimental_).**
  - Likelihood: medium
  - Impact: low
  - Mitigation: ship excerpt-only feeds initially; upgrade to full content when API stabilizes. Flag in open questions. Excerpt-only still satisfies spec §10 intent (most readers get "summary + link").

- **Risk: CSP blocks legitimate inline scripts (theme-init, third-party).**
  - Likelihood: medium
  - Impact: high (site broken on first load)
  - Mitigation: staged rollout — start with `'unsafe-inline'`; collect reports via `Content-Security-Policy-Report-Only`; tighten in Phase 2 after understanding what's used.

- **Risk: OG image font embedding makes `/og/` PNGs large.**
  - Likelihood: low (astro-og-canvas caches; no per-request cost)
  - Impact: low
  - Mitigation: we commit a pre-built `default.png` as a safety net.

- **Risk: `lastmod` in sitemap drifts from real last-mod because authors forget to bump frontmatter.**
  - Likelihood: high
  - Impact: medium (SEO signals stale, but not catastrophic)
  - Mitigation: add a pre-commit hook that bumps `updated: {today}` on any chapter MDX change. (Separate plan later.)

- **Risk: Duplicate-content flag from Google if Revision/Flow are indexed despite `noindex`.**
  - Likelihood: low (we set noindex + canonical)
  - Impact: medium
  - Mitigation: sitemap explicitly excludes them via `filter`. Monitor Search Console Coverage report for surprises.

- **Risk: Search Console verification TXT records interfere with our existing DNS setup.**
  - Likelihood: low
  - Impact: low
  - Mitigation: use file-based verification (meta tag) primarily; fall back to DNS TXT only if needed.

## 12. Done When

- [ ] `buildMeta()` exists and is consumed by a single `<SEO />` component.
- [ ] JSON-LD factories exist for all 4 schema types used in Phase 1.
- [ ] `<Breadcrumbs />` renders visual + JSON-LD.
- [ ] OG images auto-generated for every chapter + course overview + static page.
- [ ] `/og/default.png` exists as fallback.
- [ ] `sitemap-index.xml` generated on build, filtered, with accurate `lastmod`.
- [ ] `/rss.xml`, `/atom.xml`, `/feed.json` all served with correct Content-Type.
- [ ] `public/robots.txt` exists.
- [ ] CSP header set in `_headers`; no DevTools CSP violations on any page.
- [ ] `check:schema` passes.
- [ ] Rich Results Test validates TechArticle + Course + BreadcrumbList.
- [ ] OG preview visible in Facebook debug, Twitter validator, LinkedIn preview.

## 13. Open Questions

- [ ] **Feeds: full content vs excerpts in Phase 1.** Container API complexity may push full-content rendering to Phase 2. Default: excerpts + canonical link in Phase 1, upgrade after. Confirm with owner.
- [ ] **OG image fonts: TTF path loading under astro-og-canvas.** Current Skia-based impl requires specific font format — verify at install time whether our existing WOFF2 files work or we need TTF.
- [ ] **CSP hardening with nonces.** `'unsafe-inline'` for script-src in Phase 1 is intentionally loose. Phase 2 should switch to hash-based or nonce-based CSP.
- [ ] **Giscus comments and SEO.** Giscus iframe content is not indexed by Google (iframes aren't). That's fine — comments aren't primary content.
- [ ] **Per-course feeds.** Spec §10 mentions `/courses/nodejs/rss.xml` etc. for Phase 2. Not in this plan.
- [ ] **Author schema.** If we grow past single-author, need a `Person` schema per author and author pages at `/authors/[name]`. Not in Phase 1.
- [ ] **Structured data for Q&A / FAQ sections within chapters.** Spec §22 flag. Evaluate in Phase 2 after content patterns stabilize.
- [ ] **Submit-sitemap IndexNow automation.** Optional; enable only if we see Google indexing delays.
- [ ] **`article:author` should be a URL (schema.org) — does Facebook accept plain name?** Test in debug tool; adjust if needed.
- [ ] **Sitemap `lastmod` source when a course overview is edited.** Course overview MDX must have its own `updated` field; validate in content schema (Session 3).

## 14. References

- Spec: `.claude/specs/shared/seo.md`
- Research: `.claude/plans/RESEARCH.md` Topics 7 (Giscus mapping), 10 (OG images), 11 (sitemap)
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — canonical URLs, BaseLayout
  - `.claude/plans/shared/performance.md` — `_headers` ownership, Lighthouse SEO assertions
  - `.claude/plans/shared/accessibility.md` — `<h1>` consistency with JSON-LD `headline`
- External:
  - [Google Search Central](https://developers.google.com/search/docs)
  - [Schema.org TechArticle](https://schema.org/TechArticle)
  - [Schema.org Course](https://schema.org/Course)
  - [Open Graph Protocol](https://ogp.me/)
  - [astro-og-canvas](https://github.com/delucis/astro-og-canvas)
  - [@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
  - [JSON Feed spec](https://jsonfeed.org/)
  - [RSS 2.0 spec](https://www.rssboard.org/rss-specification)
  - [Atom 1.0 spec (RFC 4287)](https://datatracker.ietf.org/doc/html/rfc4287)
