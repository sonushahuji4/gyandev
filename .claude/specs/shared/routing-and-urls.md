Replace the contents of .claude/specs/shared/routing-and-urls.md with this exact content:

---
title: GyanDev — Routing and URL Conventions
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
applies_to: all pages
---

# Routing and URL Conventions

This spec defines how URLs are structured, how pages route to content, and how canonical URLs are declared. Every page on GyanDev must follow these rules.

## 1. URL Anatomy

```
https://gyandev.org/courses/nodejs/origin-story/revision
│       │          │       │      │            │
│       │          │       │      │            └── sub-view (optional)
│       │          │       │      └─────────────── chapter slug
│       │          │       └────────────────────── course slug
│       │          └────────────────────────────── section
│       └───────────────────────────────────────── domain
└───────────────────────────────────────────────── protocol (always HTTPS)
```

## 2. Core Rules

### Rule 1: Lowercase always
- ✅ `/courses/nodejs` 
- ❌ `/Courses/NodeJS`
- ❌ `/Courses/nodejs`

**Why**: Case-sensitivity varies across servers. Forcing lowercase prevents duplicate content issues.

### Rule 2: Hyphens for multi-word slugs
- ✅ `/courses/nodejs/origin-story`
- ✅ `/courses/system-design/rate-limiting`
- ❌ `/courses/nodejs/origin_story` (underscore)
- ❌ `/courses/nodejs/originstory` (no separator)
- ❌ `/courses/nodejs/origin story` (space / %20)

**Why**: Hyphens are the SEO standard. Google treats hyphens as word separators.

### Rule 3: No trailing slashes
- ✅ `/courses/nodejs`
- ❌ `/courses/nodejs/`

**Why**: One canonical form prevents duplicate URLs. Configured at Cloudflare Pages level.

### Rule 4: No file extensions in public URLs
- ✅ `/about`
- ❌ `/about.html`
- ❌ `/about.astro`

**Why**: URLs should describe content, not implementation. Astro handles the mapping.

### Rule 5: No chapter numbers in URLs
- ✅ `/courses/nodejs/origin-story`
- ❌ `/courses/nodejs/01-origin-story`
- ❌ `/courses/nodejs/chapter-1`

**Why**: Order can change. Slugs must be stable forever. Order is a frontmatter field, not a URL segment.

### Rule 6: No season segments (flat URLs)
- ✅ `/courses/nodejs/origin-story`
- ❌ `/courses/nodejs/season-1/origin-story`

**Why**: Seasons may be restructured later. Keeping them out of URLs means SEO and backlinks survive reorganization. Season info lives in frontmatter metadata.

### Rule 7: No query strings for primary content
- ✅ `/courses/nodejs/origin-story`
- ❌ `/courses/nodejs?chapter=origin-story`

**Why**: Search engines treat `?` params as variations. Path-based URLs index cleanly.

Acceptable query-string use cases (non-content):
- Tracking (`?utm_source=...`) — filtered out by Cloudflare Analytics
- Search results page (`/search?q=...`) — not indexed
- Feature flags (`?debug=1`) — dev-only

## 3. URL Patterns by Page Type

### Home
```
/
```
Root only. No variations.

### All Courses
```
/courses
```
Lists every course.

### Course Overview
```
/courses/[course]
```
- `[course]` = course slug (e.g., `nodejs`, `javascript`, `system-design`)
- Example: `/courses/nodejs`

### Chapter — Three Views
```
/courses/[course]/[chapter]              ← Full Notes (canonical)
/courses/[course]/[chapter]/revision     ← Quick Revision
/courses/[course]/[chapter]/flow         ← Flow Diagram
```
- `[chapter]` = chapter slug (e.g., `origin-story`, `event-loop`)
- Example: `/courses/nodejs/origin-story`
- Example: `/courses/nodejs/origin-story/revision`
- Example: `/courses/nodejs/origin-story/flow`

### Legal & Info
```
/about
/privacy
/terms
```
Single-word slugs at root. No nesting.

### Error
```
/404
```
Fallback for any unmatched route.

### Future (Phase 2) — URL patterns locked
```
/tracks
/tracks/[track-slug]
/review
/bookmarks
/settings
/search?q=[query]
/contributing
/dmca
```

## 4. Canonical URLs

Every page declares a single canonical URL via `<link rel="canonical" href="...">`.

### Rule: Full Notes is the canonical for each chapter

A chapter has three URLs but only one canonical:

```html
<!-- On /courses/nodejs/origin-story -->
<link rel="canonical" href="https://gyandev.org/courses/nodejs/origin-story">

<!-- On /courses/nodejs/origin-story/revision -->
<link rel="canonical" href="https://gyandev.org/courses/nodejs/origin-story">

<!-- On /courses/nodejs/origin-story/flow -->
<link rel="canonical" href="https://gyandev.org/courses/nodejs/origin-story">
```

### Why this matters
- Prevents duplicate-content SEO penalties
- Consolidates backlink signals to Full Notes
- Search engines still index Revision + Flow but attribute ranking to Full Notes

### Additional meta on non-canonical views
Revision and Flow tabs also declare:
```html
<meta name="robots" content="noindex, follow">
```
This tells crawlers: *don't include these in search results, but do follow links from them.*

## 5. Redirects

### Domain canonicalization
| From | To | Type |
|---|---|---|
| `www.gyandev.org/*` | `gyandev.org/*` | 301 |
| `http://gyandev.org/*` | `https://gyandev.org/*` | 301 |
| `http://www.gyandev.org/*` | `https://gyandev.org/*` | 301 |

Configured at Cloudflare DNS + Page Rules level.

### Slug changes
When a chapter or course slug is renamed, a 301 redirect is added:
```
/courses/nodejs/old-slug  →  /courses/nodejs/new-slug  (301)
```

Maintained in `public/_redirects` (Cloudflare Pages format):
```
/courses/nodejs/old-slug  /courses/nodejs/new-slug  301
```

### Trailing slash handling
Cloudflare Pages auto-redirects trailing slash URLs:
```
/courses/nodejs/  →  /courses/nodejs  (301)
```

### Case correction
Cloudflare Pages normalizes uppercase to lowercase:
```
/Courses/NodeJS  →  /courses/nodejs  (301)
```

## 6. Astro Routing Implementation

### File-based routes
Astro maps `src/pages/` structure to URLs:

```
src/pages/
├── index.astro                              → /
├── courses/
│   ├── index.astro                          → /courses
│   └── [course]/
│       ├── index.astro                      → /courses/[course]
│       └── [chapter]/
│           ├── index.astro                  → /courses/[course]/[chapter]
│           ├── revision.astro               → /courses/[course]/[chapter]/revision
│           └── flow.astro                   → /courses/[course]/[chapter]/flow
├── about.astro                              → /about
├── privacy.astro                            → /privacy
├── terms.astro                              → /terms
└── 404.astro                                → /404
```

### Dynamic params
- `[course]` and `[chapter]` are dynamic segments
- `getStaticPaths()` generates one page per content collection entry at build time
- No runtime routing — all URLs resolved before deploy

### Trailing slash config
In `astro.config.mjs`:
```js
export default defineConfig({
  trailingSlash: 'never',
  build: {
    format: 'directory'  // or 'file' — decide in plans/
  }
});
```

## 7. URL Validation

### At build time
- Every chapter's slug is validated against Zod schema
- Duplicate slugs within a course = build failure
- Invalid characters (uppercase, spaces, special chars) = build failure

### At runtime (PR checks)
GitHub Action runs on every PR:
```yaml
- name: Validate URL conventions
  run: |
    node scripts/validate-slugs.mjs
```

Script checks:
- All slugs match `^[a-z][a-z0-9-]*[a-z0-9]$` regex
- No slug conflicts with reserved paths (`about`, `courses`, etc.)
- No broken internal links in MDX

## 8. Internationalization (Future)

**Phase 1**: English only, no locale prefix.
```
/courses/nodejs/origin-story
```

**Phase 3+ (planned structure)**: Locale as first segment.
```
/en/courses/nodejs/origin-story
/hi/courses/nodejs/origin-story
/es/courses/nodejs/origin-story
```

URL structure designed to be **forward-compatible**. Migration path:
1. Current URLs become `/en/*` variants
2. 301 redirects from old `/courses/*` to `/en/courses/*`
3. `hreflang` tags added for all locales

Do NOT add `/en/` prefix in Phase 1 — it's reserved for when i18n ships.

## 9. Reserved Paths

These paths are reserved and cannot be used as course or chapter slugs:

```
about       courses       tracks
privacy     review        bookmarks
terms       settings      search
404         contributing  dmca
api         admin         sitemap.xml
robots.txt  rss.xml       atom.xml
feed.json   _redirects    _headers
en          hi            es          (reserved for i18n)
```

Validation script blocks any content slug matching the reserved list.

## 10. URL Examples (Reference)

### Valid URLs
```
/
/courses
/courses/nodejs
/courses/nodejs/origin-story
/courses/nodejs/origin-story/revision
/courses/nodejs/origin-story/flow
/courses/system-design/rate-limiting
/about
/privacy
```

### Invalid URLs (with reason)
```
/Courses/nodejs                    ❌ uppercase
/courses/nodejs/                   ❌ trailing slash
/courses/nodejs/origin_story       ❌ underscore
/courses/nodejs/01-origin-story    ❌ numeric prefix
/courses/nodejs/season-1/origin    ❌ season in URL
/about.html                        ❌ file extension
/courses?name=nodejs               ❌ query string for content
```

## 11. Success Criteria

This spec is complete when:
- [ ] All 10 Phase-1 pages follow the rules above
- [ ] Cloudflare Pages config enforces trailing-slash + case rules
- [ ] Astro config matches Section 6
- [ ] Validation script (Section 7) is in CI
- [ ] Canonical tags verified on every chapter page
- [ ] `_redirects` file exists (empty initially, populated as needed)

## 12. Open Questions

- [ ] Should we support short URLs (e.g., `/nodejs` → `/courses/nodejs`)? — deferred
- [ ] Should tags have URLs? (e.g., `/tags/async`) — Phase 2 decision
- [ ] Should author pages exist? (e.g., `/authors/sonushahuji4`) — Phase 2 decision

## 13. References

- Spec: [shared/website-overview.md](website-overview.md)
- Plan: [plans/shared/routing-and-urls.md](../../plans/shared/routing-and-urls.md) *(to be created)*
- Astro routing docs: https://docs.astro.build/en/guides/routing/
- Google URL structure guide: https://developers.google.com/search/docs/crawling-indexing/url-structure

After saving, do NOT commit. Do NOT create any other files. Just overwrite this file and confirm.