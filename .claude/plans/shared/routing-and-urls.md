---
title: Routing and URLs — Implementation Plan
status: draft
spec: .claude/specs/shared/routing-and-urls.md
created: 2026-04-20
session: 2
estimated_effort: 6–8 hours
dependencies:
  - .claude/plans/00-infrastructure.md
  - .claude/plans/RESEARCH.md (Topics 1, 2, 12)
---

# Implementation Plan: Routing and URLs

## 1. Overview

This plan translates the URL spec into concrete Astro routing, Cloudflare Pages configuration, and validation tooling. It covers the file-based `src/pages/` tree, a shared `getChapterPaths()` utility that powers the three chapter-view routes from one source of truth, canonical URL emission via the site layout, a `public/_redirects` file for slug renames, a `public/_headers` file for security and cache, a `scripts/validate-slugs.mjs` CI gate, and `<ClientRouter />` wiring so tab switches between Full Notes / Revision / Flow feel instant. Output: every URL resolves to a single canonical form, no trailing slashes, no case variants, and 301 redirects preserve every backlink across slug renames.

## 2. Spec Reference

See `.claude/specs/shared/routing-and-urls.md`. Load-bearing requirements this plan fulfills:

- Rule 1–7: lowercase, hyphens, no trailing slashes, no file extensions, no chapter numbers, no season segments, no content query strings.
- §3 URL patterns by page type (fixed for Phase 1).
- §4 Canonical URL rules — Full Notes is canonical; Revision/Flow declare canonical → Full Notes + `<meta name="robots" content="noindex, follow">`.
- §5 Redirects — domain canonicalization, slug renames, trailing-slash, case correction.
- §6 Astro routing implementation — exact file tree and `trailingSlash: 'never'` config.
- §7 Validation at build and in CI.
- §9 Reserved-path list.

## 3. Technical Approach

Four pillars.

**3.1 Static-first routing.** Every route is pre-rendered at build. No SSR. `src/pages/` tree mirrors §6 of the spec exactly. Dynamic segments `[course]` and `[chapter]` generate one page per entry via `getStaticPaths()` backed by content collections (see RESEARCH.md Topic 1 for the two-collection model).

**3.2 Single `getChapterPaths()` utility.** Per RESEARCH.md Topic 2, Astro provides no built-in way to share `getStaticPaths()` across route files. The three chapter route files (`index.astro`, `revision.astro`, `flow.astro`) each call `getChapterPaths()` so the chapter-params map has one source of truth. Changing the collection shape ripples through one file, not three.

**3.3 Cloudflare Pages URL hygiene.** `trailingSlash: 'never'` + `build.format: 'file'` in `astro.config.mjs` makes Astro emit flat `.html` files (`about.html`, `courses/nodejs/origin-story.html`), which Cloudflare Pages serves directly at no-slash URLs with no forced 308 redirect (RESEARCH.md Topic 12). This is the key change from a default Astro setup: without `build.format: 'file'`, Pages serves `/about/` with a 308 from `/about`, breaking Rule 3.

**3.4 Canonical URL emission in one layout.** The site's `BaseLayout.astro` accepts a `canonical` prop and a `noindex` boolean. Chapter Full Notes layout omits `noindex`; chapter Revision/Flow layouts pass `noindex: true` and pass the Full Notes URL as `canonical`. One place to change the logic if the strategy ever evolves.

**3.5 Redirect & header files as source of truth.** `public/_redirects` holds slug-rename 301s as static lines; it is human-authored and reviewed in PRs. `public/_headers` holds security + cache headers. Both are plain-text files that Cloudflare Pages picks up automatically — no dashboard configuration required for the code-owned parts. www→apex is handled outside this repo via a Cloudflare Redirect Rule at the zone level (see RESEARCH.md Topic 12).

**3.6 Validation gate.** `scripts/validate-slugs.mjs` runs in CI on every PR. Checks:
1. Every chapter + course slug matches `^[a-z][a-z0-9-]*[a-z0-9]$`.
2. No slug collides with the reserved-path list (spec §9).
3. No slug duplicates within a course.
4. `public/_redirects` parses and has no contradictory rules (same source, two destinations).
5. Internal MDX links resolve to real routes.

## 4. File Structure

```
astro.config.mjs                                   [modify]
scripts/
  validate-slugs.mjs                               [create]
public/
  _redirects                                        [create, empty at launch]
  _headers                                          [create]
src/
  content.config.ts                                 [create — see Session 3 for schema detail]
  lib/
    paths.ts                                        [create — getChapterPaths()]
    routes.ts                                       [create — chapterUrl(), courseUrl(), canonicalFor()]
  layouts/
    BaseLayout.astro                                [create — canonical + noindex props]
  pages/
    index.astro                                     [create → /]
    404.astro                                       [create → /404]
    about.astro                                     [create → /about]
    privacy.astro                                   [create → /privacy]
    terms.astro                                     [create → /terms]
    courses/
      index.astro                                   [create → /courses]
      [course]/
        index.astro                                 [create → /courses/[course]]
        [chapter]/
          index.astro                               [create → /courses/[course]/[chapter] — Full Notes]
          revision.astro                            [create → /courses/[course]/[chapter]/revision]
          flow.astro                                [create → /courses/[course]/[chapter]/flow]
```

Reserved (created in other plans, referenced here):

```
src/pages/sitemap-index.xml                         [provided by @astrojs/sitemap — see seo.md]
src/pages/rss.xml.ts                                [see seo.md]
src/pages/atom.xml.ts                               [see seo.md]
src/pages/feed.json.ts                              [see seo.md]
public/robots.txt                                   [see seo.md]
```

## 5. Dependencies

**External (already installed):**
- `astro@^6.1.8`
- `@astrojs/mdx@^5.0.3`
- `@astrojs/sitemap@^3.7.2`

**External (to add):** none for this plan. (Sitemap/feeds covered by the seo plan.)

**Internal modules:**
- `src/lib/paths.ts` — consumed by three chapter route files.
- `src/lib/routes.ts` — consumed by every layout that needs to construct URLs (home, course overview, chapter nav, breadcrumbs).
- `src/layouts/BaseLayout.astro` — consumed by every page.

**Plan dependencies:**
- `.claude/plans/00-infrastructure.md` (Astro config keys locked in Session 1).
- `.claude/plans/shared/seo.md` — canonical + robots + sitemap logic flows through `BaseLayout.astro`; this plan defines the props, SEO plan defines the content.
- `.claude/plans/shared/accessibility.md` — `<ClientRouter />` wiring must coordinate with focus-restoration logic.

## 6. Implementation Steps (Ordered)

1. **Modify `astro.config.mjs`** — add `trailingSlash: 'never'` and `build: { format: 'file' }` to the existing `defineConfig({...})` call. Leave existing integrations untouched.
   - Done when: `npm run build` produces `dist/about.html` (not `dist/about/index.html`) and `dist/courses/nodejs/origin-story.html`.

2. **Create `src/content.config.ts`** with a stub shape — full schemas land in Session 3. For this plan, we just need `courses` and `chapters` collections so `getCollection()` compiles:
   ```ts
   import { defineCollection, z, reference } from 'astro:content';
   import { glob } from 'astro/loaders';
   export const collections = {
     courses: defineCollection({
       loader: glob({ pattern: '**/course.mdx', base: './src/content/courses' }),
       schema: z.object({ title: z.string(), description: z.string(), order: z.number() }),
     }),
     chapters: defineCollection({
       loader: glob({ pattern: '**/index.mdx', base: './src/content/courses' }),
       schema: z.object({
         title: z.string(),
         description: z.string(),
         course: reference('courses'),
         order: z.number(),
         updated: z.date().optional(),
       }),
     }),
   };
   ```
   - Done when: `astro check` passes with the content directory empty (no entries required to compile).

3. **Create `src/lib/paths.ts`** exporting `getChapterPaths()`:
   ```ts
   import type { InferGetStaticParamsType, InferGetStaticPropsType } from 'astro';
   import { getCollection } from 'astro:content';
   export async function getChapterPaths() {
     const chapters = await getCollection('chapters');
     return chapters.map((chapter) => {
       const [course, ...rest] = chapter.id.split('/');
       return {
         params: { course, chapter: rest.slice(0, -1).join('/') }, // drop trailing 'index'
         props: { chapter },
       };
     });
   }
   ```
   - Done when: unit test (or a temp script) with a fixture confirms one path object per chapter entry.

4. **Create `src/lib/routes.ts`** with URL constructors:
   ```ts
   export const SITE = 'https://gyandev.org';
   export const courseUrl = (course: string) => `/courses/${course}`;
   export const chapterUrl = (course: string, chapter: string) => `/courses/${course}/${chapter}`;
   export const chapterRevisionUrl = (c: string, ch: string) => `${chapterUrl(c, ch)}/revision`;
   export const chapterFlowUrl = (c: string, ch: string) => `${chapterUrl(c, ch)}/flow`;
   export const canonicalFor = (path: string) => new URL(path, SITE).toString();
   ```
   - All callers import these — NEVER hand-concatenate URLs anywhere else in the codebase.
   - Done when: `grep -rn "'/courses/'" src/` returns nothing.

5. **Create `src/layouts/BaseLayout.astro`** with props:
   - `title: string` (page `<title>`, required).
   - `description: string` (meta description, required).
   - `canonical: string` (absolute URL, required).
   - `noindex?: boolean` (default `false`).
   - `robotsExtra?: string[]` (merged with baseline, e.g., `['max-image-preview:large']`).
   - Plus props that will be defined in the SEO plan (`ogImage`, `jsonLd`).
   - Slot: `<slot />` inside `<main id="main">`.
   - Renders `<link rel="canonical" href={canonical}>` and `<meta name="robots" content="...">`. The exact meta tag factory lives in the SEO plan (`src/lib/seo/meta.ts`); this layout only consumes it.
   - Done when: a page using the layout emits exactly one `<link rel="canonical">` and one `<meta name="robots">`.

6. **Create the five static pages** (`index.astro`, `404.astro`, `about.astro`, `privacy.astro`, `terms.astro`) as minimal stubs that extend `BaseLayout.astro` with the correct `canonical` and `noindex` values. Full body content lands in Session 3 (page plans). Canonical conventions:
   - `/` → `canonicalFor('/')`, `noindex: false`.
   - `/404` → `canonicalFor('/404')`, `noindex: true`.
   - `/about`, `/privacy`, `/terms` → matching canonicals, `noindex: false`.

7. **Create `src/pages/courses/index.astro`** — the All Courses listing. Stub; Session 3 fills body. Canonical `canonicalFor('/courses')`.

8. **Create `src/pages/courses/[course]/index.astro`** — Course Overview. `getStaticPaths()` returns one entry per course:
   ```ts
   export async function getStaticPaths() {
     const courses = await getCollection('courses');
     return courses.map((course) => ({
       params: { course: course.id.split('/')[0] },
       props: { course },
     }));
   }
   ```
   - Canonical: `canonicalFor(courseUrl(course.id))`.

9. **Create the three chapter route files** — `[chapter]/index.astro`, `[chapter]/revision.astro`, `[chapter]/flow.astro`. All three:
   ```ts
   export { getChapterPaths as getStaticPaths } from '../../../../lib/paths';
   ```
   (or `export const getStaticPaths = () => getChapterPaths();` — pick one pattern and use everywhere.) Each sets `canonical` to the Full Notes URL via `chapterUrl()`. Revision and Flow pass `noindex: true` to `BaseLayout`. Body fill is Session 3.

10. **Wire `<ClientRouter />`** — import from `astro:transitions` into `BaseLayout.astro`'s `<head>`. Add `transition:persist="chapter-shell"` to the chapter shell wrapper (header + tab bar + title region). See `.claude/plans/shared/performance.md` step for scroll-restoration sessionStorage handler, and `.claude/plans/shared/accessibility.md` for focus restoration.
    - Done when: clicking Full → Revision → Flow inside a chapter performs a client-side transition (network panel shows HTML-only fetch) and the shell does not flicker.

11. **Create `public/_headers`** — baseline security + cache rules. The concrete header set is defined in the `.claude/plans/shared/seo.md` and `.claude/plans/shared/performance.md` plans; this plan reserves the file. Initial stub:
    ```
    /*
      X-Frame-Options: DENY
      X-Content-Type-Options: nosniff
      Referrer-Policy: strict-origin-when-cross-origin
      Permissions-Policy: geolocation=(), microphone=(), camera=()
      Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
    /_astro/*
      Cache-Control: public, max-age=31536000, immutable
    /fonts/*
      Cache-Control: public, max-age=31536000, immutable
    ```

12. **Create `public/_redirects`** — empty file with a header comment. One 301 line per slug rename will be added in PRs as content evolves. Initial content:
    ```
    # GyanDev slug rename redirects. One rule per line.
    # Format: <source> <destination> <status>
    # See: https://developers.cloudflare.com/pages/configuration/redirects/
    # Example:
    #   /courses/nodejs/old-slug  /courses/nodejs/new-slug  301
    ```

13. **Create `scripts/validate-slugs.mjs`** — Node ESM script, runnable as `node scripts/validate-slugs.mjs`:
    - Iterates `src/content/courses/` directory tree.
    - For each directory, asserts directory name matches `^[a-z][a-z0-9-]*[a-z0-9]$`.
    - Maintains `RESERVED` set from spec §9; fails on any match.
    - Detects duplicate chapter slugs within a course.
    - Parses `public/_redirects` — asserts each non-comment line has three tokens, source is unique, status ∈ {301, 302, 308}.
    - Parses every `*.mdx` file in content tree, extracts internal links (`[text](/path)`), resolves against known route set, fails on broken link.
    - Exits 0 on success, 1 on failure with human-readable errors.
    - Done when: intentionally adding a bad slug (`Foo_Bar`) causes script to exit 1 with "Invalid slug format: Foo_Bar".

14. **Add `validate:slugs` script to `package.json`:** `"validate:slugs": "node scripts/validate-slugs.mjs"`. Extend the existing `check` script: `"check": "npm run validate && npm run validate:slugs && npm run build"`.

15. **Wire `validate:slugs` into CI** — see `.claude/plans/shared/accessibility.md` for the full GitHub Actions workflow file; this plan contributes the `npm run validate:slugs` step.

## 7. Component/Module API Design

### `src/lib/paths.ts`

```ts
export async function getChapterPaths(): Promise<Array<{
  params: { course: string; chapter: string };
  props: { chapter: CollectionEntry<'chapters'> };
}>>;
```

### `src/lib/routes.ts`

```ts
export const SITE: string;                                         // 'https://gyandev.org'
export function courseUrl(course: string): string;                 // /courses/{course}
export function chapterUrl(course: string, chapter: string): string;
export function chapterRevisionUrl(course: string, chapter: string): string;
export function chapterFlowUrl(course: string, chapter: string): string;
export function canonicalFor(path: string): string;                // absolute URL
export function isReservedSlug(slug: string): boolean;
export const RESERVED_SLUGS: ReadonlySet<string>;
```

### `src/layouts/BaseLayout.astro`

Props interface:
```ts
export interface Props {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
  robotsExtra?: string[];
  ogImage?: string;          // absolute URL; see seo.md
  jsonLd?: object | object[]; // see seo.md
}
```

Responsibilities (routing-specific):
- Emit `<link rel="canonical" href={canonical}>`.
- Emit `<meta name="robots" content={robotsString}>` where robotsString merges:
  - `noindex ? 'noindex, follow' : 'index, follow'`
  - joined with `robotsExtra` (comma-separated).
- Emit `<ClientRouter />` in `<head>`.

Responsibilities (delegated to seo.md plan):
- Title, description, OG/Twitter tags, JSON-LD.

### `scripts/validate-slugs.mjs`

Exit codes: `0` success, `1` any failure. No flags in Phase 1.

## 8. Code Patterns

**Pattern: Canonical URL construction.** Never hand-build. Always go through `canonicalFor()`:
```astro
---
import { canonicalFor, chapterUrl } from '../../lib/routes';
const canonical = canonicalFor(chapterUrl(course.id, chapter.slug));
---
<BaseLayout canonical={canonical} noindex={false} ...>
```

**Pattern: Chapter route getStaticPaths.** Every chapter route file uses the same export:
```astro
---
export { getChapterPaths as getStaticPaths } from '../../../../lib/paths';
const { chapter } = Astro.props;
const { course, chapter: chapterSlug } = Astro.params;
---
```

**Pattern: Revision/Flow canonical points to Full Notes.**
```astro
---
// In revision.astro and flow.astro
import { canonicalFor, chapterUrl } from '../../../../lib/routes';
const { chapter } = Astro.props;
const canonical = canonicalFor(chapterUrl(Astro.params.course, Astro.params.chapter));
---
<BaseLayout canonical={canonical} noindex={true} ...>
```

**Pattern: `_redirects` entry for a slug rename.** One line, append chronologically:
```
/courses/nodejs/intro  /courses/nodejs/origin-story  301
```
Add a comment above when the reason is non-obvious.

## 9. Testing Strategy

**Unit-ish tests (lightweight — no Vitest required in Phase 1):**
- `scripts/validate-slugs.mjs` self-test: run against a temp directory with known-good + known-bad fixtures, assert exit code.

**Build tests:**
- `npm run build` must succeed with zero chapters, one chapter, many chapters.
- Inspect `dist/` after build — assert flat `.html` files at expected paths.

**Manual verification:**
- Load `http://localhost:4321/` in dev — verify canonical `<link>` matches current URL.
- Load `/courses/nodejs/origin-story/revision` — verify `<link rel="canonical" href=".../origin-story">` and `<meta name="robots" content="noindex, follow">`.
- Click Full → Revision → Flow — verify no full page reload (DevTools Network tab shows `document` fetch only, not CSS/JS re-request).
- Type `/COURSES/NODEJS` in address bar — verify 301 to lowercase (Cloudflare does this at edge; test on deployed preview, not local).
- Type `/courses/nodejs/` — verify 301 to `/courses/nodejs` on deployed preview.

**CI checks:**
- `npm run validate:slugs` must pass (blocks merge).
- Build must succeed.
- Broken-link check (inside `validate-slugs.mjs`) must pass.

## 10. Rollout Plan

Within this plan, implement strictly in this order — each step unblocks the next:

1. Config changes (Step 1).
2. Content collection stubs + `lib/paths.ts` + `lib/routes.ts` (Steps 2–4).
3. `BaseLayout.astro` with canonical/robots props (Step 5) — seo.md plan fills the rest later.
4. Static page stubs (Step 6) + All Courses + Course Overview (Steps 7–8).
5. Three chapter route files wired to shared paths (Step 9).
6. `<ClientRouter />` in layout (Step 10).
7. Redirect/header files (Steps 11–12).
8. Validation script + CI wiring (Steps 13–15).

## 11. Risks and Mitigations

- **Risk: `build.format: 'file'` produces unexpected `dist/` layout that breaks downstream tooling (Pagefind, sitemap).**
  - Likelihood: low
  - Impact: medium
  - Mitigation: run a real build early (Step 1), inspect `dist/` tree, verify Pagefind still indexes flat HTML (Pagefind scans any `.html` it finds — should just work).

- **Risk: `<ClientRouter />` causes focus/scroll regressions that fail a11y audit.**
  - Likelihood: medium
  - Impact: high
  - Mitigation: wire manual focus + scroll restoration per `.claude/plans/shared/accessibility.md` and `.claude/plans/shared/performance.md` before the three-tab route goes live. If issues persist, fall back to standard multi-page navigation (remove `<ClientRouter />`).

- **Risk: `_redirects` accumulates cruft and hits the 2000-static-rule limit years from now.**
  - Likelihood: low (at current content cadence)
  - Impact: low
  - Mitigation: the validate script warns at 1800 rules; at that point we move old redirects to Cloudflare Bulk Redirects.

- **Risk: Someone adds a slug that conflicts with a future top-level route (`/tracks`, `/review`).**
  - Likelihood: medium
  - Impact: high (URL collision)
  - Mitigation: `validate-slugs.mjs` checks against the full reserved-path list from spec §9 including Phase 2 paths — so we reserve those names now.

- **Risk: MDX internal-link validation is too strict and flags valid dynamic links.**
  - Likelihood: medium
  - Impact: low (CI annoyance)
  - Mitigation: the validator accepts a `LINK_IGNORE` array in its header for exceptions; document in script.

## 12. Done When

- [ ] `astro.config.mjs` has `trailingSlash: 'never'` and `build.format: 'file'`.
- [ ] `src/content.config.ts` defines `courses` and `chapters` collections (stub schemas OK for this plan; Session 3 may enrich).
- [ ] `src/lib/paths.ts` exports `getChapterPaths()`.
- [ ] `src/lib/routes.ts` exports `SITE`, `courseUrl`, `chapterUrl`, `chapterRevisionUrl`, `chapterFlowUrl`, `canonicalFor`, `RESERVED_SLUGS`, `isReservedSlug`.
- [ ] `src/layouts/BaseLayout.astro` emits exactly one `<link rel="canonical">` and one `<meta name="robots">` per page and includes `<ClientRouter />`.
- [ ] All 11 Phase-1 route files exist as stubs that successfully build.
- [ ] Chapter Revision and Flow routes emit `<meta name="robots" content="noindex, follow">` and a canonical `<link>` pointing to Full Notes.
- [ ] `public/_redirects` and `public/_headers` exist.
- [ ] `scripts/validate-slugs.mjs` exists and passes on the current content tree.
- [ ] `npm run check` runs validate-slugs before build.
- [ ] Clicking between chapter tabs performs a client-side transition (no full page reload).

## 13. Open Questions

- [ ] **Rest-param vs two-param for chapter routes.** Current plan uses `[course]/[chapter]` with `chapter` as a single segment. If we ever introduce chapter-within-section URLs (unlikely per spec §2 Rule 6 banning season segments), rest params `[...chapter]` would be required. Decide to commit to two-param; ratify before shipping.
- [ ] **Broken-link validation scope.** Should `validate-slugs.mjs` also check external links (HEAD requests)? Punted to Phase 2 — too slow for PR CI and external links rot beyond our control.
- [ ] **Case correction at Cloudflare edge.** Spec §5 claims Cloudflare Pages normalizes uppercase to lowercase automatically. Verified in RESEARCH.md Topic 12 that trailing slash handling is build-driven; case handling needs a confirmation test on deployed preview. Flag for QA checklist.
- [ ] **Pages format conflict with sitemap asset paths.** Needs a smoke test: does `@astrojs/sitemap` still produce correct URLs when `build.format: 'file'`? Expected yes (sitemap URLs are logical, not file-path-derived); verify in Step 1 of rollout.

## 14. References

- Spec: `.claude/specs/shared/routing-and-urls.md`
- Research: `.claude/plans/RESEARCH.md` Topics 1 (content collections), 2 (getStaticPaths), 12 (Cloudflare Pages config)
- Related plans:
  - `.claude/plans/00-infrastructure.md` §§1, 5, 9 (build config, shared paths utility, CF config)
  - `.claude/plans/shared/seo.md` (meta tag factory consumed by `BaseLayout.astro`)
  - `.claude/plans/shared/accessibility.md` (focus restoration on ClientRouter navigations)
  - `.claude/plans/shared/performance.md` (scroll-restoration handler; `_headers` cache rules)
- External:
  - [Astro — Routing Reference](https://docs.astro.build/en/reference/routing-reference/)
  - [Astro — View transitions](https://docs.astro.build/en/guides/view-transitions/)
  - [Cloudflare Pages — Redirects](https://developers.cloudflare.com/pages/configuration/redirects/)
  - [Cloudflare Pages — Headers](https://developers.cloudflare.com/pages/configuration/headers/)
