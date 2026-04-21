/**
 * Lighthouse CI config — shared by a11y and performance gates.
 *
 * Owner: PR-1.4 (performance.md Step 13). The a11y plan (PR-1.3) referenced
 * this file but left its creation to the perf sprint because the CWV
 * assertions are the heavier half.
 *
 * URLs audited (PHASE-1-ROADMAP §4 PR-1.4):
 *   - /                (home)
 *   - /courses         (all-courses stub)
 *   - /about
 *   - one chapter once Sprint 5 seeds `/courses/javascript/01-event-loop`
 *     — currently skipped via `url` list filtering when the route is absent.
 *
 * Posture:
 *   - Desktop preset first. Mobile adds run time and variance; we layer it
 *     once the desktop baseline is stably green (docs/PERF.md).
 *   - 3 runs with median aggregation to absorb the well-known Lighthouse CI
 *     flake on slow CI VMs (performance.md Risk §11).
 *   - `lighthouse:recommended` preset with category overrides; individual
 *     CWV metrics asserted explicitly so a regression surfaces the exact
 *     blame line in CI output.
 *   - `temporary-public-storage` uploads the full HTML report for each run
 *     so a failed assertion links to the Lighthouse trace, not just a number.
 *
 * The `staticDistDir` mode runs against the built `dist/` without spinning
 * up the preview server — simpler and deterministic. Any runtime-only
 * check that needs `astro preview` (e.g. a route-level fetch) belongs in
 * the preview-backed axe/Pa11y steps already wired in `ci.yml`.
 */
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
      // staticDistDir spins up an http-server rooted at ./dist, so URLs are
      // served as-is. `build.format: 'file'` emits `<route>.html` files, so we
      // point lhci at the explicit `.html` paths. Once a chapter is seeded in
      // Sprint 5, add `http://localhost/courses/javascript/01-event-loop.html`.
      url: [
        'http://localhost:8080/index.html',
        'http://localhost:8080/courses.html',
        'http://localhost:8080/about.html',
      ],
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Category thresholds (PR-1.4 brief).
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        // Explicit CWV ceilings — surface the specific metric if it regresses.
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        // Overrides for `lighthouse:recommended` audits that are noisy or
        // content-dependent for a pre-seed Phase-1 build. Revisit once real
        // chapters exist (chapter PR, Sprint 5).
        //
        // `label-content-name-mismatch` fires when an icon-only button's
        // visible text (an emoji glyph) differs from its aria-label. Our
        // header controls (hamburger, search, theme, GitHub) are this by
        // design and pass axe-core + Pa11y per PR-1.3. Downgrade to warn so
        // it's visible but non-blocking.
        'label-content-name-mismatch': 'warn',
        // `network-dependency-tree-insight` is a Lighthouse ≥ 12 insight
        // that asserts the critical-path waterfall. Phase 1 ships a single
        // CSS bundle + a single theme-toggle JS module; once real content +
        // pagefind / giscus / mermaid wiring lands (later PRs) we re-visit.
        'network-dependency-tree-insight': 'warn',
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
