---
title: Website Overview — Implementation Plan (Roadmap)
status: draft
spec: .claude/specs/shared/website-overview.md
created: 2026-04-20
session: 2
estimated_effort: (this file is a roadmap — no direct implementation work)
dependencies:
  - .claude/plans/RESEARCH.md
  - .claude/plans/00-infrastructure.md
  - .claude/plans/shared/routing-and-urls.md
  - .claude/plans/shared/responsive-breakpoints.md
  - .claude/plans/shared/accessibility.md
  - .claude/plans/shared/performance.md
  - .claude/plans/shared/seo.md
---

# Implementation Plan: Website Overview (Roadmap)

## 1. Overview

This file is the index of implementation plans — the engineering-side counterpart to `specs/shared/website-overview.md`. It does NOT introduce new technical decisions; it summarizes the cross-cutting plans, maps spec → plan → implementation order, and lists the Phase 1 critical path. Every implementation PR should be traceable back to a plan here, which is traceable back to a spec.

## 2. Spec Reference

See `.claude/specs/shared/website-overview.md`. Load-bearing requirements this roadmap honors:

- Phase 1 ships 10 page templates + 5 auto-generated resources.
- Three-tab chapter model (Full Notes, Quick Revision, Flow Diagram) with Full Notes canonical.
- No accounts, static-first, no backend.
- Every spec has a matching plan; same filename in `/plans/` vs `/specs/`.

## 3. Technical Approach

The site is composed by layering six shared plans underneath page-specific plans (Session 3). Dependency order is:

```
infrastructure (00-infrastructure.md)
        │
        ▼
  routing-and-urls ──┐
        │            │
        ▼            │
  responsive-breakpoints ─┐
        │               │
        ▼               ▼
  accessibility ─────► performance ─────► seo
        │                                   │
        └────────────── page plans ◄────────┘
                      (Session 3)
```

Everything in Session 2 is plumbing. Session 3 composes pages on top of it.

## 4. File Structure

This plan file itself creates no code. For the overall tree, see the combination of other plans. Top-level directories that will exist after all Session 2 plans are implemented:

```
.
├─ astro.config.mjs                (modified)
├─ package.json                    (new deps: astro-og-canvas, canvaskit-wasm, schema-dts, @lhci/cli, pa11y-ci, @axe-core/cli, playwright)
├─ .lighthouserc.js
├─ .pa11yci.json
├─ .github/
│  ├─ workflows/ci.yml
│  └─ pull_request_template.md
├─ docs/
│  ├─ A11Y.md
│  ├─ PERF.md
│  └─ SEO.md
├─ public/
│  ├─ _redirects
│  ├─ _headers
│  ├─ robots.txt
│  ├─ og/default.png
│  └─ fonts/*.woff2
├─ scripts/
│  ├─ validate-slugs.mjs
│  ├─ check-contrast.mjs
│  ├─ check-bundle-size.mjs
│  ├─ validate-schema.mjs
│  └─ submit-sitemap.mjs            (optional)
└─ src/
   ├─ content.config.ts
   ├─ layouts/BaseLayout.astro
   ├─ pages/*                      (11 route files from routing plan + feeds from seo plan + og routes)
   ├─ components/
   │  ├─ a11y/*
   │  ├─ layout/*
   │  ├─ perf/*
   │  ├─ seo/*
   │  └─ ui/*
   ├─ lib/
   │  ├─ paths.ts
   │  ├─ routes.ts
   │  ├─ storage.ts                (planned in infrastructure; wiring deferred)
   │  ├─ a11y/announce.ts
   │  └─ seo/{meta,jsonld,feeds,og}.ts
   ├─ scripts/
   │  ├─ theme-init.ts
   │  ├─ keybindings.ts
   │  └─ view-transition-a11y.ts
   └─ styles/
      ├─ global.css
      ├─ fonts.css
      ├─ prose.css
      └─ code.css
```

## 5. Dependencies

Not applicable — this plan is a roadmap. Dependencies of each area covered in their own plan.

## 6. Implementation Steps (Ordered)

This is the Phase 1 critical path — concrete steps across plans, executed in order. Each step references the owning plan.

1. **Infrastructure confirmations.**
   - `astro.config.mjs` gets `trailingSlash: 'never'` + `build.format: 'file'` + sitemap integration update. (routing + seo plans)
   - Env var shape for `PUBLIC_GOOGLE_VERIFY`, `PUBLIC_BING_VERIFY`, `PUBLIC_GISCUS_*`. (seo plan)

2. **Content collection scaffolding.**
   - `src/content.config.ts` with two collections per RESEARCH.md Topic 1. (routing plan provides the stub; Session 3 may enrich.)

3. **Design tokens + fonts.**
   - `src/styles/global.css` + `fonts.css` + theme pre-paint script. (responsive plan)
   - Font files committed under `public/fonts/`. (performance plan)

4. **Base layout.**
   - `BaseLayout.astro` with canonical/noindex/ogImage/jsonLd/article props. (routing + seo plans)
   - Wire `<ClientRouter />`, `<SkipLink />`, `<LiveRegion />`, `<FontPreload />`, `<SEO />`, `<JsonLd />`, global.css. (all shared plans)

5. **Routing skeleton.**
   - `src/pages/` tree with 11 route files (home, 404, about, privacy, terms, courses index, course overview, 3 chapter tabs). (routing plan)
   - Shared `getChapterPaths()` in `src/lib/paths.ts`. (routing plan)

6. **Layout shell.**
   - TopNav, LeftSidebar, RightTOC, Drawer, BottomSheet, SearchModal shell, PageShell, ChapterShell. (responsive plan)

7. **A11y primitives.**
   - SkipLink, VisuallyHidden, LiveRegion, TabList, TabLink, FigureDescribed. (a11y plan)
   - `keybindings.ts`, `view-transition-a11y.ts`. (a11y plan)

8. **Perf helpers.**
   - FontPreload, CriticalCSS, LazyScript, GiscusLazy, SmartImage. (performance plan)

9. **SEO plumbing.**
   - `meta.ts`, `<SEO />`, `jsonld.ts`, `<JsonLd />`, `<Breadcrumbs />`, feeds, robots, OG pipeline. (seo plan)

10. **Headers + redirects.**
    - `public/_headers` (security + cache + CSP) and `public/_redirects` (empty with comments). (routing + performance + seo plans jointly)

11. **CI + docs.**
    - `.github/workflows/ci.yml` running validate-slugs, check-contrast, check-bundle, check-schema, axe, Pa11y, Lighthouse. (a11y + performance + seo plans)
    - `docs/A11Y.md`, `docs/PERF.md`, `docs/SEO.md`, updated PR template.

12. **Handoff to Session 3.**
    - Session 3 writes page-specific plans (home, all-courses, course-overview, chapter, about, legal, 404) composing the shared components and helpers.

## 7. Component/Module API Design

Not applicable — see individual plans.

## 8. Code Patterns

Cross-cutting patterns that every contributor must internalize, derived from the individual plans:

- **Canonical URL construction goes through `canonicalFor()`** — never hand-concat. (routing plan §8)
- **Meta tags go through `<SEO />`** — never hand-write `<meta>` in page templates. (seo plan §8)
- **Images go through `<SmartImage>`** — never raw `<img>`. (performance plan §8)
- **Third-party scripts go through `<LazyScript>`**. (performance plan §8)
- **Dialogs use native `<dialog>`** — no hand-rolled focus traps. (responsive plan §8)
- **Hydration: prefer inline `<script>` and zero-JS.** Use `client:*` only when genuinely stateful. (RESEARCH.md Topic 4)
- **Dual-sink theme toggle** — `.dark` class + `data-theme` attribute, set in ONE inline pre-paint script. (RESEARCH.md Topic 8)
- **Separate routes per chapter tab** — not a single-route JS tab switcher. (RESEARCH.md Topic 14)
- **Full Notes is canonical** — Revision/Flow declare canonical → Full Notes + `noindex, follow`. (routing + seo plans)
- **Per-component hydration budget** — already ratified per RESEARCH.md Topic 4; not renegotiable without plan update.

## 9. Testing Strategy

The full CI workflow is the composition of:
- `npm run validate:slugs` — routing plan
- `npm run check:contrast` — a11y plan
- `npm run check:bundle` — performance plan
- `npm run check:schema` — seo plan
- `npm run build` — Astro
- `npx playwright install --with-deps chromium`
- `npx @axe-core/cli` — a11y plan
- Lighthouse CI (performance + a11y + SEO + best-practices) — performance + a11y + seo plans
- `npx pa11y-ci --sitemap ...` — a11y plan

Every PR passes these before merge. Broken tests block merge.

## 10. Rollout Plan

**Phase 1 sprint ordering** (for the engineering owner):

| Sprint | Scope | Plans |
|---|---|---|
| 1 | Infrastructure + design system + base layout + content stubs | 00-infrastructure, routing-and-urls, responsive-breakpoints |
| 2 | Layout shell + a11y primitives + perf helpers | responsive-breakpoints, accessibility, performance |
| 3 | SEO factory + OG pipeline + feeds + sitemap | seo |
| 4 | CI/CD + validators + documentation | accessibility, performance, seo (shared CI), 00-infrastructure |
| 5–7 | Page plans (Session 3 output) | home, all-courses, course-overview, chapter (×3 views), about, legal, 404 |
| 8 | Content authoring + polish + launch checklist | (content work outside this plan scope) |

**Launch gates** (before Phase 1 goes public):
- [ ] All 6 shared plans implemented and green in CI.
- [ ] All 7 page plans (Session 3) implemented.
- [ ] At least one real chapter authored end-to-end and reviewed.
- [ ] Search Console + Bing Webmaster verified.
- [ ] Cloudflare Redirect Rule for www→apex configured.
- [ ] Sitemap submitted.
- [ ] `public/og/default.png` designed and committed.
- [ ] Real-device testing completed per responsive plan.
- [ ] VoiceOver walkthrough on chapter + home + course pages.

## 11. Risks and Mitigations

- **Risk: Sprint 1 foundational changes force later sprints to rework.**
  - Likelihood: medium
  - Impact: high
  - Mitigation: every shared plan's "Done When" is strict and testable; sprint 1 does not close until those boxes check.

- **Risk: Multiple plans want to own `_headers` or `BaseLayout.astro`.**
  - Likelihood: medium
  - Impact: medium (merge conflicts)
  - Mitigation: this overview file designates ownership:
    - `_headers` baseline security → routing plan.
    - `_headers` cache-control → performance plan.
    - `_headers` CSP → seo plan.
    - `BaseLayout.astro` meta/routing props → routing plan.
    - `BaseLayout.astro` `<SEO />` integration → seo plan.
    - `BaseLayout.astro` `<SkipLink />` + `<LiveRegion />` → a11y plan.
    - `BaseLayout.astro` `<FontPreload />` + theme pre-paint → performance + responsive plans.

- **Risk: Session 3 discovers a shared plan doesn't cover a page-specific need.**
  - Likelihood: medium
  - Impact: low (Session 3 can extend; flag back to shared plan for ratification)
  - Mitigation: Session 3 may append small sections to shared plans; record in SESSION-LOG.md.

- **Risk: Implementation team works on plans out of dependency order.**
  - Likelihood: medium
  - Impact: high
  - Mitigation: the Sprint schedule above is prescriptive; each sprint's PRs should cite the plan they implement.

- **Risk: Stakeholders request Phase 2 features mid-Phase 1 (accounts, tracks, bookmarks).**
  - Likelihood: medium
  - Impact: high
  - Mitigation: `specs/shared/website-overview.md` is clear about Phase 1 = 10 pages. Each plan's "Open Questions" section records Phase 2 asks so they're not lost but don't creep in.

## 12. Done When

- [ ] All 6 shared plans exist at `.claude/plans/shared/*.md`.
- [ ] Each shared plan has the required 14-section structure.
- [ ] Cross-links between plans resolve (e.g., routing plan references accessibility plan, which references performance plan, etc.).
- [ ] `SESSION-LOG.md` has a Session 2 entry with handoff notes.
- [ ] This overview file lists every plan and assigns owner for every shared file.

## 13. Open Questions

Carried from Session 1 + surfaced during Session 2. For full context, see each plan's §13.

**Blockers (need owner input before implementation starts):**
- [ ] Font family confirmation (Inter / Source Serif 4 / JetBrains Mono) — affects responsive + performance plans.
- [ ] `astro-og-canvas` version availability at implementation time — affects seo plan.
- [ ] Who owns Cloudflare Redirect Rules for www→apex — ops question.

**Non-blocking (can ship without; flag for Phase 2):**
- [ ] Giscus EU GDPR opt-in UX.
- [ ] Per-course feeds.
- [ ] CSP nonce-based hardening.
- [ ] Dyslexia-friendly font toggle.
- [ ] Keyboard shortcut help modal.
- [ ] PWA service worker.
- [ ] FAQ / Q&A schema within chapters.
- [ ] Author pages.
- [ ] Image sitemap.
- [ ] `BroadcastChannel` for same-tab state sync.
- [ ] Mermaid build-time SVG alternative.
- [ ] Container API for full-content RSS / Atom feeds.

## 14. References

**Specs:**
- `.claude/specs/shared/website-overview.md`
- `.claude/specs/shared/routing-and-urls.md`
- `.claude/specs/shared/responsive-breakpoints.md`
- `.claude/specs/shared/accessibility.md`
- `.claude/specs/shared/performance.md`
- `.claude/specs/shared/seo.md`

**Plans (siblings):**
- `.claude/plans/00-infrastructure.md`
- `.claude/plans/RESEARCH.md`
- `.claude/plans/shared/routing-and-urls.md`
- `.claude/plans/shared/responsive-breakpoints.md`
- `.claude/plans/shared/accessibility.md`
- `.claude/plans/shared/performance.md`
- `.claude/plans/shared/seo.md`

**Session log:** `.claude/plans/SESSION-LOG.md`

**External:** not applicable — individual plans cite their own sources.
