---
title: GyanDev — Infrastructure Plan
status: draft (research-informed updates appended; full body TBD in later session)
created: 2026-04-20
updated: 2026-04-20
owner: sonushahuji4
---

# Infrastructure Plan

The full infrastructure implementation plan (directory structure, environment setup, CI/CD, deploy pipeline) will be written in a later session. This file currently holds only the research-informed decisions that constrain subsequent planning work. Read `.claude/plans/RESEARCH.md` for the detailed source material behind each decision.

## Research-Informed Updates

These decisions were locked during Session 1 (research) and must be honored by every subsequent plan and implementation PR.

### 1. Astro build configuration

Add the following to `astro.config.mjs` (do NOT remove anything already present; append/merge only):

```js
export default defineConfig({
  site: 'https://gyandev.org',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  // ...existing vite / markdown / integrations blocks
});
```

- `trailingSlash: 'never'` matches `specs/shared/routing-and-urls.md` Rule 3.
- `build.format: 'file'` produces flat `.html` files so Cloudflare Pages serves `/about` directly without a forced 308 from `/about/`. This was the missing half of "no trailing slashes" — the config-only toggle is insufficient without flat file output. See RESEARCH.md Topic 12.

### 2. Tailwind integration — do NOT install `@astrojs/tailwind`

The project already uses `@tailwindcss/vite`, which is the correct v4 integration path. `@astrojs/tailwind` is the legacy v3 integration and must not be added. A dedicated `tailwind.config.js` is also not used in v4 — design tokens live in CSS via `@theme` and `@custom-variant`. See RESEARCH.md Topic 5.

### 3. Dark mode: dual-sink theme toggle

A single inline `<script is:inline>` in the root layout `<head>` must set **both** signals on `<html>` before paint:

- `classList.toggle('dark', isDark)` — drives Tailwind utilities and Shiki's CSS-variable swap (`html.dark .shiki`).
- `setAttribute('data-theme', isDark ? 'dark' : 'light')` — drives `astro-mermaid` `autoTheme`, which watches `data-theme`.

One user action → both sinks updated → no FOUC and no mismatched Mermaid palette. See RESEARCH.md Topics 4, 5, 8, 9.

### 4. Content collections — two collections with references

`src/content.config.ts` defines two collections, both using the `glob` loader with `base: './src/content/courses'`:

- `courses` — pattern `**/course.mdx`. Schema: `title`, `description`, `order`, `chapterOrder: string[]`, `season`, `updated`.
- `chapters` — pattern `**/!(course).mdx` (or a more specific pattern matching `*/index.mdx`). Schema includes `course: reference('courses')`.

Revision and Flow content live as sibling MDX files in each chapter folder. The exact loader shape (extra fields via custom loader vs a third `chapterViews` collection) is an open question in RESEARCH.md but does not block the rest of the plan.

### 5. Dynamic routing — single shared `getChapterPaths()` utility

Create `src/lib/paths.ts` exporting an async `getChapterPaths()` helper. All three chapter route files — `src/pages/courses/[course]/[chapter]/index.astro`, `.../revision.astro`, and `.../flow.astro` — export `export const getStaticPaths = () => getChapterPaths();`. Single source of truth for the chapter params map. See RESEARCH.md Topic 2.

### 6. Chapter views — separate routes, not a single-route tab switcher

Full Notes, Quick Revision, and Flow Diagram are three separate Astro routes animated by `<ClientRouter />`. This isolates Mermaid's ~1.5 MB runtime to the Flow route only and gives deep links, middle-click open, real `<a>` keyboard navigation, and per-URL scroll restoration for free. Wrap the chapter shell in `transition:persist="chapter-shell"`. Persist per-URL `scrollY` in `sessionStorage` and restore on `astro:page-load` to work around documented scroll-restoration bugs in `<ClientRouter />`. See RESEARCH.md Topics 4, 8, 14.

### 7. Hydration strategy — island-minimal

Default to zero JS / inline `<script>` for simple DOM toggling. Use `client:*` only for genuinely stateful UI:

| Surface | Strategy |
|---|---|
| Theme toggle | Inline pre-paint script + tiny vanilla click handler (no island) |
| Bookmark button | Vanilla `<script>` reading `localStorage` (no island) |
| Mobile nav drawer | `client:media="(max-width: 768px)"` |
| Mermaid (Flow only) | `client:visible` (or `client:only` if SSR fails) |
| Giscus comments | Lazy-mount via IntersectionObserver; `client:visible` on wrapper |
| Search modal | `client:idle`; dynamic-import Pagefind runtime on first open |

See RESEARCH.md Topic 4.

### 8. Build-time asset generation

All of the following run at build time, not at request time — no Cloudflare Workers needed for Phase 1:

- **OG images**: `astro-og-canvas` with `OGImageRoute`. Emits `/og/<course>/<chapter>.png`. Caches across incremental builds. See Topic 10.
- **Sitemap**: `@astrojs/sitemap` with `filter` (drops `/revision`, `/flow`, `/404`, `/search`) and `serialize` (sets `lastmod` from chapter frontmatter, `priority`/`changefreq` per URL pattern). See Topic 11.
- **Pagefind index**: `astro-pagefind` (shishkin) hooks `astro:build:done`. Index only Full Notes: wrap Full Notes body in `<article data-pagefind-body data-pagefind-filter="course">`; mark Revision/Flow bodies without `data-pagefind-body`. See Topic 6.

### 9. Cloudflare Pages configuration

- `public/_redirects` — 301 slug-rename rules only; hard-cap 2000 static + 100 dynamic.
- `public/_headers` —
  - `/*` — security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS, CSP via HTTP header).
  - `/_astro/*`, `/fonts/*` — `Cache-Control: public, max-age=31536000, immutable`.
- **www → apex** — not in `_redirects`; configured via Cloudflare Redirect Rules at the zone level (dashboard ops task).
- **CSP** — header only, never meta tag. Must allow `frame-src https://giscus.app` and `connect-src https://giscus.app` once Giscus is wired.

See RESEARCH.md Topic 12.

### 10. localStorage — single typed utility with versioned envelope

Implement `src/lib/storage.ts` with:

- Envelope `{ v: number, data: T }` per key; keys namespaced `gyandev:*`.
- Version check + sequential migration on read; JSON-parse errors reset to defaults.
- In-memory `Map` fallback when `localStorage` is unavailable (Safari private mode, quota exceeded).
- Debounced writes for high-frequency slots (scroll-progress ~250–500 ms).
- `storage`-event subscribe for cross-tab sync.
- Flush pending writes on `pagehide` / `visibilitychange === 'hidden'`.
- One key per course for progress data (do not shard per-chapter).
- `CURRENT_VERSION = 1` at launch; keep a migration-table stub for v2.

See RESEARCH.md Topic 13.

### 11. Giscus — one thread per chapter, view-independent

`<Comments />` Astro component:

- Config: `data-mapping="specific"`, `data-term={chapter.slug}`, `data-strict="1"`, `data-loading="lazy"`.
- IntersectionObserver lazy-injects the Giscus `<script>` on near-intersection.
- MutationObserver on `<html>` theme attribute posts `{ giscus: { setConfig: { theme } } }` to the iframe.
- Do NOT install `@giscus/react`.

See RESEARCH.md Topic 7.

### 12. MDX authoring — components via `<Content components={{...}} />`

Create a `ChapterRenderer.astro` wrapper that passes a shared component map (`Callout`, `Figure`, `Mermaid`, `KaTeX`, and `pre → CodeBlock`) to `<Content />`. Authors do not need to import common components per file. They may still import one-off components. See RESEARCH.md Topic 3.

---

## What this file does NOT yet cover

Sessions 2+ will plan:

- Directory structure (`src/components/`, `src/lib/`, `src/styles/`, `src/content/`)
- Environment variables and `.env` shape
- CI (GitHub Actions for validate, build, Lighthouse, slug-lint, link-check)
- CD (Cloudflare Pages Git integration settings)
- Preview deploy pipeline
- Deploy smoke tests
- Backup / rollback strategy
- Monitoring (Cloudflare Analytics, Search Console verification)
- Content authoring tools and scripts

Until those sections exist, use the decisions above as the only binding infrastructure commitments.
