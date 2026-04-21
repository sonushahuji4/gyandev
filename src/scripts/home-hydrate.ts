/**
 * Home-page hydration (PR-4.2, home.md Step 5/10).
 *
 * Three responsibilities, all client-side:
 *   1. Continue-Reading card — reveal it iff `lastReadKey()` has data and the
 *      user hasn't dismissed it this session (`dismissKey('continue')`).
 *   2. Dismiss button — sets the sessionStorage flag and hides the card.
 *   3. `?q=` interceptor — open the SearchModal with the query pre-filled so
 *      the `WebSite.SearchAction` urlTemplate isn't misleading.
 *
 * Per roadmap §2.R1: every storage key is built by `storage.ts`; this file
 * never constructs a key by string concatenation.
 *
 * Progress badges on course cards are hydrated by the existing
 * `src/scripts/progress-hydrate.ts` — the home page imports that module
 * separately so both scripts self-attach to `astro:page-load`.
 */
import {
  dismissKey,
  get,
  lastReadKey,
  prefsKey,
  progressKey,
  set,
  type ActiveTabPref,
  type LastReadData,
  type ProgressData,
} from '../lib/storage';

type HydrationRoots = {
  card: HTMLElement | null;
  dismiss: HTMLButtonElement | null;
  resumeLink: HTMLAnchorElement | null;
  courseEl: HTMLElement | null;
  titleEl: HTMLElement | null;
  positionEl: HTMLElement | null;
  statusEl: HTMLElement | null;
  barEl: HTMLElement | null;
};

function getRoots(): HydrationRoots {
  const card = document.getElementById('continue-card');
  return {
    card,
    dismiss: card?.querySelector<HTMLButtonElement>('[data-continue-dismiss]') ?? null,
    resumeLink: card?.querySelector<HTMLAnchorElement>('[data-continue-resume]') ?? null,
    courseEl: card?.querySelector<HTMLElement>('[data-continue-course]') ?? null,
    titleEl: card?.querySelector<HTMLElement>('[data-continue-title]') ?? null,
    positionEl: card?.querySelector<HTMLElement>('[data-continue-position]') ?? null,
    statusEl: card?.querySelector<HTMLElement>('[data-continue-status]') ?? null,
    barEl: card?.querySelector<HTMLElement>('[data-continue-bar]') ?? null,
  };
}

/**
 * Look up the published chapter count for a course from the course card on
 * the same page. `CourseCard` renders `data-course-slug` + `data-chapter-count`
 * so we don't need a second collection fetch. Returns `0` when the card isn't
 * on the page (unknown total).
 */
function findCourseChapterCount(courseSlug: string): number {
  const card = document.querySelector<HTMLElement>(
    `[data-course-slug="${CSS.escape(courseSlug)}"]`,
  );
  const raw = card?.getAttribute('data-chapter-count');
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatActiveTab(tab: ActiveTabPref | null): string {
  switch (tab) {
    case 'revision': return 'Paused mid-Revision';
    case 'flow':     return 'Paused mid-Flow';
    case 'full':
    default:         return 'Paused mid-Full Notes';
  }
}

function hideCard(card: HTMLElement): void {
  card.hidden = true;
}

function hydrateContinue(): void {
  const roots = getRoots();
  const { card } = roots;
  if (!card) return;

  // Re-entry under ClientRouter: always start hidden, repopulate from storage.
  hideCard(card);

  const dismissed = get<boolean>(dismissKey('continue'), 'session') === true;
  if (dismissed) return;

  const data = get<LastReadData>(lastReadKey());
  if (!data || !data.courseSlug || !data.chapterSlug) return;

  if (roots.courseEl) {
    roots.courseEl.textContent = data.courseLabel || data.courseSlug;
  }
  if (roots.titleEl) {
    roots.titleEl.textContent = data.chapterTitle || 'Resume';
  }

  // Read-count + total → "Chapter X of Y" and progress-bar width. When we can't
  // recover either piece (total unknown because the course card isn't on the
  // page, or progress list empty) we hide the position line but still render
  // the rest of the card.
  const progress = get<ProgressData>(progressKey(data.courseSlug));
  const readCount = Array.isArray(progress?.read) ? progress.read.length : 0;
  const total = findCourseChapterCount(data.courseSlug);
  const currentPos = Math.min(Math.max(readCount + 1, 1), Math.max(total, 1));

  if (roots.positionEl) {
    if (total > 0) {
      roots.positionEl.textContent = `Chapter ${currentPos} of ${total}`;
    } else {
      roots.positionEl.textContent = data.chapterTitle ? 'In progress' : '';
    }
  }

  if (roots.statusEl) {
    const activeTab = get<ActiveTabPref>(prefsKey('activeTab'));
    roots.statusEl.textContent = formatActiveTab(activeTab);
  }

  if (roots.barEl) {
    const pct =
      total > 0
        ? Math.min(100, Math.round(((readCount + 0.5) / total) * 100))
        : 12; // first-visit fallback — a thin sliver, not zero.
    roots.barEl.style.width = `${pct}%`;
  }

  if (roots.resumeLink) {
    roots.resumeLink.href = `/courses/${data.courseSlug}/${data.chapterSlug}`;
  }

  card.hidden = false;
}

function wireDismiss(): void {
  const { card, dismiss } = getRoots();
  if (!card || !dismiss) return;
  if (dismiss.dataset.continueBound === 'true') return;
  dismiss.dataset.continueBound = 'true';

  dismiss.addEventListener('click', () => {
    set<boolean>(dismissKey('continue'), true, 'session');
    hideCard(card);
  });
}

function hydrateSearchQuery(): void {
  const q = new URL(window.location.href).searchParams.get('q');
  if (!q) return;

  const modal = document.querySelector<HTMLDialogElement>('dialog[data-search-modal]');
  if (!modal || typeof modal.showModal !== 'function') return;
  if (modal.open) return;

  modal.showModal();
  const input = modal.querySelector<HTMLInputElement>('[data-search-input]');
  if (input) {
    input.value = q;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function run(): void {
  hydrateContinue();
  wireDismiss();
  hydrateSearchQuery();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  document.addEventListener('astro:page-load', run);
}
