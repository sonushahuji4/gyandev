---
title: GyanDev — Research Findings
status: complete
created: 2026-04-20
session: 1
owner: sonushahuji4
---

# Research Findings for GyanDev Implementation

## Summary

This document captures the technical research that underpins the GyanDev implementation plan. Fourteen topics were investigated against Astro 6.1.8, Tailwind CSS 4.2.2, Shiki 4.0.2, rehype-pretty-code 0.14.3, astro-mermaid 2.0.1, Pagefind 1.5.2, and Cloudflare Pages hosting. Key outcomes: (1) a two-collection content model (`courses` + `chapters`) with `reference()` cross-linking, (2) a shared `getStaticPaths()` utility serving all three chapter-view route files, (3) a minimal-JS hydration strategy preferring inline scripts and vanilla DOM over framework islands, (4) separate routes per chapter view with Astro `<ClientRouter />` (rather than single-route JS tabs) to isolate Mermaid's ~1.5 MB bundle to the Flow view only, (5) Tailwind v4's CSS-variable-driven dark mode keyed on a `.dark` class plus a parallel `data-theme` attribute for astro-mermaid, (6) `astro-og-canvas` for build-time OG images, (7) `astro-pagefind` with the Component UI modal indexing only the Full Notes view, and (8) an HTTP-header CSP via `_headers` with no dashboard-level trailing-slash config needed once Astro emits flat `.html` files. Full details, source citations, and open questions follow.

---

## Research Topic 1: Astro 6 Content Collections

### Question
How do we model courses-with-chapters in Astro 6's Content Layer (Zod schemas, `getCollection`/`getEntry`, slug derivation), and should we use one collection, nested collections, or cross-referenced collections?

### Findings
- Astro 6 requires a `loader` on every collection. The legacy `src/content/<collection>/` directory-only mode is gone. Define collections in `src/content.config.ts` with `defineCollection({ loader, schema })`.
- Zod import path changed: `import { z } from 'astro/zod'` (not `astro:content` — deprecated in v6, powered by Zod 4).
- The built-in `glob` loader (`astro/loaders`) takes `{ pattern, base }` and supports Markdown/MDX/JSON/YAML/TOML.
- `getCollection(name, filter?)` returns all matching entries; `getEntry(name, id)` fetches one; `getEntries([...refs])` resolves arrays of references.
- `id` is derived from file path relative to `base`. For a glob loader pointing at `src/content/courses` with pattern `**/index.mdx`, a chapter at `javascript/01-event-loop/index.mdx` gets `id: 'javascript/01-event-loop'` — preserves nested path, allowing filter by course via `entry.id.startsWith('javascript/')`.
- The standalone `slug` field from Astro ≤4 is gone with the Content Layer; derive URL segments from `id` or an explicit frontmatter slug.
- `reference('collectionName')` in a Zod schema defines a typed cross-collection link; querying returns `{ collection, id }` objects resolved via `getEntry`/`getEntries`.

### Decision
Use **two collections** with `reference()` rather than nested collections:
- `courses` — one entry per course at `src/content/courses/<course>/course.mdx` (frontmatter: `title`, `description`, `order`, `chapterOrder: string[]`, `season`, `updated`).
- `chapters` — one entry per chapter at `src/content/courses/<course>/<chapter>/index.mdx` with `course: reference('courses')` in the schema.

Both collections share `base: './src/content/courses'` but use different glob patterns (`**/course.mdx` vs `**/[^course]*/index.mdx`). This yields: typed course↔chapter linking, a flat `chapters` query for sitemap/search, and stable URLs derived from the directory tree.

Revision and Flow content live as sibling MDX files in the same chapter folder (`revision.mdx`, `flow.mdx`). They are loaded via either a custom loader that attaches them as extra fields or — simpler — a third `chapterViews` collection keyed by `<course>/<chapter>/<view>`. Start with two collections; add a third only if the content shape diverges. See Open Questions below.

### Sources
- [Content collections guide (Astro docs)](https://docs.astro.build/en/guides/content-collections/)
- [Content Collections API Reference](https://docs.astro.build/en/reference/modules/astro-content/)
- [Content Loader API](https://docs.astro.build/en/reference/content-loader-reference/)
- [Upgrade to Astro v6](https://docs.astro.build/en/guides/upgrade-to/v6/)

---

## Research Topic 2: Astro `getStaticPaths()` for Nested Dynamic Routes

### Question
How do we generate `/courses/[course]/[chapter]`, `/courses/[course]/[chapter]/revision`, and `/courses/[course]/[chapter]/flow` at build time from a content collection, and how do we share "build all chapter paths" logic across the three route files?

### Findings
- `getStaticPaths()` must be exported from any file in `src/pages/` that uses `[param]` segments. It returns `[{ params, props }]`; params become URL segments; props become `Astro.props` and are not limited to strings.
- Calling `getCollection()` inside `getStaticPaths()` is the canonical pattern.
- For `src/pages/[course]/[chapter]/index.astro`, every returned params object must include both `course` and `chapter`. If the chapter id contains slashes you want in the URL, use a rest param `[...chapter]`.
- Astro provides no built-in way to auto-share `getStaticPaths` across route files — each route file must export its own. The idiomatic solution is a **shared utility** that returns the path array; each route file calls it.
- TypeScript helpers exposed: `InferGetStaticParamsType`, `InferGetStaticPropsType`, `GetStaticPaths`.

### Decision
Create `src/lib/paths.ts` exporting `getChapterPaths()`:

```ts
export async function getChapterPaths() {
  const chapters = await getCollection('chapters');
  return chapters.map((chapter) => {
    const [course, ...rest] = chapter.id.split('/');
    return { params: { course, chapter: rest.join('/') }, props: { chapter } };
  });
}
```

Then `[course]/[chapter]/index.astro`, `.../revision.astro`, and `.../flow.astro` each export `export const getStaticPaths = () => getChapterPaths();`. All three share one source of truth; each page pulls the appropriate view (Full/Revision/Flow) from its MDX field or sibling entry. Use `InferGetStaticPropsType<typeof getStaticPaths>` for typed `Astro.props`.

### Sources
- [Routing Reference (Astro docs)](https://docs.astro.build/en/reference/routing-reference/)
- [Routing guide](https://docs.astro.build/en/guides/routing/)
- [Content collections guide](https://docs.astro.build/en/guides/content-collections/)

---

## Research Topic 3: MDX in Astro 6

### Question
How do we use custom Astro components inside `.mdx` files (import vs `components` prop), access frontmatter, and apply layouts? Should we use `.md` or `.mdx`?

### Findings
- `@astrojs/mdx` treats MDX files like Astro components: frontmatter is supported; values are available in templates and as named exports when imported.
- Two ways to use custom components inside `.mdx`:
  1. **Import inside the MDX file** — natural in authored content.
  2. **`components` prop on `<Content />`** when rendering — maps tag names (`h1`, `pre`, `blockquote`, ...) or imported component names to custom implementations. Good for global overrides without touching every MDX file.
- Rendering a collection entry: `const { Content } = await render(entry); <Content components={{ Callout, pre: CodeBlock }} />`.
- `.md` supports frontmatter + Markdown only; `.mdx` adds JSX-style components, expressions, and ES imports/exports. `.mdx` is a strict superset for our case.
- MDX can declare a `layout` frontmatter key to auto-wrap in a layout. When rendering via `<Content />` inside a content collection, typically ignore this and wrap explicitly in the page.
- Astro 5.2+ supports TOML frontmatter (`+++` delimiters) for both Markdown and MDX — not required but available.

### Decision
- Use `.mdx` everywhere. No `.md`.
- Define components globally via the `<Content components={{...}} />` prop inside a single `ChapterRenderer.astro` wrapper. Authors do not need to import common components (`Callout`, `Figure`, `Mermaid`, `KaTeX`) at the top of every file. They may still import one-off components as needed.
- Element overrides (`pre` → `CodeBlock` with Shiki enhancements, `a` → `SmartLink`) go through the same `components` prop.
- Frontmatter is validated by the Zod collection schema (Topic 1). Do not rely on MDX's `layout` frontmatter — wrap explicitly in the route file so `getStaticPaths` props (sibling chapter, course ref) can flow into the layout.

### Sources
- [@astrojs/mdx integration](https://docs.astro.build/en/guides/integrations-guide/mdx/)
- [Markdown in Astro](https://docs.astro.build/en/guides/markdown-content/)
- [Layouts](https://docs.astro.build/en/basics/layouts/)
- [Astro 5.2 release notes (TOML frontmatter)](https://astro.build/blog/astro-520/)

---

## Research Topic 4: Astro Hydration Directives — When to Use Which

### Question
For each interactive surface on GyanDev, which hydration directive (`client:load`, `client:visible`, `client:idle`, `client:only`, `client:media`) minimizes JS shipped while preserving UX?

### Findings (directive trade-offs)
- `client:load` — JS fetched and hydrated immediately on page load. For above-the-fold interactivity.
- `client:idle` — waits for `requestIdleCallback` (Astro ≥4.15 accepts a `timeout`). Good for secondary interactivity.
- `client:visible` — `IntersectionObserver`; JS ships only when the island scrolls into view. Best for heavy below-the-fold islands.
- `client:media={query}` — hydrates only when a CSS media query matches. Ideal for viewport-specific UI.
- `client:only={framework}` — skips SSR; renders only in the browser. Necessary for components that touch `window`/`localStorage` at render time and cannot be server-rendered.
- For pre-paint work (theme to avoid FOUC), the correct tool is **not** a hydration directive at all — it's an inline `<script is:inline>` in `<head>` that synchronously reads `localStorage` and sets a class on `<html>` before paint. Any `client:*` runs after HTML parse.

### Decision — GyanDev component-by-component

| Feature | Strategy | Rationale |
|---|---|---|
| **Theme toggle** | `<script is:inline>` in `<head>` for pre-paint class set; a small vanilla `<script>` (no island) for the click handler | Any `client:*` runs after parse → guaranteed FOUC. Inline non-module script blocks paint just long enough to set `html.dark` and `data-theme`. The button itself is plain HTML + tiny script, no framework island. |
| **Mobile nav drawer** | `client:media="(max-width: 768px)"` | Never ships drawer JS on desktop. |
| **Mermaid diagrams (Flow view only, below fold)** | `client:visible` (or `client:only` if Mermaid breaks during SSR) | Mermaid is heavy; defer until diagram scrolls in. If SSR fails due to DOM access, `client:only` is the safety valve. |
| **Giscus comments** | `client:visible` on a lazy-mount wrapper | External iframe, always below fold; no need to pay the cost unless user scrolls. |
| **Search modal (⌘K)** | `client:idle` with a low `timeout`, dynamic-import Pagefind runtime on first open | Trigger must work any time. `client:visible` fails because the modal is not in viewport until opened. `client:idle` hydrates post-critical-path but is ready when the user hits ⌘K. |
| **Bookmark button** | Plain `<script>` with no framework island (preferred) — `client:load` only if kept as an island | Visible always, needs `localStorage` immediately. Vanilla script reading `localStorage` and toggling `aria-pressed` ships near-zero JS and matches the "ship less JS" goal. |

**General rule**: prefer zero-JS/inline scripts over any `client:*` when the feature is simple DOM toggling. Reserve framework islands for genuinely stateful UI.

### Sources
- [Template directives reference](https://docs.astro.build/en/reference/directives-reference/)
- [Islands architecture](https://docs.astro.build/en/concepts/islands/)
- [Front-end frameworks](https://docs.astro.build/en/guides/framework-components/)
- [Tutorial: theme toggle without an island](https://docs.astro.build/en/tutorial/6-islands/2/)

---

## Research Topic 5: Tailwind CSS v4 with Astro

### Question
How is Tailwind v4 configured in Astro without `tailwind.config.js`? How do we wire light/dark mode through CSS variables, and is `@tailwindcss/vite` (already installed) the correct integration path?

### Findings
- **`@theme` directive defines design tokens in CSS.** Placed after `@import "tailwindcss"`. Tokens in namespaces (`--color-*`, `--font-*`, `--spacing-*`, `--breakpoint-*`) automatically generate matching utility classes AND emit as real CSS variables on `:root` in compiled output.
- **Light/dark via `.dark` class with token overrides.** The v4 pattern: define tokens in `@theme`, then override the CSS variables under a `.dark` selector in `@layer base`. Utilities automatically pick up new values because they resolve through CSS vars.

  ```css
  @import "tailwindcss";
  @custom-variant dark (&:where(.dark, .dark *));
  @theme {
    --color-accent: #4f46e5;
    --color-bg: #ffffff;
    --color-text: #111827;
  }
  @layer base {
    .dark {
      --color-accent: #818cf8;
      --color-bg: #0b1020;
      --color-text: #e5e7eb;
    }
  }
  ```

- **`@custom-variant` replaces `darkMode: 'class'`.** No `tailwind.config.js` key. Syntax `@custom-variant dark (&:where(.dark, .dark *));` for class strategy, or attribute-based variant for `data-theme`.
- **`@tailwindcss/vite` is the official Astro path; `@astrojs/tailwind` is deprecated for v4.** Astro 5.2+ has native support; `astro add tailwind` now installs the Vite plugin + a default CSS file.
- **Entry CSS uses `@import "tailwindcss"`** (not the old three `@tailwind` directives). No PostCSS config required when using the Vite plugin.

### Decision
Keep the current `@tailwindcss/vite` setup — already correct in `astro.config.mjs`. Do **not** install `@astrojs/tailwind`. In `src/styles/global.css`:

1. `@import "tailwindcss";`
2. `@custom-variant dark (&:where(.dark, .dark *));` — class-based toggle.
3. Define semantic tokens in `@theme`: `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-border`, `--font-sans`, `--font-mono`, content-width tokens.
4. Override those variables under `.dark { ... }` in `@layer base`.
5. Keep token names kebab-case (per CLAUDE.md).

Theme toggle uses a tiny `<script is:inline>` in the head that reads `localStorage.theme` and toggles `.dark` on `<html>` before paint, avoiding FOUC.

### Sources
- [Theme variables (Tailwind docs)](https://tailwindcss.com/docs/theme)
- [Dark mode (Tailwind docs)](https://tailwindcss.com/docs/dark-mode)
- [Install Tailwind with Astro](https://tailwindcss.com/docs/installation/framework-guides/astro)
- [Astro 5.2 release notes](https://astro.build/blog/astro-520/)
- [v4 CSS-variable dark mode (discussion #15083)](https://github.com/tailwindlabs/tailwindcss/discussions/15083)

---

## Research Topic 6: Pagefind

### Question
How does Pagefind integrate with Astro, is the default UI adequate, how do we scope indexed content, and what is the runtime JS footprint?

### Findings
- **Build-time indexing.** Pagefind is a Rust CLI that runs *after* `astro build`. It scans `dist/` HTML, extracts text, and writes a static `pagefind/` bundle (WASM index shards + JS runtime + optional CSS/JS UI). MDX compiles to HTML at build time, so MDX content is indexed seamlessly — Pagefind never sees MDX, only final HTML.
- **Astro integration options.**
  1. `astro-pagefind` (shishkin) — Astro integration hooking `astro:build:done` to auto-run Pagefind. Also ships an `astro-pagefind/components/Search` component. Caveat for dev: the index only exists after a build, so `astro build && pagefind --site dist` before `astro preview` is required to test locally.
  2. Plain CLI postbuild — `"postbuild": "pagefind --site dist"` in `package.json`. Zero runtime dependency. Used by Starlight internally.
- **UI packages.**
  - `@pagefind/default-ui` — single-input + results list, ~2 KB JS min+gzip + ~12 KB WASM core on-demand.
  - **Component UI (`ui.pagefind.app`)** — web components: `<pagefind-search>`, `<pagefind-modal>`, `<pagefind-modal-trigger>`. The modal trigger ships with `⌘K` / `Ctrl+K` built in and follows WAI-ARIA patterns. Assistive-text translations are automatic per site language.
- **Scoping with data attributes.**
  - `data-pagefind-body` — **once any page has it, only pages with it are indexed**.
  - `data-pagefind-ignore="all"` — subtree exclusion.
  - `data-pagefind-filter="course"` — captures element content as a filter value for facets.
  - `data-pagefind-meta="key"` — exposes metadata for custom UI templates.
- **Runtime weight.** Loader is small; WASM core (~12 KB) and index shards fetch on first query. Near-zero idle cost; ~15–25 KB burst on first search.
- **Accessibility.** Component UI follows WAI-ARIA patterns with proper roles, live regions, and keyboard navigation. No formal WCAG 2.2 AA audit published, but sufficient for AA compliance with our contrast/theme work.

### Decision
- Use `astro-pagefind` (shishkin) — cleaner than managing postbuild scripts, uses `astro:build:done` correctly.
- Use the **Component UI modal** (`<pagefind-modal>` + `<pagefind-modal-trigger>`), not the default search bar. Built-in ⌘K, better UX for docs/notes, ARIA-compliant, themable via CSS custom properties.
- Wrap indexed chapter body in `<article data-pagefind-body>`. Tag chrome (nav, footer, TOC) with `data-pagefind-ignore="all"`.
- Add `data-pagefind-filter="course"` at the chapter wrapper for facet-scoped search.
- **Index only the Full Notes view** per chapter — not Revision or Flow. Aligns with our canonical-URL strategy; avoids three duplicate hits per chapter.

### Sources
- [Pagefind Indexing docs](https://pagefind.app/docs/indexing/)
- [Pagefind Filtering docs](https://pagefind.app/docs/filtering/)
- [Pagefind UI docs](https://pagefind.app/docs/ui/)
- [Pagefind Component UI / Modal docs](https://pagefind.app/docs/search-ui/)
- [astro-pagefind (shishkin)](https://github.com/shishkin/astro-pagefind)
- [EastonDev: Astro Pagefind guide (Dec 2025)](https://eastondev.com/blog/en/posts/dev/20251203-astro-pagefind-search-guide/)

---

## Research Topic 7: Giscus in Astro

### Question
How do we wrap Giscus in an Astro component, sync its theme with our dark mode, lazy-load it, and map its discussion threads correctly given our three-URL-one-canonical chapter model?

### Findings
- **Script structure.** Giscus is a single `<script src="https://giscus.app/client.js" data-*>` tag that injects an `<iframe>`. No npm install required. `@giscus/react` exists but is a thin wrapper — unnecessary for Astro unless the stack already uses React.
- **Mapping options:** `pathname`, `url`, `title`, `og:title`, `specific`, `number`. `data-strict="1"` hashes the search term (SHA-1) for 1:1 page↔discussion mapping.
- **Theme sync.** Initial value via `data-theme`. For dynamic changes, `postMessage` to the iframe: `iframe.contentWindow.postMessage({ giscus: { setConfig: { theme: 'dark' } } }, 'https://giscus.app')`. Combine with a `MutationObserver` on `<html class>` (or our theme attribute) to push updates when the user toggles.
- **Lazy loading.** Two layers:
  1. `data-loading="lazy"` — internal iframe uses native `loading="lazy"`.
  2. Script gating — don't inject the `<script>` until the comments section nears viewport. Wrap in an Astro component with `client:visible` (IntersectionObserver under the hood) or hand-roll an IO that injects the Giscus `<script>` on intersection. Avoids the ~150–300 KB iframe payload until needed.
- **Privacy / GDPR.** Per Giscus's privacy policy: no cookies, no analytics, no tracking. Signed-in users get a server-encrypted token in `localStorage` (not a cookie). Anonymous readers leave no state. Generally GDPR-friendly with no cookie banner required for the embed alone — though loading any third-party iframe may be gated by strict consent regimes.

### Decision
- Build a small `<Comments />` Astro component:
  - `IntersectionObserver` lazy-injects the Giscus `<script>` tag on first intersection.
  - `MutationObserver` on the `<html>` theme attribute posts theme updates via `postMessage`.
- Config: `data-mapping="specific"`, `data-term={chapter.slug}`, `data-strict="1"`, `data-loading="lazy"`, `data-theme="preferred_color_scheme"` initial.
- **One comment thread per chapter, not per view.** `mapping="specific"` with `term={chapter.slug}` makes the thread view-independent — a reader on Full Notes, Revision, or Flow sees the same comments.
- Skip `@giscus/react`. Raw script is lighter and matches Astro idioms.
- No cookie banner strictly required now; reconsider a single-click "Load comments" opt-in if EU-audience posture tightens later.

### Sources
- [giscus README](https://github.com/giscus/giscus/blob/main/README.md)
- [Giscus ADVANCED-USAGE.md (postMessage / setConfig)](https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md)
- [Giscus PRIVACY-POLICY.md](https://github.com/giscus/giscus/blob/main/PRIVACY-POLICY.md)
- [Issue #1200: dynamic theme sync](https://github.com/giscus/giscus/issues/1200)
- [Daniel Garcia: Giscus in Astro (Aug 2025)](https://daniel.es/blog/2025-08-06-how-to-setup-giscus-in-astro/)

---

## Research Topic 8: astro-mermaid

### Question
How does `autoTheme` behave? When is the Mermaid runtime actually loaded? How do we customize themes, and what is the performance cost?

### Findings
- **`autoTheme: true` watches the `data-theme` attribute on `<html>`.** It keys off `data-theme` values (`light`/`dark`), **not** a `.dark` class. The integration injects a client script that re-renders diagrams on attribute change (MutationObserver-based).
- **Client-side render.** Diagrams become placeholder `<pre class="mermaid">` at build. Mermaid JS runs in the browser at runtime, calling `mermaid.render()` locally (no network).
- **Per-page loading.** The integration only injects its script on pages that contain a ```mermaid fence. Pages without diagrams do **not** download Mermaid's ~1.5 MB bundle.
- **Bundle size.** Mermaid 10+ is ~1.5–2.3 MB uncompressed, split across core + per-diagram-type chunks so only used chunks load.
- **Theme customization.** `mermaidConfig.themeVariables` overrides per-token colors (`primaryColor`, `lineColor`, `textColor`, etc.). Use theme `'base'` with explicit `themeVariables` for full control.

### Decision
1. Keep `astro-mermaid` with `autoTheme: true`, `theme: 'default'` (current config).
2. **Theme toggle must set BOTH** `document.documentElement.classList.toggle('dark', …)` (Tailwind class strategy) **AND** `document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')` (astro-mermaid). One source of truth, two sinks.
3. Pass `mermaidConfig.themeVariables` with our accent/bg/text tokens so diagrams match our palette in both modes. Use `'base'` with explicit variables.
4. Only the Flow Diagram view contains ```mermaid fences — so the ~1.5 MB runtime is isolated to one of the three chapter tabs. This aligns perfectly with Topic 14's recommendation (separate routes per view).

### Sources
- [astro-mermaid on npm](https://www.npmjs.com/package/astro-mermaid)
- [joesaby/astro-mermaid on GitHub](https://github.com/joesaby/astro-mermaid)
- [Lazy loading Mermaid — Rick Strahl](https://weblog.west-wind.com/posts/2025/May/10/Lazy-Loading-the-Mermaid-Diagram-Library)
- [Shrinking Mermaid — Sidharth Vinod](https://www.sidharth.dev/posts/shrinking-mermaid/)

---

## Research Topic 9: Shiki + rehype-pretty-code (Dual Themes)

### Question
How does `theme: { light, dark }` render in HTML? Is it two trees, one tree with CSS-var swap, or something else? Is `github-dark-dimmed` still a good choice in 2026? What syntax do we have for line / word / diff highlighting?

### Findings
- **Single HTML tree, CSS-variable swap.** When `theme: { light, dark }` is set, Shiki renders each token as `<span style="color:#X;--shiki-dark:#Y">`. ONE DOM tree — the browser swaps which variable applies via CSS based on the dark-mode selector. No duplicate markup, no JS swap.
- **CSS to activate dark values** must be written by us (rehype-pretty-code is unstyled by design):

  ```css
  html.dark .shiki,
  html.dark .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg) !important;
  }
  ```

- **`github-dark-dimmed` in 2026** is still maintained. Softer than `github-dark` (lower contrast greys), better for long-form reading at night — suits an education site. Current config is fine.
- **Line highlighting:** `` ```ts {2,4-6} title="file.ts" `` — adds `data-highlighted-line` on the line span; title becomes a `data-rehype-pretty-code-title` element above the block.
- **Line IDs:** `{1}#added {2}#removed` — emits `data-highlighted-line-id="added"` so you color add/remove lines distinctly via CSS.
- **Word/character highlighting:** `` ```js /useState/ `` marks every `useState` with `data-highlighted-chars`. Range: `/useState/1-2` highlights first and second occurrences. Multiple IDs via `/foo/#a /bar/#b`.
- **Diff:** No built-in "diff language" magic — do it with line IDs + CSS (`#add` green left border, `#del` red).
- **Inline code:** `` `const x = 1{:ts}` `` highlights inline code as TS.

### Decision
Current config (`rehypePrettyCode` with `theme: { light: 'github-light', dark: 'github-dark-dimmed' }` in both `markdown` and `mdx()` config) is correct for 2026. To complete it:

1. Add the CSS variable swap rules to `global.css` under `html.dark`.
2. Standardize a data-attr stylesheet: line highlight = subtle background; `#add` = green tint; `#del` = red tint + `line-through`; `#focus` = bold. Use `--color-accent` so code blocks participate in the design system.
3. Document fence syntax (`{n-m}`, `/word/`, `title=""`, `#id`) in the authoring guide.
4. Keep `syntaxHighlight: false` in markdown config (already set) so Astro's built-in Shiki does not double-run.

### Sources
- [Rehype Pretty Code docs](https://rehype-pretty.pages.dev/)
- [Rehype Pretty Code examples](https://rehype-pretty.pages.dev/examples/)
- [Shiki dual themes guide](https://shiki.matsu.io/guide/dual-themes)
- [Shiki themes list](https://github.com/shikijs/shiki/blob/main/docs/themes.md)
- [rehype-pretty-code on GitHub](https://github.com/rehype-pretty/rehype-pretty-code)

---

## Research Topic 10: OG Image Generation

### Question
Satori vs `@vercel/og` vs `astro-og-canvas` vs `workers-og` — which for a 50+ chapter Astro site on Cloudflare Pages? Runtime or build-time?

### Findings

| Option | Renderer | Runtime fit | Astro-native |
|---|---|---|---|
| `satori` + `sharp` (manual) | React-element → SVG → PNG | Build or edge; sharp is Node-only, edge needs `@resvg/resvg-wasm` | Manual |
| `@vercel/og` | Satori + resvg-wasm | Edge (Vercel) / Node; **does not work on Cloudflare Workers** | Manual |
| `workers-og` | Satori + resvg-wasm | Cloudflare Workers | Manual |
| `og-img` | Satori-based | Edge + Node | Astro-friendly |
| `astro-og-canvas` (delucis) | **Skia-canvas native** (no Satori) | Build-time only | First-class; ships `OGImageRoute` |
| `astro-satori` (kevinzunigacuellar) | Satori | Build-time | Astro-first |

- **Build-time vs runtime for 50+ chapters.** 50 chapters × ~50 KB PNG ≈ 2.5 MB of static assets — nothing for Cloudflare Pages (20 k file / 25 MB each limit). Build at 10–30 s total. Build-time wins: no edge cost, immediate CDN caching, no cold-start latency for crawlers, simpler testing. Runtime only matters for UGC or constantly-changing content.
- **Astro `getStaticPaths` pattern (Satori route).** `src/pages/og/[...slug].png.ts` returning PNG via `satori(jsxTree, { width: 1200, height: 630, fonts: [...] })` → `sharp(svg).png().toBuffer()`. Astro pre-renders each `.png.ts` once and writes `.png` to `dist/og/<slug>.png`.
- **Font loading.** Satori cannot use system fonts or WOFF2 — requires TTF/OTF bundled at build time. `astro-og-canvas` supports WOFF2 natively (uses Skia).
- **astro-og-canvas specifics.** Provides `OGImageRoute({ param, pages, getSlug, getImageOptions })` that auto-generates `getStaticPaths` per chapter. Prescriptive layout (title, description, logo, borders, padding, bg/fg colors) — good for consistency across 50 cards. Persistent cache at `./node_modules/.astro-og-canvas` across builds. Astro 6 support landed experimentally in 0.8.0; stable in 0.9.x.
- **Emoji.** Satori needs explicit `graphemeImages` / `loadAdditionalAsset` for emoji (typically Twemoji fetches). astro-og-canvas handles emoji natively. GyanDev doesn't rely on emoji in OG cards.

### Decision
**Use `astro-og-canvas` with `OGImageRoute`, build-time only.** Rationale:
1. Astro-first API removes `getStaticPaths` boilerplate per chapter.
2. Built-in persistent cache speeds incremental builds.
3. Native WOFF2 + emoji without Satori gotchas.
4. Prescriptive layout keeps 50+ cards visually consistent — a feature, not a limitation.
5. Build-time output served by Cloudflare CDN with no Worker invocations.

Emit at `/og/<course>/<chapter>.png`. Reference from `<meta property="og:image">` and `<meta name="twitter:image">` in the chapter layout.

Fallback plan: if a later design needs arbitrary JSX/CSS cards, migrate to a Satori + sharp endpoint (`src/pages/og/[...slug].png.ts`). Keep that door open; do not pre-optimize for it.

### Sources
- [astro-og-canvas README](https://github.com/delucis/astro-og-canvas/blob/latest/packages/astro-og-canvas/README.md)
- [astro-og-canvas releases (0.8.0 adds Astro 6)](https://github.com/delucis/astro-og-canvas/releases)
- [Diet Code: Build-time dynamic OG images with Astro & Satori](https://dietcode.io/p/astro-og/)
- [Jilles: OG Images in Astro — Build-Time vs Runtime](https://jilles.me/og-images-astro-build-vs-runtime/)
- [kevinzunigacuellar/astro-satori](https://github.com/kevinzunigacuellar/astro-satori)
- [workers-og](https://github.com/kvnang/workers-og)

---

## Research Topic 11: @astrojs/sitemap

### Question
How do we filter out non-canonical URLs, populate accurate `lastmod` from frontmatter, set per-URL `priority` and `changefreq`, and understand sitemap index behavior for future i18n?

### Findings
- **`filter` vs `serialize`.** Both are exposed.
  - `filter: (page: string) => boolean` — return `false` to drop the URL entirely before it becomes a `SitemapItem`. Right hook for excluding `/404`, `/search`, `/revision`, `/flow`.
  - `serialize: (item) => item | undefined` — mutate item (set `lastmod`, `changefreq`, `priority`, `links`) or return `undefined` to drop.
- **`lastmod` is NOT pulled from frontmatter automatically.** Supply it via `serialize` (or objects passed to `customPages`). Read frontmatter yourself via `getCollection`, build a `Map<url, date>`, look up by `item.url`.
- **`changefreq` / `priority` per URL pattern** — set inside `serialize` with regex on `item.url`. Google ignores these; Bing and smaller crawlers still consume them (low-cost upside).
- **Sitemap index always emitted.** `sitemap-index.xml` + `sitemap-0.xml`, even with one file. `entryLimit` defaults to 45 000. Single file is fine until then. Submit `sitemap-index.xml` to Search Console (not `sitemap.xml` — not emitted by default).
- **i18n API shape** (Phase 2 reference):

  ```ts
  sitemap({
    i18n: {
      defaultLocale: 'en',
      locales: { en: 'en-US', hi: 'hi-IN', es: 'es-ES' },
    },
  });
  ```

  `defaultLocale` must appear as a key in `locales`. Emits `<xhtml:link rel="alternate" hreflang="...">`.

### Decision
```ts
sitemap({
  filter: (page) =>
    !page.endsWith('/revision') &&
    !page.endsWith('/flow') &&
    !page.endsWith('/404') &&
    !page.endsWith('/search'),
  serialize: async (item) => {
    // Look up lastmod from chapter frontmatter via a precomputed Map<url, Date>
    // Set priority + changefreq by URL pattern (home=1.0, course=0.9, chapter=0.8, about=0.5, legal=0.3)
    return item;
  },
});
```

Submit `sitemap-index.xml` to Search Console and Bing Webmaster Tools. Defer `i18n` config until Phase 2; API shape is captured here for future reference.

### Sources
- [@astrojs/sitemap docs](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- [sitemap integration source](https://github.com/withastro/astro/blob/main/packages/integrations/sitemap/src/index.ts)
- [Accurate lastmod tags in Astro sitemap — Printezis](https://www.printezisn.com/blog/post/adding-accurate-lastmod-tags-to-your-astro-sitemap/)
- [sitemap CHANGELOG](https://github.com/withastro/astro/blob/main/packages/integrations/sitemap/CHANGELOG.md)

---

## Research Topic 12: Cloudflare Pages `_redirects` and `_headers`

### Question
Exact syntax for 301 redirects, wildcards, rule limits; `_headers` format for cache-control and security; trailing-slash handling; www→apex redirect; Cache-Control precedence; CSP header-vs-meta.

### Findings
- **`_redirects` syntax.** One rule per line: `<source> <destination> <status>`. Splat `*` matches greedily; interpolated as `:splat`. Status defaults to 302; use 301 for permanent slug renames. Only one splat per source. `:placeholder` named params supported.
- **Rule limits.** Up to **2000 static + 100 dynamic = 2100 total**. Line cap 1000 chars. Dynamic = any rule with `*` or `:placeholder`. Beyond that, use dashboard Bulk Redirects. Order matters — first match wins.
- **`_headers` syntax.** Path pattern on its own line, indented `Header-Name: value` lines beneath. Wildcards allowed. Per-path headers merge with site-wide `/*` rules.
- **Trailing-slash handling.** Pages has **no dashboard toggle**. Behavior driven by build file layout: `about.html` → `/about` (no slash); `about/index.html` → `/about/` with a forced 308 from `/about`. For GyanDev's "no trailing slash" convention, set `trailingSlash: 'never'` **and** `build.format: 'file'` in `astro.config.mjs` so every page builds as `foo.html`, avoiding the 308 detour. Don't try to fix this with `_redirects` alone — loops result.
- **www → apex.** `_redirects` cannot do this on Pages (only runs on bound hostnames). Use Cloudflare **Redirect Rules** (dashboard, zone-level): match `http.host eq "www.gyandev.org"`, redirect to `concat("https://gyandev.org", http.request.uri.path)` 301, preserve query. Page Rules are legacy; prefer Redirect Rules.
- **Cache-Control precedence.** Origin Cache Control is on by default. `Cache-Control` set in `_headers` is respected by both edge and browser TTL — unless a zone-level Cache Rule explicitly overrides (Cache Rules win over `_headers`). Pages' default for hashed static assets (`/_astro/*`) is already `max-age=31536000, immutable` — setting it explicitly is belt-and-suspenders.
- **CSP: header vs meta tag.** Use `_headers`. A meta tag cannot set `frame-ancestors`, `report-uri`, or `report-to` (ignored by spec). For static-HTML Astro pages, the HTTP header is the right layer. Example baseline:

  ```
  /*
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://giscus.app; frame-src https://giscus.app; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  ```

  `style-src 'unsafe-inline'` is needed for KaTeX's inline styles; revisit if we move KaTeX to file-based CSS. `frame-src` + `connect-src` additions are required for Giscus.

### Decision
- Ship `public/_redirects` for 301 slug-rename rules only. One static line per rename. Budget well under the 2000-rule limit.
- Ship `public/_headers` with:
  - `/*` — security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS, CSP).
  - `/_astro/*` and `/fonts/*` — `Cache-Control: public, max-age=31536000, immutable`.
- Set Astro `trailingSlash: 'never'` **+** `build.format: 'file'` so Pages serves canonical no-slash URLs directly.
- Handle www → apex with a zone-level Cloudflare Redirect Rule (dashboard ops), not `_redirects`.
- CSP via HTTP header, never meta tag.

### Sources
- [Redirects — Cloudflare Pages docs](https://developers.cloudflare.com/pages/configuration/redirects/)
- [Headers — Cloudflare Pages docs](https://developers.cloudflare.com/pages/configuration/headers/)
- [Redirecting www to apex — Cloudflare Pages docs](https://developers.cloudflare.com/pages/how-to/www-redirect/)
- [Origin Cache Control](https://developers.cloudflare.com/cache/concepts/cache-control/)
- [CSP and Cloudflare](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/)

---

## Research Topic 13: localStorage Schema Versioning

### Question
How do we design a versioned localStorage schema with migrations, handle quota/unavailability/corruption gracefully, and sync across tabs?

### Findings
- **Versioned envelope pattern.** Every write wraps `{ v: number, data: T }`. On read: compare `v` to `CURRENT_VERSION`; if lower, run sequential migrations (`v1→v2→v3`); if higher (user downgraded), reset or read-only. Matches Zustand `persist`'s `version` + `migrate` model.
- **Quota per origin (2025–2026).**
  - Chrome/Chromium: ~10 MiB localStorage specifically (broader Storage API is % of disk but localStorage is capped).
  - Firefox: 10 MiB per eTLD+1 (shared across subdomains).
  - Safari: ~5 MiB localStorage.
  - **Practical ceiling: 5 MiB** (Safari floor). GyanDev progress data is kilobytes, not a concern for core use; keep in mind if we ever cache MDX snippets or bookmark notes.
  - Private/Incognito modes have reduced quotas and clear on exit; catch `QuotaExceededError` defensively.
- **Cross-tab sync via `storage` event.** Fires on **other** tabs only, not the writer. Payload: `{ key, oldValue, newValue, url, storageArea }`. For same-tab multi-component sync, use `BroadcastChannel('gyandev')` in parallel.
- **Detecting unavailability.** Feature-detect with a round-trip write+remove inside `try/catch`. Presence of `window.localStorage` is not sufficient (Safari private mode exposes it, then throws on `setItem`).
- **Typed utility shape** — features to build in:
  1. Version check + migration on read; on `JSON.parse` throw, log + reset to defaults (corruption recovery).
  2. In-memory `Map` fallback when storage is unavailable.
  3. Debounced writes for high-frequency keys (scroll-progress ~250–500 ms).
  4. `storage`-event subscribe for cross-tab sync.
  5. Flush pending debounced writes on `pagehide` / `visibilitychange === 'hidden'`.
- **OSS references:** Zustand `persist` (version + migrate pattern, widely audited); `solydhq/typed-local-store` (zero-dep TS wrapper); `react18-tools/persist-and-sync` (~1 KB cross-tab sync).

### Decision
- Single envelope per key: `{ v: number, data: T }`. Namespace keys as `gyandev:<slot>` (e.g., `gyandev:prefs`, `gyandev:progress:nodejs`, `gyandev:bookmarks`).
- Ship a hand-rolled typed utility in `src/lib/storage.ts` modeled on Zustand's persist API but dependency-free (no React in stack). Features: version+migrate, JSON-error recovery, in-memory fallback, debounced writes, `storage`-event subscribe, `pagehide` flush.
- `CURRENT_VERSION = 1` at launch. Add a migration table stub now so v2 has zero friction.
- One key per course for progress (atomic reads, stays well under Safari's 5 MiB for thousands of chapters). Don't shard per-chapter.
- Start with `storage` event only for cross-tab; add `BroadcastChannel` if same-tab component sync becomes painful.

### Sources
- [Storage quotas and eviction — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Storage for the web — web.dev](https://web.dev/articles/storage-for-the-web)
- [Simple frontend data migration — Jan Monschke](https://janmonschke.com/simple-frontend-data-migration/)
- [Zustand persist middleware](https://deepwiki.com/pmndrs/zustand/3.1-persist-middleware)
- [solydhq/typed-local-store](https://github.com/solydhq/typed-local-store)
- [Why using localStorage directly is a bad idea — Michal Zalecki](https://michalzalecki.com/why-using-localStorage-directly-is-a-bad-idea/)

---

## Research Topic 14: Astro View Transitions for Tab Switching

### Question
Should we use `<ClientRouter />` to animate between Full Notes ↔ Revision ↔ Flow (separate routes), or build a single-route client-side tab switcher keeping all three in DOM?

### Findings
- **`<ClientRouter />` (renamed from `<ViewTransitions />` in Astro 5.x)** opt-in at layout level; intercepts `<a>` clicks and popstate; turns MPA into pseudo-SPA. Ships a route announcer for screen readers. Respects `prefers-reduced-motion` (animations disabled automatically).
- **Scroll position has documented bugs.** Scroll restoration on back/forward is flaky, especially with smooth-scroll libs. `transition:persist` helps for specific elements but doesn't reliably preserve scroll within swapped regions.
- **Designed for cross-route transitions, not in-page tab state.** Astro rule: "If there would be a full page load without view transitions, there will be a view transition with them." For our 3 chapter views as separate routes, ClientRouter animates the route change. For same-page tabs (no route change), it contributes nothing.
- **SEO: neutral-to-positive.** Pages are still statically generated and served on direct nav; crawlers see full HTML per route.
- **CLS risk: low** if `transition:name` is scoped to stable shell elements (header, chapter title). Default cross-fade is tame.
- **Keyboard UX:** `<a>` links still work; route announcer announces new `<title>`. Back/forward with keyboard works but scroll restoration can misfire — an active issue.
- **Single-route tabs alternative:** all three views in DOM, one visible at a time, toggled with `role="tab"` / `role="tabpanel"` and ARIA. Pros: instant swap, zero network cost, trivial per-tab scroll preservation. Cons: **all content loads upfront** — including Mermaid's ~1.5 MB on every chapter page, even if the user never opens Flow.

### Decision
**Separate routes per view + `<ClientRouter />` with `transition:persist` on the shell, and manual scroll preservation.**

Rationale:
1. **Mermaid bundle size dominates.** Separate Flow route means Mermaid's ~1.5 MB only loads when the user clicks that tab. Single-route tabs would pay that cost on every chapter page load — violating "snappy" on slow connections.
2. **Snappiness is still good.** ClientRouter caches visited routes; second visit is instant. First visit fetches a small HTML doc (CSS/JS already cached from the layout).
3. **Keyboard + a11y wins by default:** tabs are real `<a href>`s — Tab navigation, middle-click open, deep-linking, browser history. Route announcer covers screen readers.
4. **SEO wins:** each view crawlable at its own URL. Canonical still points to Full Notes (per `routing-and-urls.md`) and Revision/Flow are `noindex, follow`.
5. **Scroll position per tab:** each tab is its own URL, so browser native scroll restoration on back/forward works. For forward nav, persist `scrollY` per URL in `sessionStorage` and restore on `astro:page-load`. Don't rely on `transition:persist` for scroll.
6. **Reduced-motion handled automatically** by ClientRouter's built-in media query.
7. **CLS mitigation:** wrap chapter shell (title, tab bar, progress) in a container with `transition:persist="chapter-shell"` so only the body region animates.

The single-route JS-tab alternative becomes preferable only if we switch Mermaid to build-time server-rendered SVGs (e.g., `rehype-mermaid`) — revisit if performance data shows route-change latency as the bottleneck.

### Sources
- [View transitions — Astro Docs](https://docs.astro.build/en/guides/view-transitions/)
- [View Transitions Router API Reference](https://docs.astro.build/en/reference/modules/astro-transitions/)
- [Scroll position issue #8083](https://github.com/withastro/astro/issues/8083)
- [ClientRouter + Lenis issue #12725](https://github.com/withastro/astro/issues/12725)
- [Astro View Transitions — Chrome Developers blog](https://developer.chrome.com/blog/astro-view-transitions)

---

## Cross-Cutting Decisions

Decisions synthesized from the above that affect multiple areas:

1. **Chapter views are three separate Astro routes, animated by `<ClientRouter />`, not a single-route JS tab switcher.** Isolates Mermaid's ~1.5 MB to the Flow view only. Each tab is a real `<a href>`; browser history, deep links, and keyboard navigation work for free. Manual scroll preservation via `sessionStorage` keyed on URL.
2. **Two-collection content model (`courses` + `chapters`) with `reference()` cross-linking.** Enables typed course↔chapter links, flat `chapters` queries for sitemap/search, and stable `id`-derived URLs. Revision/Flow content as sibling MDX files in each chapter folder.
3. **Shared `getChapterPaths()` utility** in `src/lib/paths.ts`, called from all three chapter route files (`index.astro`, `revision.astro`, `flow.astro`) — single source of truth.
4. **Minimal-JS hydration strategy.** Prefer inline `<script>` / `<script is:inline>` over framework islands for theme toggle and bookmark button. Reserve islands for genuinely stateful UI (search modal on `client:idle`, Mermaid on `client:visible`, Giscus on `client:visible`, mobile nav on `client:media`). Never use `client:*` for anything that must run before paint.
5. **Dark mode via `.dark` class on `<html>` (Tailwind) + parallel `data-theme` attribute (astro-mermaid).** A single inline `<script is:inline>` pre-paint sets both; a MutationObserver inside Giscus wrapper posts theme updates to the iframe. Tailwind v4 `@custom-variant dark` keyed on `.dark`; tokens defined in `@theme` with `.dark` overrides in `@layer base`.
6. **Shiki dual themes render as one tree with CSS-variable swap.** `html.dark .shiki` CSS activates `--shiki-dark` values. Current config (`github-light` + `github-dark-dimmed`) is correct for 2026.
7. **`trailingSlash: 'never'` + `build.format: 'file'`** in `astro.config.mjs`. Produces flat `.html` files so Cloudflare Pages serves canonical no-slash URLs without 308 redirects.
8. **Pagefind indexes only Full Notes content.** `data-pagefind-body` wrapper on Full Notes routes only, not Revision/Flow. Mirrors our canonical-URL / SEO strategy.
9. **Sitemap excludes `/revision`, `/flow`, `/404`, `/search` via `filter`.** `lastmod` populated inside `serialize` from chapter frontmatter. Submit `sitemap-index.xml` to Search Console.
10. **OG images via `astro-og-canvas` at build time.** `OGImageRoute` helper emits `/og/<course>/<chapter>.png`. No runtime cost. Prescriptive layout enforces visual consistency.
11. **Cloudflare configuration split:** `_redirects` for slug-rename 301s only; `_headers` for security + cache-control; www→apex and any zone-level concerns via Cloudflare Redirect Rules (dashboard ops).
12. **localStorage via single typed utility (`src/lib/storage.ts`)** with versioned envelope, migration table, debounced writes, `pagehide` flush, `storage`-event cross-tab sync, in-memory fallback. One key per course for progress; do not shard.
13. **Giscus with `mapping="specific"` + `term={chapter.slug}`** so one comment thread per chapter spans all three views. Lazy-mount via IntersectionObserver; theme sync via `postMessage`.

---

## Open Questions Flagged for Implementation

Not blockers for Sessions 2–3, but need resolution before implementation lands:

- [ ] **Revision/Flow content organization:** two-collection model (`chapters` holds Full Notes, separate `chapterViews` collection for Revision/Flow) vs. one-collection with revision/flow as extra content fields via custom loader. Decide when authoring the first real chapter.
- [ ] **Should we ship `BroadcastChannel` alongside `storage` event from day 1?** Add only if same-tab component sync becomes awkward.
- [ ] **EU GDPR posture for Giscus:** single-click "Load comments" opt-in vs. auto-lazy-mount. Decide before ship.
- [ ] **Who owns the Cloudflare Redirect Rule setup for www → apex?** (Ops task, outside codebase.)
- [ ] **Search Console + Bing Webmaster verification ownership.** Needed before launch day.
- [ ] **Font choice + licensing (Inter variable WOFF2 is the current assumption).** Confirm before writing the `@font-face` block.
- [ ] **KaTeX CSS strategy:** keep `style-src 'unsafe-inline'` in CSP, or move KaTeX styles to a file? Phase 2 decision.
- [ ] **Should `astro-og-canvas` 0.9.x (stable Astro 6 support) be available at implementation time?** If still 0.8.0 experimental, pin the version or fall back to `astro-satori`.
- [ ] **Mermaid alternative:** if we want to eliminate the ~1.5 MB client runtime entirely, evaluate `rehype-mermaid` for build-time SVG rendering. Keeps Flow content inline, removes the single-largest JS bundle from the site.

---

## Sources (All)

Consolidated for quick re-reference.

### Astro
- [Astro — Content collections guide](https://docs.astro.build/en/guides/content-collections/)
- [Astro — Content Collections API Reference](https://docs.astro.build/en/reference/modules/astro-content/)
- [Astro — Content Loader API](https://docs.astro.build/en/reference/content-loader-reference/)
- [Astro — Upgrade to v6](https://docs.astro.build/en/guides/upgrade-to/v6/)
- [Astro — Routing Reference](https://docs.astro.build/en/reference/routing-reference/)
- [Astro — Routing guide](https://docs.astro.build/en/guides/routing/)
- [Astro — @astrojs/mdx integration](https://docs.astro.build/en/guides/integrations-guide/mdx/)
- [Astro — Markdown in Astro](https://docs.astro.build/en/guides/markdown-content/)
- [Astro — Layouts](https://docs.astro.build/en/basics/layouts/)
- [Astro — 5.2 release notes](https://astro.build/blog/astro-520/)
- [Astro — Template directives reference](https://docs.astro.build/en/reference/directives-reference/)
- [Astro — Islands architecture](https://docs.astro.build/en/concepts/islands/)
- [Astro — Front-end frameworks](https://docs.astro.build/en/guides/framework-components/)
- [Astro — Tutorial: theme toggle](https://docs.astro.build/en/tutorial/6-islands/2/)
- [Astro — View transitions](https://docs.astro.build/en/guides/view-transitions/)
- [Astro — View Transitions Router API](https://docs.astro.build/en/reference/modules/astro-transitions/)
- [Astro issue #8083 — scroll position](https://github.com/withastro/astro/issues/8083)
- [Astro issue #12725 — ClientRouter + Lenis](https://github.com/withastro/astro/issues/12725)
- [Astro View Transitions — Chrome Developers](https://developer.chrome.com/blog/astro-view-transitions)

### Tailwind
- [Tailwind — Theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind — Dark mode](https://tailwindcss.com/docs/dark-mode)
- [Tailwind — Install with Astro](https://tailwindcss.com/docs/installation/framework-guides/astro)
- [Tailwind v4 CSS-variable dark mode (discussion #15083)](https://github.com/tailwindlabs/tailwindcss/discussions/15083)

### Shiki / rehype-pretty-code
- [Rehype Pretty Code docs](https://rehype-pretty.pages.dev/)
- [Rehype Pretty Code examples](https://rehype-pretty.pages.dev/examples/)
- [Shiki — Dual themes](https://shiki.matsu.io/guide/dual-themes)
- [Shiki — Themes list](https://github.com/shikijs/shiki/blob/main/docs/themes.md)
- [rehype-pretty-code on GitHub](https://github.com/rehype-pretty/rehype-pretty-code)

### Mermaid
- [astro-mermaid on npm](https://www.npmjs.com/package/astro-mermaid)
- [joesaby/astro-mermaid](https://github.com/joesaby/astro-mermaid)
- [Lazy loading Mermaid — Rick Strahl](https://weblog.west-wind.com/posts/2025/May/10/Lazy-Loading-the-Mermaid-Diagram-Library)
- [Shrinking Mermaid — Sidharth Vinod](https://www.sidharth.dev/posts/shrinking-mermaid/)
- [Mermaid bundle-size discussion #4314](https://github.com/orgs/mermaid-js/discussions/4314)

### Pagefind
- [Pagefind — Indexing](https://pagefind.app/docs/indexing/)
- [Pagefind — Filtering](https://pagefind.app/docs/filtering/)
- [Pagefind — UI](https://pagefind.app/docs/ui/)
- [Pagefind — Component UI / Modal](https://pagefind.app/docs/search-ui/)
- [astro-pagefind (shishkin)](https://github.com/shishkin/astro-pagefind)
- [EastonDev — Astro Pagefind guide](https://eastondev.com/blog/en/posts/dev/20251203-astro-pagefind-search-guide/)

### Giscus
- [giscus README](https://github.com/giscus/giscus/blob/main/README.md)
- [Giscus ADVANCED-USAGE.md](https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md)
- [Giscus PRIVACY-POLICY.md](https://github.com/giscus/giscus/blob/main/PRIVACY-POLICY.md)
- [Giscus GDPR discussion #685](https://github.com/orgs/giscus/discussions/685)
- [Giscus issue #1200 — dynamic theme sync](https://github.com/giscus/giscus/issues/1200)
- [Daniel Garcia — Giscus in Astro](https://daniel.es/blog/2025-08-06-how-to-setup-giscus-in-astro/)

### OG Images
- [astro-og-canvas README](https://github.com/delucis/astro-og-canvas/blob/latest/packages/astro-og-canvas/README.md)
- [astro-og-canvas releases](https://github.com/delucis/astro-og-canvas/releases)
- [Diet Code — Build-time dynamic OG images](https://dietcode.io/p/astro-og/)
- [Jilles — OG Images in Astro, Build-Time vs Runtime](https://jilles.me/og-images-astro-build-vs-runtime/)
- [kevinzunigacuellar/astro-satori](https://github.com/kevinzunigacuellar/astro-satori)
- [workers-og](https://github.com/kvnang/workers-og)

### Sitemap
- [@astrojs/sitemap docs](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- [sitemap integration source](https://github.com/withastro/astro/blob/main/packages/integrations/sitemap/src/index.ts)
- [Accurate lastmod — Printezis](https://www.printezisn.com/blog/post/adding-accurate-lastmod-tags-to-your-astro-sitemap/)

### Cloudflare Pages
- [Cloudflare Pages — Redirects](https://developers.cloudflare.com/pages/configuration/redirects/)
- [Cloudflare Pages — Headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages — www-to-apex](https://developers.cloudflare.com/pages/how-to/www-redirect/)
- [Cloudflare — Origin Cache Control](https://developers.cloudflare.com/cache/concepts/cache-control/)
- [Cloudflare — CSP](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/)

### localStorage
- [MDN — Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [web.dev — Storage for the web](https://web.dev/articles/storage-for-the-web)
- [Jan Monschke — Simple frontend data migration](https://janmonschke.com/simple-frontend-data-migration/)
- [Zustand persist middleware](https://deepwiki.com/pmndrs/zustand/3.1-persist-middleware)
- [solydhq/typed-local-store](https://github.com/solydhq/typed-local-store)
- [Michal Zalecki — localStorage is a bad idea](https://michalzalecki.com/why-using-localStorage-directly-is-a-bad-idea/)
