---
title: GyanDev Plans — Consistency Review
created: 2026-04-20
session: 4
owner: sonushahuji4
scope: Cross-check across 13 plan files + 13 spec files + CLAUDE.md
---

# Consistency Review

This report audits the Phase 1 planning corpus (6 shared plans + 7 page plans + 1 infrastructure plan + 1 research brief + 13 specs in `.claude/specs/`) for contradictions, missing cross-references, undefined components, unvalidated assumptions, and spec gaps.

Review was performed via three parallel forensic passes — see `.claude/plans/PHASE-1-ROADMAP.md` §2 for the ratified resolutions of the load-bearing items below.

---

## 1. Contradictions Found

Every contradiction below is plan-vs-plan. Spec-vs-plan and spec-vs-spec checks are reported in §1.6. Load-bearing items are ratified in `PHASE-1-ROADMAP.md` §2 and marked here with the matching ID (R1–R7).

### 1.1 `localStorage` / `sessionStorage` key prefix drift → ratified R1

- **Contradiction**: Three incompatible prefix schemes coexist across plans.
- **Location 1**: `shared/responsive-breakpoints.md` Steps 2, 4 — uses plain `gyandev:theme`.
- **Location 2**: `shared/accessibility.md` Step 5 — uses plain `gyandev:scroll`.
- **Location 3**: `pages/home.md` §3.2 + Step 10; `pages/chapter.md` §3.8 + Step 19 — uses dotted-versioned `gyandev:v1.progress.lastRead`, `gyandev:v1.prefs.activeTab`.
- **Location 4**: `pages/all-courses.md` §3.3 + Step 9; `pages/course-overview.md` Step 14; `pages/chapter.md` Step 19 — uses colon-domain `gyandev:progress:<courseId>`, `gyandev:bookmarks`, `gyandev:dismiss:continue`.
- **Flag by author**: `pages/home.md` §13 explicitly called this out as unratified.
- **Recommendation**: Adopt unified `gyandev:v1:<domain>:<id-or-field>` via `src/lib/storage.ts` builders. Keep colon separators; version in the prefix, not inline. See `PHASE-1-ROADMAP.md` §2.R1 for full key table.

### 1.2 `BaseLayout` `includeSerif` wiring path undefined → ratified R2

- **Contradiction**: Three plans describe different wiring for the same prop.
- **Location 1**: `pages/home.md` §6 Step 12 — proposes adding `includeSerif?: boolean` to `PageShell` and forwarding to `<FontPreload>`.
- **Location 2**: `shared/responsive-breakpoints.md` Step 11 — `PageShell` Props interface is empty; does not mention `includeSerif`.
- **Location 3**: `shared/performance.md` Step 3 — says "Home passes `includeSerif={true}`; other pages default (false)" but does not specify the wiring path.
- **Location 4**: `shared/routing-and-urls.md` §7 BaseLayout Props — does not list the prop.
- **Recommendation**: Add `includeSerif?: boolean` to both `BaseLayout.astro` and `PageShell.astro` Props, plumbed through to `<FontPreload>` in the head. Only `src/pages/index.astro` sets it `true`. See `PHASE-1-ROADMAP.md` §2.R2.

### 1.3 `transition:persist="chapter-shell"` scope ambiguity → ratified R3

- **Contradiction**: Two plans disagree on what region is persisted.
- **Location 1**: `shared/routing-and-urls.md` §3.4 + Step 10 — "(header + tab bar + title region)".
- **Location 2**: `shared/responsive-breakpoints.md` Step 12 — "shell region (TopNav + tab bar)".
- **Location 3**: `pages/chapter.md` Step 15 + `shared/accessibility.md` §3.3 — focus restoration must land on the fresh H1 after swap, implying the H1 must NOT be persisted.
- **Recommendation**: Narrow to TopNav + breadcrumbs + tab bar only. H1 swaps with content. Update routing-and-urls.md §3.4 + Step 10 to match responsive-breakpoints.md Step 12. See `PHASE-1-ROADMAP.md` §2.R3.

### 1.4 CSP missing Pagefind WASM allowance → ratified R4

- **Contradiction**: SEO plan's CSP disallows Pagefind's WebAssembly execution at runtime.
- **Location 1**: `shared/seo.md` Step 16 — `script-src 'self' 'unsafe-inline' https://giscus.app` (no `'wasm-unsafe-eval'`).
- **Location 2**: `00-infrastructure.md` §8 decision — Pagefind locked as search engine; `RESEARCH.md` Topic 6 documents Pagefind as WASM-backed.
- **Recommendation**: Add `'wasm-unsafe-eval'` to `script-src` in seo.md Step 16 final CSP. Add CSP smoke test (headless open `/search`, assert no violations). See `PHASE-1-ROADMAP.md` §2.R4.

### 1.5 CI workflow filename drift → ratified R5

- **Contradiction**: Plans create and later rename the CI workflow file.
- **Location 1**: `shared/accessibility.md` Step 11 — creates `.github/workflows/a11y.yml`.
- **Location 2**: `shared/performance.md` Step 14 — "rename to `ci.yml`".
- **Recommendation**: Create as `ci.yml` from the start. Update accessibility.md Step 11 filename; update performance.md Step 14 + seo.md Step 21 to say "extend", not "rename". See `PHASE-1-ROADMAP.md` §2.R5.

### 1.6 `content.config.ts` path drift

- **Contradiction**: CLAUDE.md's prose path `src/content/config.ts` historically drifted from plans' `src/content.config.ts` (Astro 5+ Content Layer convention).
- **Location 1**: `CLAUDE.md` (pre-commit `f72f8ce`) — "schemas in `src/content/config.ts`".
- **Location 2**: All 7 page plans + `shared/routing-and-urls.md` Step 2 — `src/content.config.ts`.
- **Status**: Resolved by commit `f72f8ce` (docs: align CLAUDE.md content path with Astro convention). Spot-check during Sprint 0.
- **Recommendation**: Confirmed canonical path is `src/content.config.ts` (root-level). See `PHASE-1-ROADMAP.md` §2.R6.

### 1.7 Chapter-slug shape — flat vs nested

- **Contradiction (latent)**: `shared/routing-and-urls.md` Step 9 uses two-param route `[course]/[chapter]` and flags multi-segment chapters as an open question. `shared/seo.md` Step 9's OG route uses `courses/${c.id.split('/').slice(0, -1).join('/')}` assuming multi-segment slugs are allowed.
- **Location 1**: `shared/routing-and-urls.md` Step 9.
- **Location 2**: `shared/seo.md` Step 9.
- **Recommendation**: Phase 1 content uses flat chapter slugs (`<course>/<chapter-slug>`), so the mismatch is currently inert. When the first multi-segment chapter is authored, routing plan must ratify rest-params and update `getChapterPaths()` accordingly. Add to `PHASE-1-ROADMAP.md` §6 Q#31 (not currently listed — add in follow-up).

### 1.8 `TabLink disabled` affordance

- **Contradiction**: Not a hard contradiction; rather an unspecified decision.
- **Location 1**: `pages/chapter.md` Step 15 + §7 — proposes `<span role="tab" aria-disabled="true">` (non-focusable).
- **Location 2**: `shared/accessibility.md` Step 6 — current TabLink is always `<a>`.
- **Recommendation**: Phase 1 = non-focusable span with sr-only "Coming soon". Flag for screen-reader user test. Tracked in `PHASE-1-ROADMAP.md` §6 Q#21.

### 1.9 `_headers` cache rule duplication (non-conflicting)

- **Potential contradiction**: Both routing-and-urls.md and performance.md write `/_astro/*` and `/fonts/*` immutable rules.
- **Location 1**: `shared/routing-and-urls.md` Step 11.
- **Location 2**: `shared/performance.md` Step 9.
- **Verdict**: Values agree (`max-age=31536000, immutable`). Sequencing only — performance plan extends routing plan's stub. No functional contradiction.
- **Recommendation**: No change; order the PRs (routing first, performance second, seo third).

### 1.10 `courseLabel` in `lastRead` envelope — semantic ambiguity

- **Contradiction**: chapter.md writes `courseLabel` in the `lastRead` envelope, but no content collection field has this name.
- **Location 1**: `pages/chapter.md` Step 19 `writeLastRead`.
- **Location 2**: `pages/home.md` Step 10 reads `d.courseLabel ?? d.courseSlug` (graceful fallback).
- **Location 3**: `pages/all-courses.md` Step 1 schema — course has `title`, not `courseLabel`.
- **Recommendation**: `courseLabel` = course's `title` field. Document in `storage.ts` JSDoc. See `PHASE-1-ROADMAP.md` §2 R8.

### 1.11 404 page "featured course" concept

- **Contradiction**: `pages/404.md` Open Questions defers "read from `featured.yml` if present; otherwise fall back to hard-code". But `featured.yml` schema is a list of featured **chapters**, not courses.
- **Location 1**: `pages/404.md` §13.
- **Location 2**: `pages/home.md` Step 1 schema — `featured.refs: [{ courseId, chapterSlug }]`.
- **Recommendation**: Hard-code the first/flagship course (`nodejs`) in Phase 1. `featured.yml` is not repurposed for courses. See `PHASE-1-ROADMAP.md` §2 ratification #9 and §6 Q#27.

### 1.12 `HomeHero` featured course source

- **Contradiction**: Same root issue as 1.11 — home hero references a "featured course" but no collection holds that field.
- **Location 1**: `pages/home.md` Step 5.
- **Location 2**: `about.yml` schema, `featured.yml` schema — neither has a featured-course field.
- **Recommendation**: Phase 1 hard-code; Phase 2 extract to a `site.yml` or similar config. Tracked in `PHASE-1-ROADMAP.md` §6 Q#29.

### 1.13 Validator script centralization

- **Contradiction**: Two plans give alternative names for essentially the same concern.
- **Location 1**: `pages/404.md` Step 6 — "add 404 check to `validate-slugs.mjs` OR a new `scripts/check-404.mjs`".
- **Location 2**: `pages/chapter.md` Step 21 — "Extend `scripts/validate-slugs.mjs` OR add a dedicated `scripts/validate-content.mjs`".
- **Recommendation**: Split cleanly:
  - `scripts/validate-slugs.mjs` (routing) — slug/URL discipline only.
  - `scripts/validate-content.mjs` (chapter) — MDX body rules (Mermaid fences, H1 placement, orphan views, 404 route presence).
- Delegated to PR-1.1 (slugs) and PR-5.2 (content). See `PHASE-1-ROADMAP.md` §8.

### 1.14 CLAUDE.md vs plan activity for dependency pinning

- **Non-contradiction**: plans reference `Astro 6 + MDX + TypeScript + Tailwind v4 + Shiki + Pagefind + Mermaid + KaTeX` exactly as CLAUDE.md states. No drift.

### 1.5.bis Spec-vs-plan contradictions

Session 3 read all page specs before writing page plans; Session 1 read all shared specs before the research brief. No hard contradictions between specs and plans were reported by either session. Session 3 explicitly surfaced "extensions flagged" (shared-plan deltas), which are additive changes — not contradictions. They are folded into PR-1.3/PR-1.4/PR-1.5 steps in `PHASE-1-ROADMAP.md` §4.

Session 4 did not re-audit every spec byte-for-byte against every plan; Sessions 1 and 3 are trusted to have reconciled during authoring. If an implementation PR surfaces a spec/plan divergence, the plan wins (plans are the ratified spine for Phase 1), and the spec can be updated retroactively.

### 1.16 Spec-vs-spec contradictions

Session 1 reconciled the six shared specs into a unified cross-cutting decision set in `RESEARCH.md`. No spec-vs-spec contradictions were reported. Page specs are independent and do not overlap (each spec governs its own route), so spec-vs-spec contradictions are structurally unlikely.

---

## 2. Missing Cross-References

Plans that should reference each other but don't (or reference weakly).

| Source plan | Should reference | Why |
|---|---|---|
| `shared/routing-and-urls.md` (BaseLayout §7) | `shared/seo.md` Step 6 (BaseLayout extension) | Props list is incomplete without the seo additions (`ogImage`, `jsonLd`, `article`). |
| `shared/responsive-breakpoints.md` Step 11 (PageShell) | `pages/home.md` Step 12 (`includeSerif`) | Props interface currently empty; home plan's extension is the binding spec. |
| `shared/accessibility.md` Step 6 (TabLink) | `pages/chapter.md` Step 15 (`disabled` prop) | `disabled?: boolean` addition lives only in chapter plan. |
| `shared/seo.md` §3.1 (JSON-LD factories) | `pages/about.md` Step 10, `pages/all-courses.md` Step 3, `pages/course-overview.md` Step 3 | Factories `personSchema`, `aboutPageSchema`, `courseListSchema`, `courseSchema` are specified in page plans, not in the seo plan itself. |
| `shared/seo.md` Step 12 (sitemap filter) | `pages/course-overview.md` Step 17 | Filter must exclude coming-soon courses; spec lives in course-overview plan. |
| `shared/routing-and-urls.md` Step 13 (validate-slugs) | `pages/chapter.md` Step 21 (validate-content) | These are split concerns; each plan should mention the other. |
| `shared/performance.md` Step 8 (GiscusLazy) | `pages/chapter.md` Step 18 (Giscus wrap) | Chapter plan consumes but does not back-reference. |
| `00-infrastructure.md` §10 (storage) | All hydrate scripts (4 page plans) | Storage decision lived in infra memo; page plans reference by name but not by link. |
| `shared/website-overview.md` §10 (sprint table) | All page plans §10 Rollout | Sprint sequencing is now superseded by `PHASE-1-ROADMAP.md` §4. |

**Disposition**: None of these are blockers. `PHASE-1-ROADMAP.md` consolidates the web into one navigable document. Implementation PRs should update each source plan's cross-reference list as the author edits it — a small housekeeping task per PR rather than a single "fix all cross-refs" PR.

---

## 3. Undefined Components

Components referenced by page plans that are not formally defined anywhere (including in the empty `shared/component-library.md` placeholder).

### 3.1 Components flagged for promotion to shared library

Session 3 explicitly called these out for Session 4 to formalize. Since `shared/component-library.md` is empty (0 bytes), the promotion targets are recorded in `PHASE-1-ROADMAP.md` §9 instead of a separate component-library document.

| Component | Currently defined in | Should live at | Second consumer |
|---|---|---|---|
| `CourseCard` | `pages/all-courses.md` | `src/components/ui/CourseCard.astro` | `pages/home.md` |
| `ChapterRenderer` | `pages/chapter.md` §7 | `src/components/content/ChapterRenderer.astro` | Future prose routes |
| `ProgressWidget` | `pages/course-overview.md` | `src/components/ui/ProgressWidget.astro` | Phase 1.5 (home) |

### 3.2 Shared plans that reference components without a definitive introducing step

| Component | Mentioned in | Defining step location | Status |
|---|---|---|---|
| `<Comments />` wrapper | `00-infrastructure.md` §11, `pages/chapter.md` Step 18 | Neither; performance plan defines `GiscusLazy` only | Gap — PR-5.1 must either use `GiscusLazy` directly or introduce `<Comments />` wrapping it. Flagged. |
| Global `<Footer />` | `pages/legal.md` §3.4, `shared/responsive-breakpoints.md` Step 11 (TODO flag) | Nowhere | Gap — assigned to PR-6.1 in roadmap. |
| `<FigureDescribed />` | `shared/accessibility.md` Step 7 | Defined at the step | ✅ defined |
| `<SearchModal />` shell | `shared/responsive-breakpoints.md` Step 8 | Defined at step (shell only — content integration is Sprint 5's Pagefind step) | ⚠️ shell-only; full integration deferred |

### 3.3 Page-scoped components (correctly kept out of shared library)

These are defined in their page plans and correctly live under `src/components/pages/<page>/`:

- 404: `ErrorHero`, `RecoveryLinks`, `ReportLink`
- Legal: `LegalHeader`, `LegalTOC`, `LegalContact`
- About: `AboutHero`, `AuthorBio`, `SocialLinks`, `LicenseBlock`, `ContributeBlock`, `ChangelogList`
- All-courses: `CoursesHeader`, `CourseGrid`, `CompletionBanner`, `RequestCourseCTA`
- Course-overview: `CourseHero`, `LearningObjectives`, `Prerequisites`, `ChapterList`, `ChapterRow`, `ComingSoonHero`, `CourseSidebar`, `ProgressWidget`, `RelatedCourses`, `ContributeLinks`
- Home: `HomeHero`, `ContinueReadingCard`, `FeaturedStrip`, `ChapterCard`, `RecentlyUpdatedList`
- Chapter: `ChapterHeader`, `ChapterActions`, `ChapterFooter`, `ComingSoonView`, `LeftSidebar`, `RightTOC`, `MobileTOCTrigger`, `MermaidCaption` (plus `ChapterRenderer` which promotes)

No component in this list is undefined; each is introduced by its own page plan's §6 step and §7 API table.

### 3.4 Empty shared-plan placeholders

Three files exist at 0 bytes and claim a conceptual role that is actually covered elsewhere:

- `shared/design-system.md` — concerns covered by `shared/responsive-breakpoints.md` (tokens, `@theme`, dark overrides).
- `shared/component-library.md` — concerns covered by `shared/accessibility.md` (a11y primitives), `shared/responsive-breakpoints.md` (layout components), `shared/performance.md` (perf components), `shared/seo.md` (seo components). Session 4's §9 "Components Promoted to Shared Library" table fills the coordination gap.
- `shared/layout-conventions.md` — concerns covered by `shared/responsive-breakpoints.md` (PageShell, ChapterShell) + `shared/routing-and-urls.md` (BaseLayout + ClientRouter).

**Recommendation**: Phase 1.5 housekeeping PR should either delete these stubs OR replace each with a one-line redirect: "This concern was absorbed by X — see `<path>`." Deletion is cleaner but loses search-in-repo discoverability; single-line redirects preserve it.

---

## 4. Unvalidated Assumptions

Assumptions made across plans that need implementation-time validation.

### 4.1 Third-party availability

- **`astro-og-canvas@^0.9.x` supports Astro 6.** Plans commit to this package, but the 0.9.x line's Astro-6 compatibility has not been verified at planning time.
  - Validation: `npm view astro-og-canvas versions --json` at PR-1.5 start.
  - Fallback: `astro-satori` (flagged in `shared/seo.md`).
- **Pagefind CLI runs cleanly on Cloudflare Pages build image.** Assumed; untested.
  - Validation: first preview deploy after PR-5.1.
  - Fallback: build-time hook override if necessary.
- **Mermaid re-inits under `<ClientRouter />`.** Documented risk. PR-5.0 is a mandatory spike before PR-5.1.
  - Fallback: `rehype-mermaid` for build-time SVG rendering (eliminates client runtime).
- **Giscus loads under the ratified CSP.** `connect-src`, `frame-src`, `script-src` all include `https://giscus.app`. Validation: CSP smoke test + manual console inspection on first chapter preview deploy.

### 4.2 Storage + hydration

- **`localStorage` is writable.** Assumed; `storage.ts` has an in-memory fallback per research. Validation: private-mode browsing test.
- **`sessionStorage['gyandev:v1:dismiss:continue']` clears on tab close.** Assumed per spec. Validation: manual test in PR-4.2.
- **Cross-tab `storage` event fires for all ratified keys.** Assumed. Validation: open two tabs, mark a chapter read in one, confirm the other's sidebar updates.
- **`pagehide` flush reliably catches iOS Safari background transitions.** RESEARCH.md documents this as the 2026 best-practice replacement for `beforeunload`. Validation: mobile Safari manual test.

### 4.3 Performance budgets

- **LCP < 2.5s on a cold chapter page with Shiki code blocks.** Assumed. Validation: PR-5.1 Lighthouse run on a 3000-word chapter with 10 code blocks.
- **Mermaid runtime does NOT leak into Full Notes bundle.** Assumed per separate-routes model. Validation: `check-bundle-size.mjs` grep for `mermaid` in Full Notes chunk.
- **Home JS budget < 5 KB gzipped.** Assumed. Validation: Sprint 4 check.

### 4.4 Accessibility

- **`view-transition-a11y.ts` handles all focus / scroll restoration cases.** RESEARCH.md Topic 14 flags documented scroll-restoration bugs. Validation: PR-1.3 VoiceOver walkthrough + manual cross-browser.
- **`TabList` + `TabLink` ARIA pattern matches WAI-ARIA APG best practice when `disabled` is set.** Currently chapter plan renders `<span role="tab" aria-disabled="true">`. Validation: screen-reader user test.

### 4.5 Build + deploy

- **Cloudflare Pages serves `dist/404.html` automatically for unknown URLs.** Assumed per CF Pages docs. Validation: preview-deploy curl test in PR-2.1.
- **`build.format: 'file'` + `trailingSlash: 'never'` produces flat `.html` without 308 redirects on CF Pages.** RESEARCH.md Topic 12 locks this. Validation: PR-1.1 preview-deploy.
- **Sitemap `lastmod` and robots-noindex filter correctly exclude coming-soon and view-suffixed routes.** Assumed. Validation: PR-1.5 — read generated `sitemap-index.xml` and grep.

### 4.6 Content authoring

- **Frontmatter `readingMinutes` is author-supplied and accurate.** Phase 1 assumption; Phase 1.5 will auto-compute.
- **Chapter `index.mdx` always exists even for Coming-soon chapters.** chapter.md assumes this for the Full Notes route to render. Validation: `validate-content.mjs` enforces.
- **`about.yml` author signoff before launch.** Listed as Q#17 blocker in roadmap.

---

## 5. Spec Gaps Discovered

Concerns specs did not cover but implementation needs. Folded into the roadmap where relevant.

### 5.1 Infrastructure specs missing

- **`.env.example` + environment variable contract** — no spec owns the full list of `PUBLIC_*` vars. Assigned to PR-0.1.
- **Cloudflare Pages dashboard runbook** — build command, publish directory, Node version, preview-branch config, env-var setup. Assigned to PR-6.3 (`docs/DEPLOY.md`).
- **Rollback procedure** — CF Pages has native rollback; process needs documenting. PR-6.3.
- **Search Console + Bing Webmaster verification** — referenced in seo plan as env-driven meta tags, but dashboard workflow undocumented. PR-6.4 (external ops task).
- **Deploy smoke tests** — post-merge HTTP checks for canonical URLs, sitemap, feeds, OG reachability, `/search` CSP. Assigned to PR-6.2.
- **`scripts/generate-perf-report.mjs`** — file listed in `shared/performance.md` §4 tree but has no implementation step. Gap — either drop from tree or add a step in PR-1.4.
- **Cloudflare Web Analytics snippet** — flagged as deferred ops (performance.md §13). CSP will need amendment in Phase 2.

### 5.2 Content authoring spec missing

- **`new-chapter` scaffolding script** — referenced implicitly but not planned. Deferred Phase 1.5.
- **Content review workflow** — no spec for pre-publish review (lint, prose style, fact-check). Deferred.
- **Image asset pipeline** — SmartImage handles optimization; the authoring-time workflow (where raw images live, naming conventions, alt-text enforcement) is not specified beyond `shared/accessibility.md` Step 13's "image authoring pattern" documentation step.

### 5.3 Legal + editorial specs missing

- **GDPR / CCPA / DPDPA compliance review** — privacy + terms prose needs compliance-expert review. Q#18 blocker.
- **License terms for site content** — About plan references `LicenseBlock` but the actual license (CC-BY-4.0, MIT, proprietary?) is not specified. Needs decision before PR-2.3.
- **Featured-chapter curation cadence** — no spec for who picks featured chapters, how often, criteria. Assigned to `docs/EDITORIAL.md` in PR-6.3.

### 5.4 Accessibility spec gaps

- **`TabLink disabled` focus behavior** — non-focusable span vs focusable-but-announced alternative. No authoritative decision. Q#21.
- **Focus management when Giscus mounts** — Giscus loads lazily; when it finishes loading mid-read, does focus change? No spec. Validation needed in PR-5.1.

### 5.5 Storage spec gaps

- **Migrations table seed** — infra §10 locks the shape. `v1` is current; `v2` path needs documentation even if table is empty in Phase 1.
- **Conflict resolution during cross-tab writes** — if two tabs mark different chapters read simultaneously, what wins? Unspecified; acceptable for Phase 1 (last-write-wins) but document in `storage.ts` JSDoc.
- **Storage quota behavior** — what happens at 5 MB quota? In-memory fallback exists; no user-facing affordance.

### 5.6 Search + comments spec gaps

- **Pagefind filter semantics** — `data-pagefind-filter="course"` wraps Full Notes. Search UI filter affordance (checkboxes? dropdown?) is not specified beyond "modal". Defer to implementation-time design in PR-1.2's `SearchModal` shell.
- **Giscus thread ownership** — which repository discussions? `PUBLIC_GISCUS_REPO` is set, but visibility (public vs gated), moderation policy, and spam defaults are not specified. Deferred to ops setup in Sprint 6.

### 5.7 Ops + monitoring spec gaps

- **Error tracking** — no Sentry-equivalent spec. Phase 1 launches without client error monitoring. Document as accepted risk in roadmap.
- **Uptime monitoring** — no spec. CF Pages has basic health. Defer.
- **Analytics** — CF Web Analytics deferred. Privacy-preserving analytics choice deferred to Phase 2.
- **Backup** — content is git-versioned; `localStorage` is user-only. No additional backup needed for Phase 1.

---

## 6. Recommendation

**Overall: Ready for implementation? ✅ Yes, with caveats.**

The planning corpus is internally consistent after the 8 Session-4 ratifications land in their respective plans (R1–R7 + courseLabel semantics). No load-bearing contradictions remain. `PHASE-1-ROADMAP.md` §4 provides a sequenced 23-PR execution plan across 7 sprints (~5 weeks).

### Before Sprint 1 can start

Two implementation-time checks and one content blocker must be resolved by sonushahuji4:

1. **Q#9 Font licensing sign-off** — blocks PR-1.4. Fallback: system font stack (documented).
2. **Q#10 `astro-og-canvas` 0.9.x Astro-6 compat** — check at PR-1.5 start; fallback `astro-satori`.
3. **Apply Session-4 ratifications to 8 shared + 7 page plans.** Not a blocker (roadmap overrides plans), but recommended for durability of the plan documents. Assigned as a single-PR housekeeping task before PR-1.1 lands (~30 minutes).

### Before Sprint 2 lands

- **Q#18 Legal prose review** — blocks PR-2.2.
- **Q#14, #15, #17 About content sign-off** — blocks PR-2.3.
- **License decision for content** (gap 5.3) — blocks PR-2.3.

### Before Sprint 5 lands

- **PR-5.0 Mermaid re-init spike** — mandatory before PR-5.1.

### Before launch (Sprint 6)

- **Q#11 CF Redirect Rule** (www→apex), **Q#16 CONTRIBUTING.md**, **Q#24 issue templates** — all owner-assigned to sonushahuji4 for Sprint 6.

### No-regret next step

Create a single housekeeping PR before Sprint 1 starts that folds the 7 Session-4 ratifications directly into the 13 plan files (~30 min). This eliminates any future drift between `PHASE-1-ROADMAP.md` §2 and the individual plans. Optional but recommended.

### Blockers list (if you prefer a flat summary)

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| 1 | Font licensing signoff | sonushahuji4 | PR-1.4 |
| 2 | `astro-og-canvas` 0.9.x availability | check at PR-1.5 | PR-1.5 |
| 3 | Legal prose | sonushahuji4 + counsel | PR-2.2 |
| 4 | About content (photo, socials, bio) | sonushahuji4 | PR-2.3 |
| 5 | Content license decision | sonushahuji4 | PR-2.3 |
| 6 | Mermaid + ClientRouter spike | PR-5.0 | PR-5.1 |
| 7 | `CONTRIBUTING.md` | sonushahuji4 | launch |
| 8 | CF Redirect Rule www→apex | sonushahuji4 | launch |
| 9 | GitHub issue templates | sonushahuji4 | launch |

All nine are tractable. The plans are ready.

---

## References

- `.claude/plans/PHASE-1-ROADMAP.md` — execution plan (supersedes sprint sections of shared plans).
- `.claude/plans/SESSION-LOG.md` — decision history across 4 planning sessions.
- `.claude/plans/RESEARCH.md` — 14 technical topic briefs.
- `.claude/plans/00-infrastructure.md` — binding infra decisions (incomplete; §11 of roadmap lists remaining items).
- 6 shared plans at `.claude/plans/shared/*.md` (3 empty placeholders: `design-system.md`, `component-library.md`, `layout-conventions.md`).
- 7 page plans at `.claude/plans/pages/*.md`.
- 13 specs at `.claude/specs/shared/*.md` + `.claude/specs/pages/*.md`.
