/**
 * Chapter-page hydration (PR-5.1, chapter.md §6 Step 19).
 *
 * Five responsibilities, all client-side, all SSR-safe:
 *
 *   1. Mark-as-read button: toggles the chapter slug in the per-course
 *      `progressKey(courseSlug)` envelope (`ProgressData.read[]`).
 *   2. Bookmark button: toggles a `BookmarkEntry` in `bookmarksKey()`.
 *   3. Active-tab pref: writes `prefsKey('activeTab')` whenever the user
 *      clicks a TabLink anchor on the chapter page.
 *   4. Prev/Next href rewriting: respects the activeTab pref and the
 *      destination chapter's `data-views` availability (baked at render).
 *   5. lastRead pointer + sidebar status: writes `lastReadKey()` so the
 *      home Continue card has data, and flips LeftSidebar status icons
 *      to ✓ for already-read chapters.
 *
 * Per PHASE-1-ROADMAP §2.R1: every storage key is built by `storage.ts`;
 * this file never constructs a key by string concatenation.
 *
 * Idempotency: `<ClientRouter />` re-runs page-scoped scripts on every
 * `astro:page-load`. Each handler is bound under a `data-bound` attr so
 * second runs are no-ops.
 */
import {
  bookmarksKey,
  get,
  lastReadKey,
  prefsKey,
  progressKey,
  remove,
  set,
  type ActiveTabPref,
  type BookmarkEntry,
  type BookmarksData,
  type LastReadData,
  type ProgressData,
} from '../lib/storage';

type ChapterMain = HTMLElement & {
  dataset: DOMStringMap & {
    page?: string;
    course?: string;
    chapter?: string;
    chapterTitle?: string;
    courseLabel?: string;
    readingMinutes?: string;
    activeTab?: string;
  };
};

function getMain(): ChapterMain | null {
  const main = document.getElementById('main') as ChapterMain | null;
  if (!main || main.dataset.page !== 'chapter') return null;
  return main;
}

// ---------------------------------------------------------------------------
// Mark-as-read
// ---------------------------------------------------------------------------

function readSetFor(courseSlug: string): Set<string> {
  const data = get<ProgressData>(progressKey(courseSlug));
  return new Set(data?.read ?? []);
}

function writeReadSet(courseSlug: string, readSet: Set<string>): void {
  if (readSet.size === 0) {
    remove(progressKey(courseSlug));
    return;
  }
  set<ProgressData>(progressKey(courseSlug), { read: [...readSet] });
}

function hydrateMarkRead(main: ChapterMain): void {
  const btn = document.querySelector<HTMLButtonElement>(
    '[data-chapter-actions] [data-action="mark-read"]',
  );
  if (!btn) return;

  const courseSlug = main.dataset.course ?? '';
  const chapterSlug = main.dataset.chapter ?? '';
  if (!courseSlug || !chapterSlug) return;

  const refreshState = (): void => {
    const isRead = readSetFor(courseSlug).has(chapterSlug);
    btn.setAttribute('aria-pressed', String(isRead));
    btn.classList.toggle('is-read', isRead);
    const label = btn.querySelector('.chapter-actions__label');
    if (label) label.textContent = isRead ? 'Read' : 'Mark as read';
  };

  refreshState();

  if (btn.dataset.bound !== 'true') {
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const set = readSetFor(courseSlug);
      if (set.has(chapterSlug)) set.delete(chapterSlug);
      else set.add(chapterSlug);
      writeReadSet(courseSlug, set);
      refreshState();
      // Notify sidebar + any other in-page listeners.
      document.dispatchEvent(
        new CustomEvent('gyandev:progress-change', {
          detail: { courseSlug, chapterSlug },
        }),
      );
    });
  }
}

// ---------------------------------------------------------------------------
// Bookmark
// ---------------------------------------------------------------------------

function bookmarksList(): BookmarkEntry[] {
  const data = get<BookmarksData>(bookmarksKey());
  return data?.items ?? [];
}

function writeBookmarks(items: BookmarkEntry[]): void {
  if (items.length === 0) {
    remove(bookmarksKey());
    return;
  }
  set<BookmarksData>(bookmarksKey(), { items });
}

function hydrateBookmark(main: ChapterMain): void {
  const btn = document.querySelector<HTMLButtonElement>(
    '[data-chapter-actions] [data-action="bookmark"]',
  );
  if (!btn) return;

  const courseSlug = main.dataset.course ?? '';
  const chapterSlug = main.dataset.chapter ?? '';
  const chapterTitle = main.dataset.chapterTitle ?? '';
  if (!courseSlug || !chapterSlug) return;

  const isMatch = (b: BookmarkEntry): boolean =>
    b.courseSlug === courseSlug && b.chapterSlug === chapterSlug;

  const refreshState = (): void => {
    const bookmarked = bookmarksList().some(isMatch);
    btn.setAttribute('aria-pressed', String(bookmarked));
    const label = btn.querySelector('.chapter-actions__label');
    if (label) label.textContent = bookmarked ? 'Bookmarked' : 'Bookmark';
  };

  refreshState();

  if (btn.dataset.bound !== 'true') {
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const items = bookmarksList();
      const without = items.filter((b) => !isMatch(b));
      if (without.length === items.length) {
        without.push({
          courseSlug,
          chapterSlug,
          title: chapterTitle,
          addedAt: Date.now(),
        });
      }
      writeBookmarks(without);
      refreshState();
    });
  }
}

// ---------------------------------------------------------------------------
// Active-tab preference + prev/next rewriting
// ---------------------------------------------------------------------------

function isTab(value: string | null | undefined): value is ActiveTabPref {
  return value === 'full' || value === 'revision' || value === 'flow';
}

function suffixForTab(tab: ActiveTabPref): string {
  if (tab === 'revision') return '/revision';
  if (tab === 'flow') return '/flow';
  return '';
}

function hydrateActiveTabPref(): void {
  for (const tabEl of document.querySelectorAll<HTMLAnchorElement>('[data-tablist] a[role="tab"]')) {
    if (tabEl.dataset.bound === 'true') continue;
    tabEl.dataset.bound = 'true';
    tabEl.addEventListener('click', () => {
      const href = tabEl.getAttribute('href') ?? '';
      let pref: ActiveTabPref = 'full';
      if (href.endsWith('/revision')) pref = 'revision';
      else if (href.endsWith('/flow')) pref = 'flow';
      set<ActiveTabPref>(prefsKey('activeTab'), pref);
    });
  }
}

/**
 * Sync visible active-tab state to the current URL.
 *
 * The chapter shell (tab bar, breadcrumbs, TopNav) is wrapped in
 * `transition:persist="chapter-shell"`, so Astro reuses the PRIOR page's
 * tab DOM after a view-transition swap. That means aria-selected, the
 * `tab--active` class, and roving `tabindex` all stay frozen on whichever
 * tab rendered on first paint. We have to reapply them from the URL on
 * every `astro:page-load`.
 */
function hydrateActiveTabState(): void {
  const tabs = document.querySelectorAll<HTMLAnchorElement>('[data-tablist] a[role="tab"]');
  if (tabs.length === 0) return;

  const pathname = window.location.pathname;
  const isRevision = pathname.endsWith('/revision') || pathname.endsWith('/revision/');
  const isFlow = pathname.endsWith('/flow') || pathname.endsWith('/flow/');
  const current: ActiveTabPref = isRevision ? 'revision' : isFlow ? 'flow' : 'full';

  for (const tab of tabs) {
    const href = tab.getAttribute('href') ?? '';
    const matches =
      (current === 'revision' && href.endsWith('/revision')) ||
      (current === 'flow' && href.endsWith('/flow')) ||
      (current === 'full' && !href.endsWith('/revision') && !href.endsWith('/flow'));

    tab.setAttribute('aria-selected', String(matches));
    if (matches) {
      tab.setAttribute('aria-current', 'page');
      tab.classList.add('tab--active');
      tab.setAttribute('tabindex', '0');
    } else {
      tab.removeAttribute('aria-current');
      tab.classList.remove('tab--active');
      tab.setAttribute('tabindex', '-1');
    }
  }
}

function rewritePrevNext(): void {
  const stored = get<ActiveTabPref>(prefsKey('activeTab'));
  const pref: ActiveTabPref = isTab(stored) ? stored : 'full';

  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-prevnext]')) {
    const baseUrl = link.dataset.baseUrl ?? link.getAttribute('href') ?? '';
    if (!baseUrl) continue;
    const views = (link.dataset.views ?? 'full').split(',');
    let nextHref = baseUrl;
    if (pref !== 'full' && views.includes(pref)) {
      nextHref = baseUrl + suffixForTab(pref);
    }
    if (link.getAttribute('href') !== nextHref) {
      link.setAttribute('href', nextHref);
    }
  }
}

// ---------------------------------------------------------------------------
// lastRead writer
// ---------------------------------------------------------------------------

function writeLastRead(main: ChapterMain): void {
  const courseSlug = main.dataset.course ?? '';
  const chapterSlug = main.dataset.chapter ?? '';
  if (!courseSlug || !chapterSlug) return;

  const data: LastReadData = {
    courseSlug,
    chapterSlug,
    chapterTitle: main.dataset.chapterTitle ?? '',
    readingMinutes: Number(main.dataset.readingMinutes ?? '0') || 0,
    courseLabel: main.dataset.courseLabel ?? '',
  };
  set<LastReadData>(lastReadKey(), data);
}

// ---------------------------------------------------------------------------
// LeftSidebar status icons
// ---------------------------------------------------------------------------

function hydrateSidebarStatus(main: ChapterMain): void {
  const courseSlug = main.dataset.course ?? '';
  if (!courseSlug) return;

  const sidebar = document.querySelector<HTMLElement>(
    `[data-left-sidebar][data-course-slug="${courseSlug}"]`,
  );
  if (!sidebar) return;

  const readSet = readSetFor(courseSlug);
  const dots = sidebar.querySelectorAll<HTMLElement>('[data-chapter-status]');
  for (const dot of dots) {
    const slug = dot.dataset.chapterSlug ?? '';
    const isCurrent = dot.dataset.current === 'true';
    if (isCurrent) {
      dot.textContent = '●';
      dot.dataset.status = 'current';
      continue;
    }
    if (readSet.has(slug)) {
      dot.textContent = '✓';
      dot.dataset.status = 'read';
    } else {
      dot.textContent = '○';
      dot.dataset.status = 'unread';
    }
  }
}

// ---------------------------------------------------------------------------
// Run / re-run
// ---------------------------------------------------------------------------

function run(): void {
  const main = getMain();
  if (!main) return;

  hydrateMarkRead(main);
  hydrateBookmark(main);
  hydrateActiveTabPref();
  hydrateActiveTabState();
  rewritePrevNext();
  hydrateSidebarStatus(main);
  writeLastRead(main);
}

function runOnProgressChange(): void {
  const main = getMain();
  if (!main) return;
  hydrateMarkRead(main);
  hydrateSidebarStatus(main);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  document.addEventListener('astro:page-load', run);
  document.addEventListener('gyandev:progress-change', runOnProgressChange);
}
