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
  set,
  type LastReadData,
} from '../lib/storage';

type HydrationRoots = {
  card: HTMLElement | null;
  dismiss: HTMLButtonElement | null;
  resumeLink: HTMLAnchorElement | null;
  courseEl: HTMLElement | null;
  titleEl: HTMLElement | null;
  metaEl: HTMLElement | null;
};

function getRoots(): HydrationRoots {
  const card = document.getElementById('continue-card');
  return {
    card,
    dismiss: card?.querySelector<HTMLButtonElement>('[data-continue-dismiss]') ?? null,
    resumeLink: card?.querySelector<HTMLAnchorElement>('[data-continue-resume]') ?? null,
    courseEl: card?.querySelector<HTMLElement>('[data-continue-course]') ?? null,
    titleEl: card?.querySelector<HTMLElement>('[data-continue-title]') ?? null,
    metaEl: card?.querySelector<HTMLElement>('[data-continue-meta]') ?? null,
  };
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
  if (roots.metaEl) {
    const minutes = Number.isFinite(data.readingMinutes) ? data.readingMinutes : 0;
    roots.metaEl.textContent = minutes > 0 ? `${minutes} min read` : '';
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
