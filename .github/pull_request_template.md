## What this PR does

<!-- One paragraph: what changed and why. Link the spec/plan that drove the change. -->

## Related spec / plan

<!-- Link the .claude/specs/* and .claude/plans/* files this PR implements.
     If this PR closes or partially closes a numbered PR from PHASE-1-ROADMAP.md,
     reference it (e.g. "Implements PR-2.1 — 404 page"). -->

- Plan:
- Spec:
- Roadmap PR:

---

### Accessibility checklist

- [ ] Tabbed through every interactive element with the keyboard only
- [ ] Focus indicator is visible on every focusable element in both themes
- [ ] Tested at 200% browser zoom — no clipped text or trapped focus
- [ ] VoiceOver / NVDA walkthrough done for new components
- [ ] Headings follow a single `<h1>` per page with no level skips
- [ ] Touch targets ≥ 44×44 on new interactive surfaces

### Performance checklist

- [ ] Core Web Vitals impact considered (LCP, INP, CLS)
- [ ] Bundle size impact known; new JS within budget per `shared/performance.md` §3
- [ ] Images use `<SmartImage>` with explicit `width`/`height`; LCP image marked `priority`
- [ ] Third-party scripts wrapped in `<LazyScript>` or otherwise deferred
- [ ] No layout-shifting inserts (iframes / embeds reserve space)

### SEO checklist

- [ ] Meta tags emitted via `<SEO />` (no hand-written `<meta>` in pages)
- [ ] Canonical URL goes through `canonicalFor()`; Revision/Flow point to Full Notes
- [ ] JSON-LD attached via `<JsonLd />` factory (TechArticle / Course / Breadcrumb / etc.)
- [ ] Sitemap inclusion / exclusion correct (Revision/Flow/coming-soon excluded)
- [ ] OG image renders cleanly at 1200×630 in social-card debuggers (if applicable)

### Testing done

- [ ] `npm run check` passes locally
- [ ] Manual smoke of golden path on affected page(s)
- [ ] Edge cases verified (empty state / error state / RTL or zoomed layout where relevant)
- [ ] Cross-browser spot-check (Chromium + WebKit + Firefox) for UI changes

### Screenshots

<!-- Required for any visible UI change. Include light + dark theme. Mobile + desktop where layout differs. -->
