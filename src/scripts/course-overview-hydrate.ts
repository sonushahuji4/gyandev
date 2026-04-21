/**
 * Course-overview hydration (PR-4.1).
 *
 * Paints three pieces of client-side state on the course-overview page:
 *
 *   1. **Chapter-row completion icons** — flips `○` → `✓` for read chapters,
 *      and marks a "current" chapter (next unread) with `●` so the list
 *      matches spec §3.5. `aria-label` on each icon stays in sync.
 *   2. **Progress widget** — updates `aria-valuenow`, the "N of M read" text,
 *      and the fill width on `.progress-widget`.
 *   3. **Resume / Start CTAs + completion banner** — toggles visibility of
 *      `[data-cta="resume"]` and `[data-cta="start"]` per spec §3.4 and
 *      reveals `#complete-banner` once every chapter is read.
 *
 * Storage access runs through the `progressKey()` and `lastReadKey()`
 * builders per roadmap §2.R1 — no raw key strings in this file.
 *
 * The function is idempotent so it can re-run on every `astro:page-load`
 * (the shared navigation mode that lands in PR-5.1) and on cross-tab storage
 * events without double-painting.
 */
import {
  get,
  lastReadKey,
  progressKey,
  subscribe,
  type LastReadData,
  type ProgressData,
} from '../lib/storage';

const ROW_SELECTOR = '.chapter-row[data-chapter-slug]';
const WIDGET_SELECTOR = '.progress-widget[data-course-slug]';
const BANNER_ID = 'complete-banner';

type IconStatus = 'not-started' | 'read' | 'current';

const ICON_GLYPH: Record<IconStatus, string> = {
  'not-started': '\u25CB', // ○
  'read':        '\u2713', // ✓
  'current':     '\u25CF', // ●
};

const ICON_LABEL: Record<IconStatus, string> = {
  'not-started': 'Not started',
  'read':        'Read',
  'current':     'Current chapter',
};

function paintIcon(icon: Element, status: IconStatus): void {
  icon.textContent = ICON_GLYPH[status];
  icon.setAttribute('data-status', status);
  icon.setAttribute('aria-label', ICON_LABEL[status]);
}

export function hydrateCourseOverview(): void {
  if (typeof document === 'undefined') return;

  const widget = document.querySelector<HTMLElement>(WIDGET_SELECTOR);
  const rows = document.querySelectorAll<HTMLElement>(ROW_SELECTOR);
  if (!widget || rows.length === 0) return;

  const courseSlug = widget.dataset.courseSlug;
  if (!courseSlug) return;

  const total = Number(widget.dataset.total) || rows.length;

  const progress = get<ProgressData>(progressKey(courseSlug));
  const readSet = new Set(progress?.read ?? []);

  // Optional "current" pointer — only highlight when the last-read entry is
  // for this course AND that chapter isn't already marked read. Otherwise
  // "current" is the first unread row.
  const lastRead = get<LastReadData>(lastReadKey());
  const lastReadSlug =
    lastRead && lastRead.courseSlug === courseSlug ? lastRead.chapterSlug : null;

  let firstUnread: string | null = null;
  let readCount = 0;
  for (const row of rows) {
    const slug = row.dataset.chapterSlug;
    const icon = row.querySelector('.chapter-row__icon');
    if (!slug || !icon) continue;

    const isRead = readSet.has(slug);
    if (isRead) {
      readCount += 1;
      paintIcon(icon, 'read');
      continue;
    }
    if (firstUnread === null) firstUnread = slug;
    paintIcon(icon, 'not-started');
  }

  // Promote "current" marker on the row that best represents where the user
  // should resume — prefer the explicit last-read pointer if it's still
  // unread, else the first unread row.
  const currentSlug =
    lastReadSlug && !readSet.has(lastReadSlug) ? lastReadSlug : firstUnread;
  if (currentSlug) {
    const currentRow = document.querySelector<HTMLElement>(
      `.chapter-row[data-chapter-slug="${CSS.escape(currentSlug)}"]`,
    );
    const currentIcon = currentRow?.querySelector('.chapter-row__icon');
    if (currentIcon) paintIcon(currentIcon, 'current');
  }

  const clampedRead = Math.min(readCount, total);

  widget.setAttribute('aria-valuenow', String(clampedRead));
  const readEl = widget.querySelector<HTMLElement>('[data-progress-read]');
  if (readEl) readEl.textContent = String(clampedRead);
  const fillEl = widget.querySelector<HTMLElement>('[data-progress-fill]');
  if (fillEl) {
    const percent = total === 0 ? 0 : (clampedRead / total) * 100;
    fillEl.style.width = `${percent}%`;
  }

  const resumeLink = document.querySelector<HTMLAnchorElement>('[data-cta="resume"]');
  const startLink = document.querySelector<HTMLAnchorElement>('[data-cta="start"]');
  const banner = document.getElementById(BANNER_ID);

  const isComplete = total > 0 && clampedRead >= total;
  const hasProgress = clampedRead > 0;

  if (resumeLink) {
    const urlBase = resumeLink.dataset.urlBase;
    if (hasProgress && !isComplete && currentSlug && urlBase) {
      resumeLink.href = `${urlBase}/${currentSlug}`;
      resumeLink.hidden = false;
      const label = resumeLink.querySelector<HTMLElement>('[data-cta-label]');
      if (label) label.textContent = 'Resume';
    } else {
      resumeLink.hidden = true;
    }
  }

  if (startLink) {
    startLink.hidden = isComplete || !startLink.getAttribute('href');
  }

  if (banner) banner.hidden = !isComplete;
}

// Self-attach for both cold loads and `astro:page-load` view-transition swaps.
// The `storage` event keeps multiple tabs in sync (chapter page marks-as-read
// → course-overview updates without reload).
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateCourseOverview, { once: true });
  } else {
    hydrateCourseOverview();
  }
  document.addEventListener('astro:page-load', hydrateCourseOverview);

  // Re-hydrate on cross-tab progress updates. Subscribed after first run so
  // the initial paint is stable before listeners fire.
  const widget = document.querySelector<HTMLElement>(WIDGET_SELECTOR);
  const courseSlug = widget?.dataset.courseSlug;
  if (courseSlug) {
    subscribe<ProgressData>(progressKey(courseSlug), hydrateCourseOverview);
    subscribe<LastReadData>(lastReadKey(), hydrateCourseOverview);
  }
}
