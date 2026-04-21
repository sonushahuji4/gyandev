---
title: Legal Pages (Privacy + Terms) — Implementation Plan
status: draft
spec: .claude/specs/pages/legal.md
created: 2026-04-20
session: 3
estimated_effort: 3–4 hours (plus content-writing time for prose, which is a separate editorial task)
dependencies:
  - .claude/plans/shared/routing-and-urls.md
  - .claude/plans/shared/responsive-breakpoints.md
  - .claude/plans/shared/accessibility.md
  - .claude/plans/shared/seo.md
  - .claude/plans/shared/performance.md
---

# Implementation Plan: Legal Pages (Privacy + Terms)

## 1. Overview

Two near-identical prose pages — `/privacy` and `/terms` — that share one MDX-driven layout. Both are structurally the same (hero, last-updated date, auto-generated TOC, numbered prose sections, contact block) and differ only in content. We introduce one new page-scoped layout (`LegalLayout.astro`) that wraps `PageShell` and reads content from MDX files under `src/content/legal/`. The plan adds a small `legal` content collection so the `updated` date and TOC can be validated by Zod and read from frontmatter rather than hand-edited in the template. A `<TOC>` component generated from the MDX's `headings` export renders an in-page anchor list at the top; visual styling comes from the shared `prose.css`. No JS required.

## 2. Spec Reference

See `.claude/specs/pages/legal.md`. Load-bearing requirements:

- §3 Shared layout structure: breadcrumbs → title → "Last updated" → TOC → sections → contact block. Single-column, max-width 720px, no sidebars.
- §4 Privacy content outline (13 sections from Introduction → Contact).
- §5 Terms content outline (13 sections from Acceptance → Contact).
- §6 Meta tags per page with self-canonical URLs.
- §7 Mobile full-width, desktop 720px centered.
- §8 Data source: MDX files with `updated_at` frontmatter; linked from global footer.
- §9 A11y: H1 title, H2 per numbered section, TOC anchors, `<ol>` for numbered sections.
- §10 Success: GDPR/CCPA/DPDPA review, last-updated accurate, links valid, "readable in 5 minutes".

## 3. Technical Approach

**3.1 MDX content collection, not hard-coded prose.** The spec calls for "content is hard-coded in MDX files". We formalize this as a small `legal` content collection under `src/content/legal/` so Zod validates frontmatter (title, description, `updated` date), the same MDX pipeline (`rehype-pretty-code`, links, etc.) runs, and content authors can revise policy text without touching `.astro` files. Collection shape is defined in `src/content.config.ts` (already stubbed by the routing plan — we enrich it here).

**3.2 One layout, two routes.** Both `/privacy` and `/terms` are tiny Astro pages that load the corresponding MDX entry, extract `headings`, and render a common `LegalLayout` wrapping `PageShell`. The layout owns the breadcrumbs, title, updated-date line, TOC, prose wrapper (`.prose`), and contact block. The MDX body is the numbered sections only.

**3.3 Build-time TOC, no IntersectionObserver needed.** Unlike chapter pages (which get a sticky right-TOC with scroll-sync), legal pages use a simple inline `<nav aria-label="Contents">` at the top of the content. No scroll sync → no JS. The `headings` array that Astro auto-exports from MDX (depth, slug, text) is the only input — filter to depth ≤ 2.

**3.4 Footer wiring.** Per spec §8, every page footer links to `/privacy` and `/terms`. The global footer component is currently a TODO flagged in `.claude/plans/shared/responsive-breakpoints.md` Step 11 — this plan does NOT build the footer, it only ensures the two URLs exist. Home plan (`home.md`) or an addendum to the responsive plan owns the footer build.

**3.5 No JSON-LD.** Privacy/Terms are informational; Google doesn't use rich results for them. We omit JSON-LD to avoid maintenance cost. A `BreadcrumbList` is the only arguable schema — add if and only if a crawl audit flags its absence later.

**3.6 `updated` date stays honest.** The MDX frontmatter `updated` field is the only authoritative source. We add a pre-commit hook hint in §11 and a CI check in Step 8 that fails if the `updated` date in a legal MDX file is older than the last git commit that modified the file.

## 4. File Structure

```
src/
  pages/
    privacy.astro                                   [modify stub → /privacy]
    terms.astro                                     [modify stub → /terms]
  layouts/
    LegalLayout.astro                               [create — wraps PageShell + breadcrumbs + TOC + prose]
  content.config.ts                                 [modify — add `legal` collection]
  content/
    legal/
      privacy.mdx                                   [create — content]
      terms.mdx                                     [create — content]
  components/
    pages/
      legal/
        LegalHeader.astro                           [create — title + updated-date + breadcrumbs]
        LegalTOC.astro                              [create — anchor list from headings prop]
        LegalContact.astro                          [create — shared contact block rendered after MDX body]
scripts/
  check-legal-freshness.mjs                         [create — CI: fail if updated date < last git mod date]
```

**Existing files this plan touches:**
- `src/pages/privacy.astro` and `src/pages/terms.astro` exist as stubs from `.claude/plans/shared/routing-and-urls.md` Step 6 — replace their bodies.
- `src/content.config.ts` exists as a stub — add the `legal` collection.

**Test content needed:** Two MDX files with at least the frontmatter and three H2s each. Prose text can be placeholder at landing time; compliance-reviewed prose ships before public launch (editorial gate, not an engineering blocker).

## 5. Dependencies

**External:** none new beyond what shared plans installed.

**Internal — consumed:**
- `src/layouts/BaseLayout.astro` (routing plan).
- `src/components/layout/PageShell.astro` (responsive plan).
- `src/components/seo/SEO.astro` + `src/components/seo/Breadcrumbs.astro` (seo plan).
- `src/lib/routes.ts` — `canonicalFor()`.
- `src/styles/prose.css` (responsive plan) — applied to MDX body.
- `@astrojs/mdx` (infrastructure plan).

**Internal — new:**
- `src/layouts/LegalLayout.astro`.
- `src/components/pages/legal/LegalHeader.astro`.
- `src/components/pages/legal/LegalTOC.astro`.
- `src/components/pages/legal/LegalContact.astro`.
- `scripts/check-legal-freshness.mjs`.

**Plan dependencies:**
- `.claude/plans/shared/routing-and-urls.md` — privacy/terms route stubs, BaseLayout props.
- `.claude/plans/shared/responsive-breakpoints.md` — PageShell, `prose.css`.
- `.claude/plans/shared/accessibility.md` — semantic headings, TOC is a `<nav aria-label>`.
- `.claude/plans/shared/seo.md` — `<SEO>`, `<Breadcrumbs>`.
- `.claude/plans/shared/performance.md` — no JS; static HTML.

## 6. Implementation Steps (Ordered)

1. **Enrich `src/content.config.ts`** — add a `legal` collection:
   ```ts
   legal: defineCollection({
     loader: glob({ pattern: '**/*.mdx', base: './src/content/legal' }),
     schema: z.object({
       title: z.string(),
       description: z.string(),
       updated: z.date(),               // enforce real Date parsing
       effective: z.date().optional(),
       contact: z.object({
         email: z.string().email(),
         responseTime: z.string().optional(),
       }),
     }),
   }),
   ```
   - Done when: `astro check` passes with the two MDX files in place.

2. **Create `src/content/legal/privacy.mdx`** — frontmatter + at minimum stubbed H2s matching spec §4 (Introduction, What We Collect, What We Do NOT Collect, Cookies, How Your Data Is Used, Data Sharing, Your Rights, Children's Privacy, International Data Transfers, Security, Changes to This Policy, Jurisdiction, Contact). Prose can be placeholder text initially; final copy is a separate editorial gate.
   - Frontmatter must include `updated: 2026-04-20` and `contact: { email: 'privacy@gyandev.org', responseTime: 'usually within 48 hours' }`.

3. **Create `src/content/legal/terms.mdx`** — same pattern with the 13 H2s from spec §5 (Acceptance, License to You, Your License to Us, Acceptable Use, No Warranty, External Links, Third-Party Services, Intellectual Property, Indemnification, Termination, Changes to Terms, Governing Law, Contact). `contact: { email: 'legal@gyandev.org' }`.

4. **Create `src/components/pages/legal/LegalHeader.astro`:**
   ```astro
   ---
   export interface Props {
     title: string;
     updated: Date;
     slug: 'privacy' | 'terms';
   }
   const { title, updated, slug } = Astro.props;
   const label = slug === 'privacy' ? 'Privacy' : 'Terms';
   ---
   <Breadcrumbs items={[
     { name: 'Home', url: canonicalFor('/') },
     { name: label, url: canonicalFor(`/${slug}`) },
   ]} />
   <h1>{title}</h1>
   <p class="updated">
     Last updated:
     <time datetime={updated.toISOString()}>
       {updated.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
     </time>
   </p>
   ```
   - Uses `<Breadcrumbs>` from seo plan (renders both visual breadcrumb + JSON-LD BreadcrumbList — acceptable even though §3.5 argues against JSON-LD for the page body; a breadcrumb trail is cheap and well-understood).
   - Done when: rendered header shows breadcrumb → H1 → "Last updated: Apr 20, 2026".

5. **Create `src/components/pages/legal/LegalTOC.astro`:**
   ```astro
   ---
   import type { MarkdownHeading } from 'astro';
   export interface Props { headings: MarkdownHeading[]; }
   const items = Astro.props.headings.filter((h) => h.depth === 2);
   ---
   <nav aria-label="Contents" class="legal-toc">
     <ol>
       {items.map((h) => (
         <li><a href={`#${h.slug}`}>{h.text}</a></li>
       ))}
     </ol>
   </nav>
   ```
   - Done when: `<nav aria-label="Contents">` exists with one `<li>` per H2 and clicking an item jumps to the anchor.

6. **Create `src/components/pages/legal/LegalContact.astro`:**
   - Props: `{ email: string; responseTime?: string }`.
   - Renders a `<section aria-labelledby="contact">` with an H2 "Contact", an email `<a href="mailto:">`, and optional response-time line.
   - Exists separately from the MDX "Contact" H2 because the section text is templated from frontmatter (`contact.email`) rather than hand-written — decouples copy from content author's email typos.

7. **Create `src/layouts/LegalLayout.astro`** — the per-page composition:
   ```astro
   ---
   import PageShell from '../components/layout/PageShell.astro';
   import LegalHeader from '../components/pages/legal/LegalHeader.astro';
   import LegalTOC from '../components/pages/legal/LegalTOC.astro';
   import LegalContact from '../components/pages/legal/LegalContact.astro';
   import type { CollectionEntry } from 'astro:content';
   import type { MarkdownHeading } from 'astro';
   import { canonicalFor } from '../lib/routes';
   export interface Props {
     entry: CollectionEntry<'legal'>;
     headings: MarkdownHeading[];
     slug: 'privacy' | 'terms';
   }
   const { entry, headings, slug } = Astro.props;
   const canonical = canonicalFor(`/${slug}`);
   ---
   <PageShell
     title={entry.data.title}
     description={entry.data.description}
     canonical={canonical}
   >
     <article class="prose legal">
       <LegalHeader title={entry.data.title} updated={entry.data.updated} slug={slug} />
       <LegalTOC headings={headings} />
       <slot />
       <LegalContact email={entry.data.contact.email} responseTime={entry.data.contact.responseTime} />
     </article>
   </PageShell>
   ```

8. **Replace `src/pages/privacy.astro`:**
   ```astro
   ---
   import { getEntry, render } from 'astro:content';
   import LegalLayout from '../layouts/LegalLayout.astro';

   const entry = await getEntry('legal', 'privacy');
   if (!entry) throw new Error('Missing src/content/legal/privacy.mdx');
   const { Content, headings } = await render(entry);
   ---
   <LegalLayout entry={entry} headings={headings} slug="privacy">
     <Content />
   </LegalLayout>
   ```

9. **Replace `src/pages/terms.astro`** — identical to Step 8 with `'terms'` in both `getEntry` + `slug` prop.

10. **Create `scripts/check-legal-freshness.mjs`:**
    - For each file in `src/content/legal/*.mdx`:
      - Parse frontmatter, extract `updated`.
      - Run `git log -1 --format=%cs -- <file>` to get the last commit date for that file.
      - If `updated < lastCommitDate`, exit 1 with "privacy.mdx was modified on YYYY-MM-DD but frontmatter `updated: YYYY-MM-DD` is older — bump the date".
    - Add `"check:legal": "node scripts/check-legal-freshness.mjs"` + wire into CI (`.github/workflows/ci.yml`).
    - Done when: editing `privacy.mdx` without bumping `updated:` fails CI.

11. **Update global footer links** (if the footer is built in `home.md` plan): ensure footer contains `/privacy` and `/terms` anchors. If the footer is still a stub at integration time, flag in SESSION-LOG so whichever plan owns the footer wires these anchors.

## 7. Component/Module API Design

### `src/layouts/LegalLayout.astro`
```ts
interface Props {
  entry: CollectionEntry<'legal'>;
  headings: MarkdownHeading[];
  slug: 'privacy' | 'terms';
}
```
Slot: rendered MDX body (`<Content />`).

### `src/components/pages/legal/LegalHeader.astro`
```ts
interface Props {
  title: string;
  updated: Date;
  slug: 'privacy' | 'terms';
}
```

### `src/components/pages/legal/LegalTOC.astro`
```ts
interface Props { headings: MarkdownHeading[]; }
```

### `src/components/pages/legal/LegalContact.astro`
```ts
interface Props { email: string; responseTime?: string; }
```

### Components consumed (no new API)
- `PageShell` (responsive plan).
- `<Breadcrumbs>` (seo plan).

### New components flagged for component library
- `LegalLayout` — a reusable "prose-with-TOC" layout. Promote to the shared component library (`.claude/plans/shared/component-library.md`) under `layouts/` because a future `/changelog` or `/contributing` page could reuse it unchanged with a different collection name.
- `LegalTOC` — could graduate to a shared `<InlineTOC>` if another page adopts the same pattern; keep page-scoped for now.
- `LegalHeader`, `LegalContact` — page-scoped; not promoted.

## 8. Code Patterns

**Pattern: Content-driven legal page.** Template reads MDX; prose is not embedded in `.astro`:
```astro
const entry = await getEntry('legal', 'privacy');
const { Content, headings } = await render(entry);
```

**Pattern: TOC from Astro's `headings` export.** No `remark-toc` plugin, no manual duplication:
```astro
<LegalTOC headings={headings.filter((h) => h.depth === 2)} />
```

**Pattern: `<time datetime>` for machine-readable dates.**
```astro
<time datetime={updated.toISOString()}>
  {updated.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
</time>
```
Search engines and assistive tech get the ISO form; humans get the friendly form.

**Pattern: `<article class="prose legal">`** — reuses `prose.css` typography and scopes any legal-only tweaks under `.legal`.

## 9. Testing Strategy

**Build:**
- `npm run build` produces `dist/privacy.html` and `dist/terms.html`.
- Both files contain every H2 id as a reachable anchor.

**A11y:**
- axe-core: zero serious/critical on both URLs.
- `<h1>` exactly once per page; no level skips.
- `<nav aria-label="Contents">` present; `<ol>` items are real `<a href>`.
- 200% zoom: TOC and prose reflow cleanly.

**SEO:**
- View Source confirms `<link rel="canonical" href="https://gyandev.org/privacy">` on privacy page, `/terms` on terms page.
- Sitemap contains both URLs with `priority: 0.3` per `seo.md` serialize rules.

**Freshness:**
- `npm run check:legal` runs in CI; an intentionally-stale `updated:` fails.

**Manual:**
- Mobile 375px: prose wraps, TOC is tappable, headings use `clamp()` scale.
- Desktop 1280px: content centered at 720px max, TOC fits above body.
- Email `mailto:` links open in default client.

**Compliance (editorial gate, not CI):**
- Privacy prose reviewed by someone familiar with GDPR, CCPA, DPDPA before public launch. This plan does NOT attempt legal review — it delivers the container; the contents go through the owner's editorial process.

## 10. Rollout Plan

1. Depends on shared plans landing first (PageShell, prose.css, Breadcrumbs).
2. Land collection schema + placeholder MDX (Steps 1–3) in one PR.
3. Land layout + components + route bodies (Steps 4–9) in the next PR.
4. Land freshness check script (Step 10) last — it only fires once real content-with-dates lands.
5. Compliance review of prose happens in parallel, blocks public launch but not the engineering work.

**Sample content required:** Two MDX files with at least title + updated + three H2s each. Placeholder prose is acceptable for engineering validation; compliance-reviewed prose is required before public launch.

## 11. Risks and Mitigations

- **Risk: `updated:` date drifts from actual last modification.**
  - Likelihood: high (author forgets to bump)
  - Impact: medium (legal signal goes stale)
  - Mitigation: `scripts/check-legal-freshness.mjs` in CI (Step 10); add a pre-commit hook in a later infrastructure PR.

- **Risk: Compliance review flags required additions (e.g., a DPO contact, a specific cookie disclosure).**
  - Likelihood: high (legal is opinionated)
  - Impact: low (prose edits only)
  - Mitigation: the MDX collection is the editable surface — adding a new H2 is a prose edit; no engineering change needed.

- **Risk: "Last updated" date rendering differs across locales.**
  - Likelihood: low (we hard-code `en-US`)
  - Impact: low
  - Mitigation: use a fixed locale string until the site supports i18n (Phase 2).

- **Risk: Anchor slugs collide with reserved terms (e.g., "contact" appears twice because both `LegalContact` and an MDX H2 are both "Contact").**
  - Likelihood: medium
  - Impact: low (duplicate anchor, warning)
  - Mitigation: name the template section "Questions?" instead of a second "Contact" — eliminates collision. OR drop the MDX "Contact" H2 and rely entirely on the template's `LegalContact` block. Default: drop the MDX "Contact" H2 and let `LegalContact` own the final section (Steps 2 and 3 MDX frontmatter list 12 H2s, not 13).

- **Risk: The breadcrumb adds a `BreadcrumbList` JSON-LD on /privacy, /terms — search consoles might flag "non-article pages shouldn't have breadcrumbs".**
  - Likelihood: low
  - Impact: low
  - Mitigation: Breadcrumbs on policy pages are accepted practice. If Rich Results Test complains, drop the JSON-LD by passing a `jsonLd={false}` flag to `<Breadcrumbs>` (extension to the seo plan).

## 12. Done When

- [ ] `src/content.config.ts` defines the `legal` collection with Zod schema.
- [ ] `src/content/legal/privacy.mdx` and `terms.mdx` exist with valid frontmatter and at least stubbed H2 sections.
- [ ] `src/layouts/LegalLayout.astro` renders header + TOC + body slot + contact block.
- [ ] `/privacy` and `/terms` build to flat `.html` files and pass `astro check`.
- [ ] Self-canonical `<link>` on each page.
- [ ] Sitemap includes both URLs.
- [ ] `scripts/check-legal-freshness.mjs` passes in CI and fails when a file is modified without bumping `updated:`.
- [ ] axe-core green on both pages; 200% zoom clean.
- [ ] Both pages linked from global footer (via whichever plan owns the footer).
- [ ] Lighthouse perf ≥ 90, a11y ≥ 95.

## 13. Open Questions

- [ ] **Compliance review owner** — spec §10 requires GDPR/CCPA/DPDPA review. Who signs off before public launch? Not an engineering blocker but a launch gate.
- [ ] **Imprint page (German TMG §5)** — spec §11 carryover. Defer unless German traffic appears.
- [ ] **Privacy changelog** — spec §11 asks for versioned policy history. Out of Phase 1 scope; design a `changelog.mdx` in the same collection if needed later.
- [ ] **Cloudflare DPA** — document in prose (Section 9 of privacy) rather than a separate page.
- [ ] **Should the template section be "Questions?" or "Contact"?** — naming decision; removes duplicate-anchor risk. Default per §11.4: "Questions?".
- [ ] **Is the `BreadcrumbList` JSON-LD overhead worth it on legal pages?** — defaulting yes (cheap; no harm). Revisit only if Search Console flags.
- [ ] **Link to LICENSE files** — spec §5 Section 2 promises "link to LICENSE files in GitHub repo". Repo paths are `LICENSE-content.md` (CC BY-SA) and `LICENSE-code.md` (MIT). Confirm paths during prose authoring.

## 14. References

- Spec: `.claude/specs/pages/legal.md`
- Related plans:
  - `.claude/plans/shared/routing-and-urls.md` — privacy/terms route stubs, BaseLayout props.
  - `.claude/plans/shared/responsive-breakpoints.md` — PageShell, `prose.css`.
  - `.claude/plans/shared/accessibility.md` — semantic H1/H2, `<nav aria-label>` TOC.
  - `.claude/plans/shared/seo.md` — `<SEO>`, `<Breadcrumbs>`, sitemap priority.
  - `.claude/plans/shared/performance.md` — no JS, static HTML budget.
- External:
  - [GDPR — full text](https://gdpr.eu/)
  - [CCPA — California AG](https://oag.ca.gov/privacy/ccpa)
  - [DPDPA 2023 — India](https://www.meity.gov.in/content/digital-personal-data-protection-act-2023)
  - [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)
  - [MDN — `<time>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time)
