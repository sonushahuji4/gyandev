/**
 * Pre-paint theme initialization — runs synchronously in <head> before first
 * paint so the page renders in the correct palette without a light→dark FOUC.
 *
 * Emitted by `BaseLayout.astro` as `<script is:inline set:html={THEME_INIT}>`.
 *
 * Two outputs on `<html>`:
 *   - `.dark` class    — consumed by Tailwind's `@custom-variant dark` + our
 *                        dark-palette override in `global.css`.
 *   - `data-theme`     — consumed by astro-mermaid (reads `data-theme` to pick
 *                        its diagram theme in PR-5.1).
 *
 * Per PHASE-1-ROADMAP §2.R1, the localStorage key is produced by
 * `prefsKey('theme')` in `src/lib/storage.ts`. This script runs before any
 * module can import, so the *literal* key string is inlined here — but the
 * literal must stay in lock-step with the builder's output. A unit test in
 * `storage.test.ts` (future) should assert `prefsKey('theme') ===
 * 'gyandev:v1:prefs:theme'`.
 *
 * Envelope: `{ v: 1, data: 'light' | 'dark' | 'system' }`. The script is
 * defensive — any parse failure falls back to `system`.
 */

const THEME_STORAGE_KEY = 'gyandev:v1:prefs:theme';

export const THEME_INIT = `(() => {
  try {
    var raw = localStorage.getItem('${THEME_STORAGE_KEY}');
    var stored = null;
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.v === 1 && (parsed.data === 'light' || parsed.data === 'dark' || parsed.data === 'system')) {
          stored = parsed.data;
        }
      } catch (e) { /* fall through to system */ }
    }
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || ((stored === 'system' || stored === null) && prefersDark);
    var root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } catch (e) {
    /* storage inaccessible — leave default light theme from SSR */
  }
})();`;
