# SEO runbook

Owner plan: [shared/seo.md](../.claude/plans/shared/seo.md). This document is the operational companion — what ships on launch, what to monitor weekly, how to keep content fresh without spamming `lastmod`, and how to triage an indexing or rich-result regression.

## Overview

GyanDev is an organic-traffic site: no paid acquisition, no ad-budget backstop. Every launch-gate decision optimizes for the three signals Google uses:

1. **Canonical, crawlable URLs.** One URL per piece of content; canonicals on every page.
2. **Clean structured data.** JSON-LD for `TechArticle`, `Course`, `BreadcrumbList`, `WebSite`, `Person`, `AboutPage`, `ItemList` — all validated in CI.
3. **Fast, stable core web vitals.** See `docs/PERF.md`. Google's experience signals feed back into ranking.

Revision and Flow views share the Full Notes canonical; they're `noindex, follow` and excluded from the sitemap. One indexed URL per chapter. No duplicate content risk.

## Pre-launch SEO checklist

From seo.md §20. Everything in this list must be green before flipping DNS to `gyandev.org`.

- [ ] `site: 'https://gyandev.org'` in `astro.config.mjs`; `trailingSlash: 'never'`; `build.format: 'file'`.
- [ ] Every page renders `<link rel="canonical">` via the single `<SEO />` component; no page writes its own `<meta>` directly.
- [ ] Revision and Flow canonicals point at Full Notes; both emit `noindex, follow`.
- [ ] `sitemap-index.xml` builds; excludes `/revision`, `/flow`, `/404`, `/search`, `/og/*`, and coming-soon courses.
- [ ] `lastmod` populated from frontmatter `updated` on every sitemap entry.
- [ ] `robots.txt` served at `/robots.txt` with `Sitemap: https://gyandev.org/sitemap-index.xml`.
- [ ] `/rss.xml`, `/atom.xml`, `/feed.json` all served with correct `Content-Type`.
- [ ] `<link rel="alternate">` discovery tags for all three feeds in `<head>`.
- [ ] `PUBLIC_GOOGLE_VERIFY` + `PUBLIC_BING_VERIFY` set in Cloudflare Pages dashboard; verification meta tags render in `<head>`.
- [ ] `/og/default.png` committed; per-chapter + per-course OG images generate under `/og/courses/**/*.png`.
- [ ] All JSON-LD factories pass `npm run check:schema`.
- [ ] Rich Results Test ([search.google.com/test/rich-results](https://search.google.com/test/rich-results)) validates one of each: `TechArticle`, `Course`, `BreadcrumbList`, `ItemList`, `WebSite+SearchAction`, `Person`, `AboutPage`.
- [ ] Facebook Sharing Debugger, Twitter Card Validator, LinkedIn Post Inspector all render the OG card cleanly on one home + one chapter URL.
- [ ] CSP header in `public/_headers` has no violations in DevTools Console across all page types (including `/search` — requires `'wasm-unsafe-eval'`).
- [ ] Cloudflare Redirect Rule `www.gyandev.org → gyandev.org` configured in CF dashboard (zone-level, not `_redirects`).
- [ ] Search Console + Bing Webmaster Tools both verify; `sitemap-index.xml` submitted in each.

## Weekly monitoring tasks

Run these every Monday morning, or within 24 h of any deploy that touches content routing / canonicals / sitemap.

### Search Console

1. **Coverage report.** Check "Why pages aren't indexed" — any new "Excluded" or "Error" URLs that are not expected (revision/flow/search/og/404 are expected)?
2. **Core Web Vitals report.** Any URL group moved from Good → Needs Improvement or Poor? Cross-reference with `docs/PERF.md` regression protocol.
3. **Manual actions** (Security & Manual Actions tab). Should always be empty. If not, stop monitoring and address immediately.
4. **Enhancements.** `TechArticle`, `Course`, `Breadcrumb`, `Sitelinks searchbox` — each should show a stable or growing valid-URL count. New invalid items means a schema regression.

### New errors triage

Anything that shows up in the Coverage "Error" or "Excluded" (unexpected reason) buckets gets triaged within the week:

- **`Soft 404`** → content quality flag; our 404 page is explicit and unlikely to trigger this, but a coming-soon course without content can. Confirm the course's `status: 'coming-soon'` is excluding it from the sitemap.
- **`Page with redirect`** → an internal link still points at a pre-rename slug. Find the link; don't add a redirect chain.
- **`Not found (404)`** → an internal link broke. Audit with `grep -rn "/courses/old-slug" src/`; update the link.
- **`Duplicate without user-selected canonical`** → a revision/flow URL leaked into the sitemap. Check the sitemap filter in `astro.config.mjs`.
- **`Blocked by robots.txt`** → an unexpected `Disallow` was added. `public/robots.txt` should only disallow `/search` and `/admin`.

### Indexing gaps investigation

New chapter published but not indexed after 10+ days:

1. Confirm it's in `sitemap-index.xml` (fetch `https://gyandev.org/sitemap-index.xml` and inspect).
2. Confirm canonical in page source matches its own URL.
3. Confirm `robots` meta is `index, follow` (not `noindex`).
4. URL Inspection in Search Console → "Request indexing" to push a manual crawl.
5. If still not indexed after 7 more days, check for thin-content heuristic: chapter < 300 words or all code-block with no prose. Add intro / summary prose, bump `updated`, re-request.

## Content freshness protocol

Google rewards freshness signals but penalizes gaming them. Our rule:

### `updated_at` bumping rules

Bump the `updated` frontmatter field **only when the content changed in a way that changes its meaning**:

- ✅ Added a new section, corrected a technical error, rewrote for clarity, updated a code example for a newer API version.
- ❌ Fixed a typo, reworded for style, changed a heading's capitalization, updated a reference date in prose.

The bar is: "would a reader who already read this benefit from reading it again?" If yes, bump. If no, don't.

The pre-commit hook (or manual bump) writes the full ISO timestamp (`updated: 2026-04-21T14:00:00Z`). The sitemap picks it up via the `LASTMOD_MAP` serializer; `TechArticle` JSON-LD picks it up as `dateModified`; the RSS/Atom/JSON feeds sort by it.

### Quarterly content review

Every quarter, audit every published chapter:

- **Technical accuracy.** Is the described behavior still true in the current stable version of the runtime (Node, browser, etc.)?
- **Link rot.** Any external links 404 or redirect to unrelated content?
- **Deprecation notices.** APIs that were "experimental" or "stable" may have moved. Flag in an intro admonition.

`scripts/check-legal-freshness.mjs` is a model for this (it fails CI on stale legal pages without a `updated` bump). A content-wide freshness check is Phase 1.5 work; for now the quarterly sweep is a calendar task owned by sonushahuji4.

### Changelog for major updates

When a chapter has a substantive revision (more than a typo fix), append an entry to the chapter body under a `## Revision history` heading:

```
## Revision history

- **2026-04-21** — Added section on async iteration; clarified event loop tick semantics.
- **2026-02-10** — Initial publish.
```

This is user-visible and makes the freshness signal legible to readers as well as search engines.

## Sitemap troubleshooting

### Pages not indexed after appearing in sitemap

1. Inspect the URL in Search Console → "URL Inspection" → "Test live URL". Googlebot-rendered HTML shows what the crawler sees. Confirm canonical, `robots`, `h1`, JSON-LD.
2. Check `https://gyandev.org/sitemap-index.xml` renders XML with `Content-Type: application/xml` (not `text/html`).
3. If the URL is in the sitemap but rendered as "Excluded by `noindex`", the per-page `noindex` leaked. Read the page source; grep for `noindex`. Revision/Flow legitimately `noindex` — Full Notes must not.

### `lastmod` accuracy checks

After a content PR merges:

1. `curl -s https://gyandev.org/sitemap-index.xml | grep "<loc>"` to get sub-sitemap URLs.
2. `curl -s <sub-sitemap-url> | grep -A1 "<loc>.*chapter-slug"` to see the `<lastmod>` for the changed chapter. Should match the frontmatter `updated` value.
3. If it doesn't, the `LASTMOD_MAP` in `astro.config.mjs` didn't pick up the change. Rebuild locally, check `dist/sitemap-0.xml` for the expected value; if still wrong, the serializer logic needs a patch.

### Excluded URL verification

Run periodically, and whenever the sitemap filter is modified:

- `curl -s https://gyandev.org/sitemap.xml | grep -c "/revision"` → should be `0`.
- `curl -s https://gyandev.org/sitemap.xml | grep -c "/flow"` → should be `0`.
- `curl -s https://gyandev.org/sitemap.xml | grep -c "/search"` → should be `0`.
- `curl -s https://gyandev.org/sitemap.xml | grep -c "/404"` → should be `0`.
- `curl -s https://gyandev.org/sitemap.xml | grep -c "/og/"` → should be `0`.

For revision/flow specifically, also confirm the *canonical* check: open the page source of `/courses/javascript/01-event-loop/revision` — the canonical link must point at `/courses/javascript/01-event-loop` (no `/revision`).

## Structured data validation

### Tools

- [Rich Results Test](https://search.google.com/test/rich-results) — Google's official validator. Also shows the rich result preview.
- [Schema.org Validator](https://validator.schema.org/) — general-purpose JSON-LD validator. Flags unrecognized properties that Rich Results Test ignores.
- `npm run check:schema` — local pre-merge gate. Walks `dist/**/*.html`, extracts every `<script type="application/ld+json">`, parses it, asserts minimum keys per `@type`.

### JSON-LD common errors

| Error | Likely cause | Fix |
|---|---|---|
| `@context` missing or wrong URL | Typed factory output ran through a transform that stripped it | Always stringify the factory's return value directly; don't `Object.assign` over it. |
| `@type` present but unrecognized | Typo — `TechArtcile` instead of `TechArticle` | `schema-dts` catches this at compile time; run `npm run validate` (Astro type check). |
| `datePublished` or `dateModified` not ISO 8601 | Passed a Date object as string without `.toISOString()` | Convert explicitly: `date.toISOString()`. |
| `image` field references a non-existent URL | OG image for a new chapter didn't generate | Rebuild; check `dist/og/courses/**` for the expected PNG. |
| `BreadcrumbList` items in wrong order | Built from a route-walk that didn't include "Home" | Always start with `{ name: 'Home', url: canonicalFor('/') }`; end with the current page. |
| `TechArticle.author` is a string where schema.org wants a Person | Quick-n-dirty fix that passed Rich Results Test but schema.org validator rejects | Use a proper `Person` sub-object with `@type`, `name`, `url`. |

After any schema change, run the URL through Rich Results Test on preview before merging to `main`. The preview URL is Cloudflare Pages' auto-generated `<branch>.gyandev.pages.dev`.

## OG image troubleshooting

Every chapter, course overview, and static page gets an auto-generated 1200×630 PNG via `astro-og-canvas`. When social previews break, it's almost always a cache issue rather than a broken image.

### Debuggers

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — also scrapes LinkedIn-ish previews. "Scrape Again" forces a refresh.
- [Twitter (X) Card Validator](https://cards-dev.twitter.com/validator) — deprecated since the X rebrand, but still works for diagnosis. Alternative: post the URL to a test account and view the preview.
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) — clears LinkedIn's cache for a URL.

### Common OG failures

1. **Stale preview.** Social networks cache OG images for 24 h – 30 d. Use the debugger's "Scrape Again" / "Inspect" button after publishing.
2. **OG image URL returns 404.** Check `dist/og/courses/<course>/<chapter>.png` exists after build. If not, the OG route `src/pages/og/[...slug].png.ts` didn't pick up the new chapter — check the collection query.
3. **OG image URL returns 200 but wrong image.** The OG route is deterministic; if the wrong image appears, the slug-to-page map in the route built from a stale `getCollection` result. Force a clean build (`rm -rf dist && npm run build`).
4. **CLS / dimensions wrong.** OG images must be exactly 1200×630. The route emits this width/height automatically; if a social network rejects the image, confirm the `og:image:width` + `og:image:height` meta tags are both set (the meta factory in `src/lib/seo/meta.ts` does this).
5. **Cache TTL too long.** `/og/*` responds with `Cache-Control: public, max-age=2592000` (30 d) — if a chapter title changes and the old OG is served for a month, that's the trade-off. If painful, switch to hashed filenames (tracked in seo.md open questions).

## Feed subscriber management

Phase 1 does not have a formal feed subscriber list (no email, no Substack). Track growth indirectly:

- Cloudflare Analytics → **Most requested paths**, filter `/rss.xml` / `/atom.xml` / `/feed.json`. Request count ≈ subscriber count.
- Note the figure at each release; trend line over time is the signal.

Each feed endpoint emits the current latest 20 chapters sorted by `updated` desc. If a subscriber misses an update, confirm the feed endpoint is reachable (`curl -I https://gyandev.org/rss.xml`) and the `Content-Type` is correct.

Phase 2 may add a per-course feed (`/courses/<course>/rss.xml`) for power readers.

## Resources

- [Google Search Central](https://developers.google.com/search/docs) — the normative reference.
- [Schema.org](https://schema.org/) — the vocabulary used in JSON-LD.
- [Rich Results Test](https://search.google.com/test/rich-results).
- [Schema.org Validator](https://validator.schema.org/).
- [Search Console help](https://support.google.com/webmasters/).
- [Bing Webmaster Tools help](https://www.bing.com/webmasters/help).
- [Open Graph protocol](https://ogp.me/).
- [JSON Feed spec](https://jsonfeed.org/).

## Things this doc does NOT cover

- **Paid acquisition / SEM.** Out of scope for Phase 1.
- **Backlink outreach.** Handled case-by-case outside the repo.
- **Keyword research workflow.** Author discretion; no formal tool.
- **Per-author / per-language expansion.** Single author + English only at launch; see `shared/seo.md` open questions for multi-author plans.
