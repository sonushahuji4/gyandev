---
title: About Page — Implementation Plan
status: draft
spec: .claude/specs/pages/about.md
created: 2026-04-20
session: 3
estimated_effort: 3–4 hours (editorial prose authoring separate)
dependencies:
  - .claude/plans/shared/routing-and-urls.md
  - .claude/plans/shared/responsive-breakpoints.md
  - .claude/plans/shared/accessibility.md
  - .claude/plans/shared/performance.md
  - .claude/plans/shared/seo.md
  - .claude/plans/pages/legal.md (prose-with-PageShell pattern)
---

# Implementation Plan: About Page

## 1. Overview

A single `/about` route that presents an editorial narrative about GyanDev — why it exists, the three-tab model, who runs it, the open-source license story, and contact/contribution paths. Technically, this is a prose page very similar to `/privacy` and `/terms`, but richer: it has an author bio block, social links, a changelog, and richer typography (serif headings + optional author photo). We source all structured data (author, socials, changelog) from a single `src/content/about.yml` (per spec §6) so non-engineering updates don't need a PR to `.astro` files. Structured data emits `AboutPage` + `Person` JSON-LD. Zero client JS.

## 2. Spec Reference

See `.claude/specs/pages/about.md`. Load-bearing requirements:

- §3 Eight sections: Hero, Why This Exists, The Three-Tab Model, Who Runs This, Open Source & License, How to Contribute, Contact, Changelog (optional).
- §4 AboutLayout: editorial prose style, max-width 720px, serif headings, 18px body, 1.6 line-height, no sidebars, single column.
- §5 Responsive: mobile full-width, tablet 600px, desktop 720px.
- §6 Data source: `about.yml` for author, socials, contact, changelog. Body prose is hard-coded or in MDX.
- §7 Meta: `<title>About — GyanDev</title>`, self-canonical.
- §8 JSON-LD: `AboutPage` with `mainEntity: Person`.
- §9 Perf: < 100 KB total, author photo < 50 KB AVIF/WebP if present.
- §10 A11y: H1, H2 per section, meaningful alt on photo, `aria-label` on icon-only social links.
- §11 Success: real content, accurate bio, working contact email, working social links, mobile verified.

## 3. Technical Approach

**3.1 Hybrid content model — YAML + MDX.** Per spec §6, structured data (author, socials, changelog) lives in `src/content/about.yml`. Prose (why-this-exists narrative, three-tab-model explanation, open-source pitch, contribute instructions) lives in `src/content/about.mdx`. The page composition reads BOTH: renders prose sections from MDX; renders author bio + social block + changelog from YAML. Keeps markup engineering clean and updates non-invasive.

**3.2 `data()` collection for `about.yml`.** Astro content layer `data` loader (introduced in Astro 5 Content Layer) reads structured data files. Alternative: plain JSON import. Decision: use the `file()` data loader pattern → `defineCollection({ loader: file('src/content/about.yml'), schema: ... })` so Zod validates structure (author.socials, changelog entries). Collection name: `site` (singular data collection for site-wide structured facts; reusable for future pages like `/authors` in Phase 2).

**3.3 Single new layout reused from legal.** `AboutLayout.astro` is essentially `LegalLayout.astro` minus the TOC and with an optional author-bio block. Rather than duplicate the component, we introduce an `<EditorialLayout>` in a future shared-plan amendment — but for Phase 1, build `AboutLayout.astro` independently to avoid blocking. Flag the dedup in §13.

**3.4 Author bio as a dedicated component.** `<AuthorBio />` takes `person` + `socials` props, renders avatar + name + role + bio + social icons. Flagged for component library because any future author page (`/authors/<name>`) uses the same primitive.

**3.5 Social icons — inline SVG, aria-labeled.** No external icon package. Hand-author three SVGs (GitHub, LinkedIn, Twitter/X) inlined in the component so no extra fetch, and they inherit `color: currentColor` for dark-mode tint. `aria-label` per link; `aria-hidden="true"` on the SVG itself.

**3.6 Author photo via `<SmartImage>`** — per `.claude/plans/shared/performance.md` §3.2, never raw `<img>`. Photo source at `public/images/author.jpg` (1024×1024 source); Astro generates AVIF + WebP variants at 240×240 display size. Meaningful alt text (e.g., "Sonu Shahuji, seated at a desk with a laptop"). If the author prefers no photo, skip the `<SmartImage>` entirely.

**3.7 JSON-LD via the schema factory.** Extend `src/lib/seo/jsonld.ts` with an `aboutPageSchema({ person })` factory. Emits nested `{ "@type": "AboutPage", "mainEntity": { "@type": "Person", ... } }`. Person schema mirrors `about.yml` contents (name, jobTitle, url: `/about`, sameAs: [socials]). Flag: `jsonld.ts` addition needs a one-line extension to the seo plan.

## 4. File Structure

```
src/
  pages/
    about.astro                                     [modify stub → /about]
  layouts/
    AboutLayout.astro                               [create — editorial prose wrapper]
  content.config.ts                                 [modify — add `site` data collection]
  content/
    about.yml                                       [create — structured data]
    about.mdx                                       [create — prose sections]
  components/
    pages/
      about/
        AboutHero.astro                             [create — H1 + tagline]
        AuthorBio.astro                             [create — avatar + bio + socials]
        SocialLinks.astro                           [create — aria-labeled icon links]
        LicenseBlock.astro                          [create — CC BY-SA + MIT explanation + repo link]
        ContributeBlock.astro                       [create — actionable paths]
        ChangelogList.astro                         [create — recent updates <ol>]
  lib/
    seo/
      jsonld.ts                                     [modify — add aboutPageSchema(), personSchema()]
public/
  images/
    author.jpg                                      [optional — add only if author supplies a photo]
```

**Sample content required:** `about.yml` + `about.mdx` with at least placeholder prose. Author photo optional.

## 5. Dependencies

**External:** none new.

**Internal — consumed:**
- `src/layouts/BaseLayout.astro`, `src/components/layout/PageShell.astro`.
- `src/components/seo/SEO.astro`, `JsonLd.astro`, `Breadcrumbs.astro`.
- `src/components/ui/SmartImage.astro` (performance plan).
- `src/lib/routes.ts` — `canonicalFor()`.
- `src/lib/seo/jsonld.ts` — extended with new factories.
- `src/styles/prose.css` — applied to MDX body.

**Internal — new:**
- `src/layouts/AboutLayout.astro`.
- Six components under `src/components/pages/about/`.

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — `/about` route stub, canonical helpers.
- `.claude/plans/shared/responsive-breakpoints.md` — PageShell, `prose.css`.
- `.claude/plans/shared/accessibility.md` — semantic headings, `aria-label` on icon links.
- `.claude/plans/shared/performance.md` — `<SmartImage>`.
- `.claude/plans/shared/seo.md` — `<SEO>`, JSON-LD factory extension.
- `.claude/plans/pages/legal.md` — mirror of the MDX-driven prose pattern.

## 6. Implementation Steps (Ordered)

1. **Extend `src/content.config.ts`** — add a `site` data collection:
   ```ts
   site: defineCollection({
     loader: file('src/content/about.yml'),
     schema: z.object({
       author: z.object({
         name: z.string(),
         role: z.string(),
         location: z.string(),
         avatar: z.string().optional(),           // e.g. '/images/author.jpg'
         bio: z.string(),
         socials: z.object({
           github:   z.string().url().optional(),
           linkedin: z.string().url().optional(),
           twitter:  z.string().url().optional(),
         }),
       }),
       contact: z.object({
         email: z.string().email(),
         responseTime: z.string().optional(),
       }),
       changelog: z.array(z.object({
         date:  z.date(),
         event: z.string(),
       })).optional(),
     }),
   }),
   ```
   - Done when: `astro check` passes and `getEntry('site', 'about')` returns typed data.

2. **Create `src/content/about.yml`** — fill with real author data. Confirm socials with owner before landing.

3. **Create `src/content/about.mdx`** — frontmatter (`title`, `description`, `updated`) + four prose sections as H2s corresponding to spec §3 Sections 2, 3, 5, 6 (Why This Exists, Three-Tab Model, Open Source, Contribute). Hero (§3.1), Author bio (§3.4), Contact (§3.7), and Changelog (§3.8) are template-driven — NOT in MDX.

4. **Create `src/components/pages/about/AboutHero.astro`:**
   - No props.
   - Renders `<h1>About GyanDev</h1>` and one `<p class="tagline">` with the standing tagline.
   - Uses serif font via `.tagline { font-family: var(--font-serif); font-size: clamp(1.125rem, 2vw, 1.375rem); }`.

5. **Create `src/components/pages/about/SocialLinks.astro`:**
   - Props: `{ socials: { github?: string; linkedin?: string; twitter?: string } }`.
   - Renders a `<ul class="socials" aria-label="Social links">` of `<li><a aria-label="GitHub (opens in new tab)" href={url} target="_blank" rel="noopener noreferrer"><GitHubIcon aria-hidden="true" /></a></li>`.
   - Three inline SVG icons sit in this file (or import from `src/components/ui/icons/`). Target size ≥ 44×44 via `TouchTarget` wrapper (a11y plan §6.15) — important for mobile tap targets.
   - Skip rendering a given social if its URL is absent in props.

6. **Create `src/components/pages/about/AuthorBio.astro`:**
   - Props: `{ author: Author }` (type from collection schema).
   - Layout: flex at `md+` (avatar left, text right); stacked on mobile.
   - If `author.avatar` present, render `<SmartImage src={author.avatar} alt={`${author.name}, ${author.role}`} width={240} height={240} />` with rounded square styling.
   - Text block: H3 `{author.name}`, role-and-location line, bio paragraph, `<SocialLinks>`.
   - Done when: on mobile, avatar stacks above text; on desktop, side-by-side; axe-core passes.

7. **Create `src/components/pages/about/LicenseBlock.astro`:**
   - No props. Static copy.
   - H2 "Open Source, Open Content". Body: bullet list (CC BY-SA 4.0 for content, MIT for code, hosted on GitHub). External link to the repo.
   - Because this content rarely changes and is tightly worded, keep it as an `.astro` component rather than MDX.

8. **Create `src/components/pages/about/ContributeBlock.astro`:**
   - No props. Static. H2 "How to Contribute". Four `<li>` items with external links (edit on GitHub, open issue, read CONTRIBUTING, sponsor).
   - Links to `CONTRIBUTING.md` (Phase 2); leave a placeholder `href="https://github.com/sonushahuji4/gyandev/blob/main/CONTRIBUTING.md"` — the file may 404 until Phase 2 authoring.

9. **Create `src/components/pages/about/ChangelogList.astro`:**
   - Props: `{ entries?: ChangelogEntry[] }`.
   - If `entries` is empty or undefined, render nothing (section hidden per spec §3.8).
   - Otherwise: H2 "Recent Updates" + `<ol>` of `<li><time datetime={entry.date.toISOString()}>{formatted}</time> — {entry.event}</li>`.
   - Limit to `entries.slice(0, 10)`.

10. **Extend `src/lib/seo/jsonld.ts`** — add factories:
    ```ts
    export function personSchema(input: {
      name: string;
      jobTitle: string;
      url: string;           // canonical about URL
      sameAs: string[];      // filtered non-empty socials
    }): Person { ... }
    export function aboutPageSchema(input: {
      url: string;
      person: ReturnType<typeof personSchema>;
    }): AboutPage { ... }
    ```
    - Flag for seo plan update: add these factories to `.claude/plans/shared/seo.md` §6 Step 3 component list.

11. **Create `src/layouts/AboutLayout.astro`:**
    ```astro
    ---
    import PageShell from '../components/layout/PageShell.astro';
    import AboutHero from '../components/pages/about/AboutHero.astro';
    import AuthorBio from '../components/pages/about/AuthorBio.astro';
    import LicenseBlock from '../components/pages/about/LicenseBlock.astro';
    import ContributeBlock from '../components/pages/about/ContributeBlock.astro';
    import ChangelogList from '../components/pages/about/ChangelogList.astro';
    import Breadcrumbs from '../components/seo/Breadcrumbs.astro';
    import { aboutPageSchema, personSchema } from '../lib/seo/jsonld';
    import { canonicalFor } from '../lib/routes';
    import type { CollectionEntry } from 'astro:content';

    export interface Props {
      site: CollectionEntry<'site'>;
      mdxTitle: string;
      mdxDescription: string;
    }
    const { site, mdxTitle, mdxDescription } = Astro.props;
    const canonical = canonicalFor('/about');
    const person = personSchema({
      name: site.data.author.name,
      jobTitle: site.data.author.role,
      url: canonical,
      sameAs: Object.values(site.data.author.socials).filter(Boolean) as string[],
    });
    const jsonLd = aboutPageSchema({ url: canonical, person });
    ---
    <PageShell
      title={mdxTitle}
      description={mdxDescription}
      canonical={canonical}
      jsonLd={[jsonLd]}
      ogImage={canonicalFor('/og/about.png')}
    >
      <article class="prose about">
        <Breadcrumbs items={[
          { name: 'Home', url: canonicalFor('/') },
          { name: 'About', url: canonical },
        ]} />
        <AboutHero />
        <slot />  <!-- MDX prose: Why, Three-Tab Model sections -->
        <AuthorBio author={site.data.author} />
        <LicenseBlock />
        <ContributeBlock />
        <section aria-labelledby="contact-h">
          <h2 id="contact-h">Contact</h2>
          <p>Email: <a href={`mailto:${site.data.contact.email}`}>{site.data.contact.email}</a></p>
          {site.data.contact.responseTime && <p>Response time: {site.data.contact.responseTime}</p>}
        </section>
        <ChangelogList entries={site.data.changelog} />
      </article>
    </PageShell>
    ```

12. **Replace `src/pages/about.astro`:**
    ```astro
    ---
    import { getEntry, render } from 'astro:content';
    import AboutLayout from '../layouts/AboutLayout.astro';

    const site = await getEntry('site', 'about');
    if (!site) throw new Error('Missing src/content/about.yml');
    const aboutMdx = await getEntry('legal', 'about'); // reuse? No — use its own slot.
    // Use a separate MDX entry; not in the `legal` collection.
    // For about prose: load directly via import (since `about.mdx` lives in /content/ but is not a collection entry here).
    // Simplest: put about.mdx into the existing `pages` collection OR load it via `import aboutMdx from '../content/about.mdx';`
    // Decision: direct import since there's only one about.mdx.
    ---
    ```
    **Decision**: since about.mdx is a one-off, use Astro's direct MDX import rather than a content collection:
    ```astro
    ---
    import { getEntry } from 'astro:content';
    import AboutLayout from '../layouts/AboutLayout.astro';
    import AboutProse, { frontmatter } from '../content/about.mdx';

    const site = await getEntry('site', 'about');
    if (!site) throw new Error('Missing src/content/about.yml');
    ---
    <AboutLayout site={site} mdxTitle={frontmatter.title} mdxDescription={frontmatter.description}>
      <AboutProse />
    </AboutLayout>
    ```
    - Astro supports `import Content, { frontmatter } from './file.mdx'` directly. Simpler than a single-entry collection.

13. **Build-time OG image.** Per seo plan, `src/pages/og/about.png.ts` generates `/og/about.png` via `OGImageRoute` (seo.md §6 Step 10). Confirm entry exists for the About static page.

14. **Verify no client JS.** `npm run build && grep -r "client:" src/pages/about.astro src/layouts/AboutLayout.astro src/components/pages/about/` should return zero hits. Social links are plain `<a>`; SmartImage is SSR.

## 7. Component/Module API Design

### `src/layouts/AboutLayout.astro`
```ts
interface Props {
  site: CollectionEntry<'site'>;
  mdxTitle: string;
  mdxDescription: string;
}
```
Slot: rendered `about.mdx` body.

### `src/components/pages/about/AboutHero.astro`
```ts
interface Props {} // no props
```

### `src/components/pages/about/AuthorBio.astro`
```ts
interface Props {
  author: {
    name: string;
    role: string;
    location: string;
    avatar?: string;
    bio: string;
    socials: Record<'github' | 'linkedin' | 'twitter', string | undefined>;
  };
}
```

### `src/components/pages/about/SocialLinks.astro`
```ts
interface Props {
  socials: Record<'github' | 'linkedin' | 'twitter', string | undefined>;
}
```

### `src/components/pages/about/LicenseBlock.astro`
```ts
interface Props {} // no props, static copy
```

### `src/components/pages/about/ContributeBlock.astro`
```ts
interface Props {} // no props, static copy
```

### `src/components/pages/about/ChangelogList.astro`
```ts
interface Props {
  entries?: Array<{ date: Date; event: string }>;
}
```

### Extended `src/lib/seo/jsonld.ts`
```ts
function personSchema(input: { name; jobTitle; url; sameAs }): Person;
function aboutPageSchema(input: { url; person }): AboutPage;
```

### New components flagged for component library
- `AuthorBio` — reusable for `/authors/<name>` Phase 2 pages.
- `SocialLinks` — reusable anywhere a profile block appears.
- Flag `EditorialLayout` consolidation: `AboutLayout` and `LegalLayout` share 80% of their structure. In Phase 2, refactor into one shared `EditorialLayout` parameterized by (header slot, prose slot, footer slot). Not worth doing preemptively for two pages.

### Extension to seo plan
- `personSchema()` and `aboutPageSchema()` added to `jsonld.ts`. Update `.claude/plans/shared/seo.md` §6 Step 3 component list and §7 API section.

## 8. Code Patterns

**Pattern: Structured data in YAML, prose in MDX, composition in a layout.**
```astro
const site = await getEntry('site', 'about');
import AboutProse, { frontmatter } from '../content/about.mdx';
<AboutLayout site={site} ...><AboutProse /></AboutLayout>
```

**Pattern: Named social links with icon-only a11y.**
```astro
<a href={socials.github} aria-label="GitHub profile (opens in new tab)" target="_blank" rel="noopener noreferrer">
  <GitHubIcon aria-hidden="true" />
</a>
```

**Pattern: Conditional render instead of empty sections.** Changelog hidden if the `changelog` YAML key is missing or empty — don't render an empty H2.

**Pattern: Hybrid data+prose using direct MDX import.** For single-file content, skip a content collection — direct import is cleaner:
```astro
import Content, { frontmatter } from '../content/about.mdx';
```

## 9. Testing Strategy

**Build:**
- `npm run build` produces `dist/about.html`.
- JSON-LD block contains `@type: AboutPage` with nested `@type: Person`; `sameAs` contains only non-empty URLs.

**SEO:**
- Rich Results Test: validates `AboutPage` + `Person`.
- Sitemap includes `/about` with `priority: 0.5` (seo plan serialize rule).
- Canonical self-references.
- OG image `/og/about.png` exists and Facebook / Twitter debug tools render it.

**A11y:**
- axe-core green.
- VoiceOver: H1 on focus after page-load.
- Social icons: SR reads "GitHub profile (opens in new tab)" etc.
- Author photo alt text meaningful (not empty, not filename).
- Touch targets ≥ 44×44 on social icons.

**Perf:**
- Lighthouse desktop: perf ≥ 90, a11y ≥ 95, SEO ≥ 95.
- Total page weight < 100 KB excluding the author photo; if photo present, + ≤ 50 KB AVIF.
- Bundle-size check (performance plan) passes.

**Manual:**
- Mobile 375px: avatar stacks, prose wraps, social icons tappable.
- Tablet 768px: content centered at ~600px.
- Desktop 1280px: content centered at 720px.
- Theme toggle: author photo and icons render correctly in both themes.

## 10. Rollout Plan

1. Shared plans land first (PageShell, SEO, Breadcrumbs, SmartImage, jsonld.ts extension).
2. Land collection schema + `about.yml` + `about.mdx` stub (Steps 1–3) in one PR.
3. Land layout + components (Steps 4–11) in the next PR; wire route in Step 12.
4. Land OG route (Step 13) with the seo plan's OG pipeline PR (or immediately after).
5. Editorial pass on `about.yml` + `about.mdx` prose is the final gate before public launch.

**Sample content required:**
- `about.yml` with at minimum the author object + contact object. Changelog optional.
- `about.mdx` with the four H2 prose sections (placeholder text OK for engineering validation).
- Optional: author photo at `public/images/author.jpg`.

## 11. Risks and Mitigations

- **Risk: `about.yml` and `about.mdx` drift (e.g., prose still says "DevNotes" while YAML says "GyanDev").**
  - Likelihood: medium
  - Impact: low (editorial only)
  - Mitigation: editorial review before public launch; both files updated in the same PR.

- **Risk: Social URL changes without JSON-LD update.**
  - Likelihood: low (single source of truth — YAML)
  - Impact: low (stale `sameAs`)
  - Mitigation: any change to `about.yml` re-generates JSON-LD on next build.

- **Risk: Author photo is missing or broken, breaking `<SmartImage>`.**
  - Likelihood: low
  - Impact: low
  - Mitigation: `AuthorBio` renders photo only if `author.avatar` is set. No stale `<img src="">`.

- **Risk: `AboutLayout` and `LegalLayout` diverge in typography over time.**
  - Likelihood: medium
  - Impact: low (inconsistent prose styling)
  - Mitigation: both pull from `prose.css`. In Phase 2, consolidate into `EditorialLayout`.

- **Risk: `personSchema` `sameAs` validator rejects an empty-string entry.**
  - Likelihood: medium (missing social → empty string from YAML)
  - Impact: low
  - Mitigation: filter `Object.values(socials).filter(Boolean)` before passing — already specified in Step 11.

- **Risk: `CONTRIBUTING.md` link 404s because the file doesn't exist yet.**
  - Likelihood: high
  - Impact: low
  - Mitigation: land with broken link now; `validate-slugs.mjs` external-link check is punted to Phase 2 (routing plan §11). Add a `CONTRIBUTING.md` stub during launch prep.

## 12. Done When

- [ ] `src/content.config.ts` includes the `site` data collection with Zod schema.
- [ ] `src/content/about.yml` exists with valid structure.
- [ ] `src/content/about.mdx` exists with at least the four prose H2s.
- [ ] `src/layouts/AboutLayout.astro` composes hero, MDX slot, bio, license, contribute, contact, changelog.
- [ ] All six page components under `src/components/pages/about/` exist.
- [ ] `src/lib/seo/jsonld.ts` exports `personSchema()` and `aboutPageSchema()`.
- [ ] `src/pages/about.astro` renders via `AboutLayout` and passes `astro check`.
- [ ] `dist/about.html` contains correct meta, JSON-LD, and canonical `/about`.
- [ ] `dist/og/about.png` generated.
- [ ] axe-core green; touch targets ≥ 44 on social icons.
- [ ] Lighthouse desktop perf ≥ 90, a11y ≥ 95, SEO ≥ 95.
- [ ] Zero client-side JS on the page.

## 13. Open Questions

- [ ] **Author photo inclusion** — spec §3.4 shows `[Avatar]` optional. Confirm whether owner wants a photo. If yes, provide a 1024×1024 source.
- [ ] **Social networks** — spec lists LinkedIn + GitHub + Twitter. Adding Mastodon / BlueSky / YouTube later = adding fields in YAML + icons in `SocialLinks`. Which should ship in Phase 1?
- [ ] **Twitter vs X branding** — icon + label.
- [ ] **`AboutLayout` / `LegalLayout` consolidation** — defer to Phase 2 `EditorialLayout`.
- [ ] **Changelog source of truth** — YAML is convenient but could drift from git history. Alternative: parse `git log --format='%cs %s'` and auto-generate. Phase 2 decision.
- [ ] **Press / Media section** — spec §12 flags. Defer until first press mention.
- [ ] **Sponsor list** — spec §12 flags. Defer.
- [ ] **Stats block (readers/chapters/stars)** — spec §12. Requires Cloudflare Analytics API or GitHub stars fetch at build time. Phase 2.

## 14. References

- Spec: `.claude/specs/pages/about.md`
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — `/about` route, BaseLayout.
  - `.claude/plans/shared/responsive-breakpoints.md` — PageShell, prose.css.
  - `.claude/plans/shared/accessibility.md` — heading hierarchy, aria-label icons.
  - `.claude/plans/shared/performance.md` — SmartImage, bundle budgets.
  - `.claude/plans/shared/seo.md` — SEO component, JSON-LD factories, OG pipeline.
  - `.claude/plans/pages/legal.md` — prose-with-PageShell pattern.
- External:
  - [Schema.org AboutPage](https://schema.org/AboutPage)
  - [Schema.org Person](https://schema.org/Person)
  - [Astro Content Layer — file loader](https://docs.astro.build/en/reference/content-loader-reference/#file-loader)
  - [Astro — MDX imports and frontmatter](https://docs.astro.build/en/guides/integrations-guide/mdx/)
