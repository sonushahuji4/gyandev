/**
 * Progress hydration for the all-courses catalog (PR-3.2).
 *
 * Reads per-course `ProgressData` envelopes from localStorage and paints a
 * "X of N chapters read" badge into every `[data-course-slug]` card that the
 * server rendered. Marks fully-completed courses with an `aria-label` cue and
 * reveals the celebration banner when every published course is complete.
 *
 * Per roadmap §2.R1: storage reads go through `progressKey()` from
 * `src/lib/storage.ts`. No raw key strings live in this file.
 *
 * The module imports `get()` (which is SSR-safe) so this file can be bundled
 * by Astro as a regular `<script>` import; the exported `hydrateProgress()`
 * is also idempotent, which matters once `<ClientRouter />` lands in PR-5.1.
 */
import { get, progressKey, type ProgressData } from '../lib/storage';

const CARD_SELECTOR = '[data-course-slug]';
const BADGE_SELECTOR = '.course-card__progress';
const BANNER_ID = 'all-complete-banner';

export function hydrateProgress(): void {
  if (typeof document === 'undefined') return;

  const cards = document.querySelectorAll<HTMLElement>(CARD_SELECTOR);
  if (cards.length === 0) return;

  let publishedTotal = 0;
  let publishedAllRead = 0;

  for (const card of cards) {
    const slug = card.dataset.courseSlug;
    const status = card.dataset.courseStatus;
    const total = Number(card.dataset.chapterCount ?? 0);

    const badge = card.querySelector<HTMLElement>(BADGE_SELECTOR);
    // Reset prior state (handles ClientRouter re-runs and cross-tab updates).
    if (badge) {
      badge.hidden = true;
      badge.textContent = '';
      badge.removeAttribute('aria-label');
    }
    card.classList.remove('course-card--in-progress', 'course-card--complete');

    if (status !== 'published') continue;
    publishedTotal += 1;

    if (!slug || total <= 0 || !badge) continue;

    const progress = get<ProgressData>(progressKey(slug));
    const readSet = new Set(progress?.read ?? []);
    const readCount = readSet.size;
    if (readCount <= 0) continue;

    const clamped = Math.min(readCount, total);
    const isComplete = clamped >= total;

    badge.hidden = false;
    badge.textContent = isComplete
      ? `All ${total} chapters read`
      : `${clamped} of ${total} chapters read`;
    badge.setAttribute(
      'aria-label',
      isComplete
        ? `All ${total} chapters read`
        : `${clamped} of ${total} chapters read`,
    );
    card.classList.add(isComplete ? 'course-card--complete' : 'course-card--in-progress');

    if (isComplete) publishedAllRead += 1;
  }

  const banner = document.getElementById(BANNER_ID);
  if (banner) {
    const allComplete = publishedTotal > 0 && publishedAllRead === publishedTotal;
    banner.hidden = !allComplete;
  }
}

// Self-attach so consuming pages just need `import '.../progress-hydrate'`.
// Runs now for cold loads and on `astro:page-load` for view-transition swaps.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateProgress, { once: true });
  } else {
    hydrateProgress();
  }
  document.addEventListener('astro:page-load', hydrateProgress);
}
